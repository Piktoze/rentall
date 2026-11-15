// One-shot SCT TEST refund command executor, isolated from server.js.
// The caller must supply canonical snapshots and independently verify current
// Stripe charge/refund/dispute/transfer evidence before calling this function.
// A failed or ambiguous provider call is NEVER retried automatically.
import {planIsolatedSctTestFullRefund} from './isolated-sct-test-full-refund-policy.js';
import {finalizeIsolatedSctTestRefund} from './isolated-sct-test-refund-finalization.js';
import {
  reserveIsolatedSctRefundCommand,markIsolatedSctRefundReconciliationRequired,
} from './isolated-sct-test-refund-journal.js';

export async function executeIsolatedSctTestFullRefund({
  db,booking,binding,settlement,provider,adapter,
}={}){
  const plan=planIsolatedSctTestFullRefund(booking,binding,settlement,provider);
  if(plan.blocked)return plan;
  if(typeof adapter?.createRefund!=='function'||typeof adapter?.retrieveRefund!=='function')
    return {blocked:'test_refund_adapter_required'};
  const command=reserveIsolatedSctRefundCommand(db,plan);
  if(command.blocked)return command;
  if(!markIsolatedSctRefundReconciliationRequired(db,booking.id))
    return {blocked:'refund_command_needs_reconciliation'};
  let result;
  try{result=await adapter.createRefund(plan)}catch{
    return {blocked:'provider_refund_result_unknown'};
  }
  if(!/^re_[A-Za-z0-9]+$/.test(result?.refundId||''))
    return {blocked:'provider_refund_result_unknown'};
  let readback;
  try{readback=await adapter.retrieveRefund(result.refundId)}catch{
    return {blocked:'provider_refund_result_unknown'};
  }
  if(readback?.blocked||
     readback?.id!==result.refundId||
     readback.livemode!==false||
     readback.status!=='succeeded'||
     readback.charge!==settlement.chargeId||
     readback.payment_intent!==settlement.paymentIntentId||
     readback.amount!==binding.amountCents||
     readback.currency!=='eur'||
     readback.metadata?.bookingId!==booking.id||
     readback.metadata?.paymentIntentId!==settlement.paymentIntentId||
     readback.metadata?.purpose!=='sct_rental_full_refund')
    return {blocked:'refund_reconciliation_required'};
  // Refund journal and rental booking update must succeed together or remain
  // unresolved. Do not release a supplier transfer during this period.
  const saved=finalizeIsolatedSctTestRefund(db,{bookingId:booking.id,refund:readback});
  return saved.blocked?{blocked:'refund_booking_reconciliation_required',reason:saved.blocked}:saved;
}
