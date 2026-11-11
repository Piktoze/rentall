// Prevent an already-partially-refunded booking from being marked fully refunded
// without issuing the additional provider refund. A stored Stripe refund ID
// represents an existing operation, not permission to skip any remaining amount.
export function assertExistingRefundCoversCancellation(booking,requiredTotal){
  if(!booking?.stripeRefundId)return true;
  const required=Number(requiredTotal);
  const recorded=Number(booking.refundAmount);
  if(!Number.isFinite(required)||required<0||!Number.isFinite(recorded)||recorded<0
    ||Math.round(required*100)>Math.round(recorded*100)){
    const error=new Error('Existing Stripe refund does not cover cancellation amount; reconcile before cancelling');
    error.code='REFUND_RECONCILIATION_REQUIRED';
    throw error;
  }
  return true;
}
