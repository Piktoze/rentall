// Staging-only persistence primitive for future Separate Charges and Transfers worker.
// This module does NOT call Stripe, release funds, or migrate legacy bookings.
// Any uncertain external response must be reconciled by querying Stripe, never retried blindly.
export function installSupplierTransferCommands(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS supplier_transfer_commands (
      booking_id TEXT PRIMARY KEY,
      payment_intent_id TEXT NOT NULL,
      charge_id TEXT NOT NULL,
      destination TEXT NOT NULL,
      amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
      currency TEXT NOT NULL CHECK(currency = 'eur'),
      idempotency_key TEXT NOT NULL UNIQUE,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('reserved','reconcile_required','transferred','blocked')),
      stripe_transfer_id TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
function verifiedPlan(plan) {
  const t = plan?.transfer;
  return !!(t && /^RB-[A-Za-z0-9-]+$/.test(t.transfer_group || '') &&
    plan.idempotencyKey === `booking:${t.transfer_group}:supplier-transfer:v1` &&
    /^pi_[A-Za-z0-9]+$/.test(t.metadata?.paymentIntentId || '') &&
    t.metadata?.bookingId === t.transfer_group &&
    /^ch_[A-Za-z0-9]+$/.test(t.source_transaction || '') &&
    /^acct_[A-Za-z0-9]+$/.test(t.destination || '') &&
    Number.isSafeInteger(t.amount) && t.amount > 0 && t.currency === 'eur');
}
export function reserveSupplierTransferCommand(db, plan) {
  if (!verifiedPlan(plan)) return { blocked: 'invalid_transfer_plan' };
  const t = plan.transfer;
  return db.transaction(() => {
    // Both journals reserve within SQLite IMMEDIATE transactions. Whichever
    // reserves first blocks the opposite financial operation permanently until
    // independent reconciliation; never transfer while any refund is uncertain.
    const refundTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sct_test_refund_commands'").get();
    if (refundTable && db.prepare('SELECT 1 FROM sct_test_refund_commands WHERE booking_id=? LIMIT 1').get(t.transfer_group))
      return { blocked: 'sct_refund_command_requires_review' };
    // Re-read canonical TEST payment and confirmed return inside the same
    // IMMEDIATE transaction that reserves the one-shot transfer command.
    const bookingTable=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='rental_bookings'").get();
    const bindingTable=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sct_booking_bindings'").get();
    const paymentTable=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sct_payment_settlements'").get();
    if(!bookingTable||!bindingTable||!paymentTable)
      return {blocked:'canonical_transfer_evidence_unavailable'};
    const booking=db.prepare(`SELECT status,returned_at,payment_status,
      stripe_payment_intent_id,stripe_refund_id,refund_status,payout_status,order_value,
      platform_fee_amount,supplier_amount FROM rental_bookings WHERE booking_id=?`)
      .get(t.transfer_group);
    const binding=db.prepare(`SELECT payment_intent_id,destination,
      amount_cents,fee_cents,stripe_mode FROM sct_booking_bindings WHERE booking_id=?`)
      .get(t.transfer_group);
    const settled=db.prepare(`SELECT payment_intent_id,charge_id,amount_cents,
      fee_cents,supplier_cents FROM sct_payment_settlements WHERE booking_id=?`)
      .get(t.transfer_group);
    if(!booking||!binding||!settled||booking.status!=='returned'||
       !booking.returned_at||!Number.isFinite(Date.parse(booking.returned_at))||
       booking.payment_status!=='paid'||booking.stripe_refund_id!=null||
       (booking.refund_status&&!['none','not_required'].includes(booking.refund_status))||
       booking.payout_status!=='not_ready'||
       booking.stripe_payment_intent_id!==t.metadata.paymentIntentId||
       binding.stripe_mode!=='test'||binding.payment_intent_id!==t.metadata.paymentIntentId||
       settled.payment_intent_id!==t.metadata.paymentIntentId||
       settled.charge_id!==t.source_transaction||
       binding.destination!==t.destination||
       settled.amount_cents!==binding.amount_cents||
       settled.fee_cents!==binding.fee_cents||
       settled.supplier_cents!==t.amount||
       binding.amount_cents-binding.fee_cents!==t.amount||
       Math.round(Number(booking.order_value||0)*100)!==binding.amount_cents||
       Math.round(Number(booking.platform_fee_amount||0)*100)!==binding.fee_cents||
       Math.round(Number(booking.supplier_amount||0)*100)!==t.amount)
      return {blocked:'canonical_return_or_payment_not_releasable'};
    for(const table of ['stripe_rental_disputes','rental_disputes']){
      if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table)&&
         db.prepare(`SELECT 1 FROM ${table} WHERE booking_id=? LIMIT 1`).get(t.transfer_group))
        return {blocked:'financial_dispute_requires_review'};
    }
    const existing = db.prepare('SELECT * FROM supplier_transfer_commands WHERE booking_id=?')
      .get(t.transfer_group);
    const payload = JSON.stringify(t);
    if (existing) {
      if (existing.idempotency_key !== plan.idempotencyKey ||
        existing.payment_intent_id !== t.metadata.paymentIntentId ||
        existing.charge_id !== t.source_transaction ||
        existing.destination !== t.destination ||
        existing.amount_cents !== t.amount ||
        existing.currency !== t.currency ||
        existing.payload_json !== payload) {
        return { blocked: 'transfer_command_conflict' };
      }
      return { status: existing.status, idempotencyKey: existing.idempotency_key,
        transferId: existing.stripe_transfer_id || null, alreadyExists: true };
    }
    db.prepare(`INSERT INTO supplier_transfer_commands
      (booking_id,payment_intent_id,charge_id,destination,amount_cents,currency,
       idempotency_key,payload_json,status) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(t.transfer_group,t.metadata.paymentIntentId,t.source_transaction,t.destination,
        t.amount,t.currency,plan.idempotencyKey,payload,'reserved');
    return { status: 'reserved', idempotencyKey: plan.idempotencyKey, alreadyExists: false };
  }).immediate();
}
export function markSupplierTransferReconciliationRequired(db, bookingId) {
  return db.prepare(`UPDATE supplier_transfer_commands
      SET status='reconcile_required',updated_at=CURRENT_TIMESTAMP
      WHERE booking_id=? AND status='reserved'`).run(bookingId).changes === 1;
}
export function recordReconciledSupplierTransfer(db, bookingId, transferId) {
  if (!/^tr_[A-Za-z0-9]+$/.test(transferId || '')) return { blocked: 'invalid_transfer_id' };
  return db.transaction(() => {
    const row = db.prepare('SELECT status,stripe_transfer_id FROM supplier_transfer_commands WHERE booking_id=?')
      .get(bookingId);
    if (!row) return { blocked: 'unknown_transfer_command' };
    if (row.status === 'transferred')
      return row.stripe_transfer_id === transferId ? { status: 'transferred', alreadyExists: true } :
        { blocked: 'transfer_identity_conflict' };
    if (!['reserved','reconcile_required'].includes(row.status))
      return { blocked: 'transfer_command_not_releasable' };
    // Caller must have verified this exact Transfer in Stripe; no Stripe calls occur here.
    try {
      db.prepare(`UPDATE supplier_transfer_commands
        SET status='transferred',stripe_transfer_id=?,updated_at=CURRENT_TIMESTAMP
        WHERE booking_id=?`).run(transferId,bookingId);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return { blocked: 'transfer_id_already_used' };
      throw error;
    }
    return { status: 'transferred', alreadyExists: false };
  }).immediate();
}
