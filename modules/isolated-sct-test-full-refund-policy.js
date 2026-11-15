// Pure TEST-only SCT full-refund authorization policy.
// This prototype is intentionally disconnected from public endpoints and Stripe.
// A refund needs its own idempotent command journal and authoritative provider
// reconciliation before any network request is enabled.
export function planIsolatedSctTestFullRefund(booking,binding,settlement,provider){
  if(booking?.livemode!==false||binding?.livemode!==false||provider?.livemode!==false)
    return {blocked:'test_only'};
  if(booking?.paymentFlow!=='separate_charges_and_transfers' ||
     !/^RB-[A-Za-z0-9-]+$/.test(booking?.id||'') ||
     booking.id!==binding?.id || booking.id!==settlement?.bookingId ||
     !/^pi_[A-Za-z0-9]+$/.test(binding?.paymentIntentId||'') ||
     !/^ch_[A-Za-z0-9]+$/.test(settlement?.chargeId||'') ||
     settlement.paymentIntentId!==binding.paymentIntentId ||
     provider.paymentIntentId!==binding.paymentIntentId ||
     provider.chargeId!==settlement.chargeId)
    return {blocked:'refund_identity_mismatch'};
  if(!Number.isSafeInteger(binding.amountCents)||binding.amountCents<50||
     !Number.isSafeInteger(binding.feeCents)||binding.feeCents<0||
     binding.feeCents>=binding.amountCents||
     settlement.amountCents!==binding.amountCents||
     settlement.feeCents!==binding.feeCents||
     settlement.supplierCents!==binding.amountCents-binding.feeCents||
     provider.amountCents!==binding.amountCents||
     provider.currency!=='eur'||provider.paymentStatus!=='succeeded'||
     provider.chargeCaptured!==true)
    return {blocked:'refund_amount_or_charge_mismatch'};
  if(booking.status!=='confirmed'||booking.paymentStatus!=='paid'||
     booking.handedOverAt!=null||booking.returnedAt!=null||
     booking.financialHold!==false||booking.disputeHold!==false||
     booking.stripeRefundId||booking.refundStatus||
     provider.chargeDisputed!==false||provider.amountRefundedCents!==0||
     provider.refundsComplete!==true||provider.refundCount!==0||
     provider.disputesComplete!==true||provider.disputeCount!==0||
     provider.transfersComplete!==true||provider.transferCount!==0||
     provider.stripeTransfersComplete!==true||
     provider.stripeTransferCount!==0||
     booking.transferCommandExists!==false)
    return {blocked:'refund_requires_financial_reconciliation'};
  return {
    idempotencyKey:`booking:${booking.id}:sct-full-refund:v1`,
    refund:{
      charge:settlement.chargeId,
      amount:binding.amountCents,
      reason:'requested_by_customer',
      metadata:{
        bookingId:booking.id,
        paymentIntentId:binding.paymentIntentId,
        purpose:'sct_rental_full_refund',
      },
    },
  };
}
