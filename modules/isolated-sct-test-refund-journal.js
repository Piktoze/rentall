// Durable SCT TEST refund command journal. Never executes Stripe requests.
// Reserve once BEFORE the network operation; no caller may blindly retry.
// Intentional states: reserved -> reconcile_required -> refunded.
export function installIsolatedSctRefundCommands(db){
  db.exec(`
    CREATE TABLE IF NOT EXISTS sct_test_refund_commands(
      booking_id TEXT PRIMARY KEY,
      payment_intent_id TEXT NOT NULL UNIQUE,
      charge_id TEXT NOT NULL UNIQUE,
      amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
      idempotency_key TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK(status IN ('reserved','reconcile_required','refunded')),
      stripe_refund_id TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
export function reserveIsolatedSctRefundCommand(db,plan){
  const r=plan?.refund;
  const bookingId=r?.metadata?.bookingId;
  if(!/^RB-[A-Za-z0-9-]+$/.test(bookingId||'')||
     !/^pi_[A-Za-z0-9]+$/.test(r.metadata?.paymentIntentId||'')||
     !/^ch_[A-Za-z0-9]+$/.test(r.charge||'')||
     plan.idempotencyKey!==`booking:${bookingId}:sct-full-refund:v1`||
     r.metadata.purpose!=='sct_rental_full_refund'||
     r.reason!=='requested_by_customer'||
     !Number.isSafeInteger(r.amount)||r.amount<50)
    return {blocked:'invalid_refund_command'};
  return db.transaction(()=>{
    const settlement=db.prepare(`SELECT payment_intent_id,charge_id,amount_cents
      FROM sct_payment_settlements WHERE booking_id=?`).get(bookingId);
    if(!settlement||settlement.payment_intent_id!==r.metadata.paymentIntentId||
       settlement.charge_id!==r.charge||settlement.amount_cents!==r.amount)
      return {blocked:'settled_payment_mismatch'};
    const transferTable=db.prepare(`SELECT 1 FROM sqlite_master
      WHERE type='table' AND name='supplier_transfer_commands'`).get();
    if(transferTable&&db.prepare(`SELECT 1 FROM supplier_transfer_commands
      WHERE booking_id=? LIMIT 1`).get(bookingId))
      return {blocked:'transfer_command_requires_review'};
    const existing=db.prepare('SELECT * FROM sct_test_refund_commands WHERE booking_id=?')
      .get(bookingId);
    if(existing){
      if(existing.payment_intent_id!==settlement.payment_intent_id||
         existing.charge_id!==r.charge||
         existing.amount_cents!==r.amount||
         existing.idempotency_key!==plan.idempotencyKey)
        return {blocked:'refund_identity_conflict'};
      return {blocked:'existing_refund_command_requires_reconciliation',
        status:existing.status};
    }
    db.prepare(`INSERT INTO sct_test_refund_commands
      (booking_id,payment_intent_id,charge_id,amount_cents,idempotency_key,status)
      VALUES(?,?,?,?,?,'reserved')`).run(
      bookingId,settlement.payment_intent_id,r.charge,r.amount,plan.idempotencyKey);
    return {status:'reserved',bookingId};
  }).immediate();
}
export function markIsolatedSctRefundReconciliationRequired(db,bookingId){
  return db.prepare(`UPDATE sct_test_refund_commands
    SET status='reconcile_required',updated_at=CURRENT_TIMESTAMP
    WHERE booking_id=? AND status='reserved'`).run(bookingId).changes===1;
}
export function recordVerifiedIsolatedSctRefund(db,bookingId,refund){
  if(!/^re_[A-Za-z0-9]+$/.test(refund?.id||'')||
     refund.livemode!==false||refund.status!=='succeeded')
    return {blocked:'invalid_provider_refund'};
  return db.transaction(()=>{
    const row=db.prepare('SELECT * FROM sct_test_refund_commands WHERE booking_id=?')
      .get(bookingId);
    if(!row||row.status!=='reconcile_required'||
       refund.charge!==row.charge_id||
       refund.payment_intent!==row.payment_intent_id||
       refund.amount!==row.amount_cents||
       refund.currency!=='eur')
      return {blocked:'refund_verification_mismatch'};
    const saved=db.prepare(`UPDATE sct_test_refund_commands
      SET status='refunded',stripe_refund_id=?,updated_at=CURRENT_TIMESTAMP
      WHERE booking_id=? AND status='reconcile_required'`).run(refund.id,bookingId);
    return saved.changes===1?{status:'refunded',refundId:refund.id}:
      {blocked:'refund_reconciliation_race'};
  }).immediate();
}
