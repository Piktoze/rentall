// Isolated, read-only TEST supplier transfer readiness inspection.
// Not linked to public routes or cron. Does NOT reserve, send or confirm money.
// A positive result is a snapshot, not authorization for a Stripe transfer:
// an executor must re-check funds, deadline and booking states immediately
// before reservation and provider mutation.
import {getSctBookingBinding} from './sct-booking-binding.js';
import {reconcileIsolatedSctTestPayment} from './isolated-sct-test-payment-reconciler.js';
import {planDeferredSupplierTransfer} from './deferred-supplier-transfer.js';

const validBookingId=v=>typeof v==='string'&&/^RB-[A-Za-z0-9-]+$/.test(v);
function exists(db,table){
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
}

export async function inspectIsolatedSctTestSupplierTransfer({
  db,stripe,stripeMode,stripeSecretKey,bookingId,nowMs,releaseDeadlineAt,
}={}){
  if(stripeMode!=='test'||
     !/^sk_test_[A-Za-z0-9_-]{8,}$/.test(stripeSecretKey||'')||
     stripe?._apiKey!==stripeSecretKey)
    return {blocked:'trusted_platform_test_client_required'};
  if(!db?.prepare||!validBookingId(bookingId))
    return {blocked:'invalid_booking_or_database'};
  if(!Number.isSafeInteger(nowMs)||!Number.isSafeInteger(releaseDeadlineAt)||
     releaseDeadlineAt<=nowMs)
    return {blocked:'verified_release_deadline_required'};
  const binding=getSctBookingBinding(db,bookingId);
  if(!binding||binding.livemode!==false||!binding.paymentIntentId)
    return {blocked:'immutable_sct_test_binding_missing'};
  const booked=db.prepare(`SELECT booking_id,listing_id,status,returned_at,
    payment_status,stripe_payment_intent_id,stripe_refund_id,refund_status,
    payout_status,order_value,platform_fee_amount,supplier_amount
    FROM rental_bookings WHERE booking_id=?`).get(bookingId);
  const settled=db.prepare(`SELECT booking_id,payment_intent_id,charge_id,
    amount_cents,fee_cents,supplier_cents
    FROM sct_payment_settlements WHERE booking_id=?`).get(bookingId);
  if(!booked||!settled||booked.status!=='returned'||
     !booked.returned_at||!Number.isFinite(Date.parse(booked.returned_at))||
     Date.parse(booked.returned_at)>nowMs||
     booked.listing_id!==binding.listingId||
     booked.payment_status!=='paid'||booked.stripe_refund_id!=null||
     (booked.refund_status&&!['none','not_required'].includes(booked.refund_status))||
     booked.payout_status!=='not_ready'||
     booked.stripe_payment_intent_id!==binding.paymentIntentId||
     settled.booking_id!==bookingId||
     settled.payment_intent_id!==binding.paymentIntentId||
     settled.amount_cents!==binding.amountCents||
     settled.fee_cents!==binding.feeCents||
     settled.supplier_cents!==binding.amountCents-binding.feeCents||
     Math.round(Number(booked.order_value||0)*100)!==binding.amountCents||
     Math.round(Number(booked.platform_fee_amount||0)*100)!==binding.feeCents||
     Math.round(Number(booked.supplier_amount||0)*100)!==settled.supplier_cents)
    return {blocked:'canonical_payment_or_return_not_ready'};
  // Missing journals are NOT evidence of no refunds/transfers. Both must
  // be initialized explicitly in the isolated TEST database before readiness.
  if(!exists(db,'sct_test_refund_commands')||
     !exists(db,'supplier_transfer_commands'))
    return {blocked:'financial_command_journals_unavailable'};
  for(const table of ['sct_test_refund_commands','supplier_transfer_commands',
                       'stripe_rental_disputes','rental_disputes']){
    if(exists(db,table)&&db.prepare(`SELECT 1 FROM ${table} WHERE booking_id=? LIMIT 1`).get(bookingId))
      return {blocked:'existing_financial_command_or_dispute'};
  }
  // Provider calls are read-only and on the PLATFORM account.
  const proof=await reconcileIsolatedSctTestPayment({stripe,stripeMode,binding});
  if(proof.blocked)return proof;
  if(proof.chargeId!==settled.charge_id||
     proof.supplierCents!==settled.supplier_cents||
     proof.amountCents!==settled.amount_cents)
    return {blocked:'stripe_proof_settlement_mismatch'};

  const snapshot={
    id:bookingId,status:booked.status,
    returnConfirmedAt:Date.parse(booked.returned_at),
    releaseDeadlineAt,paymentFlow:'separate_charges_and_transfers',
    transferStatus:'unclaimed',amountCents:binding.amountCents,
    feeCents:binding.feeCents,paymentIntentId:binding.paymentIntentId,
    chargeId:proof.chargeId,destination:binding.destination,livemode:false,
  };
  const payment={
    bookingId,paymentIntentId:binding.paymentIntentId,
    chargeId:proof.chargeId,destination:binding.destination,
    capturedAmountCents:proof.amountCents,currency:'eur',livemode:false,
    scope:'platform',status:'succeeded',refundState:'none',disputeState:'clear',
    financialHold:false,destinationTransferActive:true,dataCurrent:true,
  };
  const plan=planDeferredSupplierTransfer(snapshot,payment,nowMs);
  if(plan.blocked)return plan;
  // Return only a read-only readiness report. No external payout is authorized
  // by this result: caller must obtain and validate the holding deadline.
  return {status:'test_evidence_ready_for_manual_review',
    bookingId,paymentIntentId:proof.paymentIntentId,chargeId:proof.chargeId,
    amountCents:proof.amountCents,platformFeeCents:proof.feeCents,
    supplierCents:proof.supplierCents,destination:binding.destination,
    returnConfirmedAt:snapshot.returnConfirmedAt,
    deadlineCheck:'caller_supplied_not_authoritative',
    transferExecuted:false};
}
