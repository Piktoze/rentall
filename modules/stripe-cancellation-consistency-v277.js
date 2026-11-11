// Locally collected payment and Stripe provider state must not disagree when
// cancellation could trigger a refund or change the rental's financial record.
export function assertPaymentCancellationConsistency(booking,intent){
  const status=String(booking?.paymentStatus||'unpaid').toLowerCase();
  const providerStatus=String(intent?.status||'');
  const localCollected=['paid','partially_refunded','refunded'].includes(status)
    || Boolean(booking?.stripeRefundId);
  if(localCollected && providerStatus!=='succeeded'){
    const err=new Error('Booking payment state conflicts with Stripe; manual reconciliation required');
    err.code='PAYMENT_STATE_CONFLICT';
    throw err;
  }
  return true;
}
