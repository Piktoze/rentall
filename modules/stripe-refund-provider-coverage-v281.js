// Authoritative cumulative Stripe refund check for an existing direct charge.
// A single saved refund ID or local numeric balance does not prove settlement.
export function assertProviderRefundCoversCancellation(booking,requiredTotal,providerPage){
  const failure=reason=>{
    const e=new Error('Stripe partial refund needs reconciliation: '+reason);
    e.code='REFUND_RECONCILIATION_REQUIRED';
    throw e;
  };
  if(!booking?.stripeRefundId) return true;
  const requiredCents=Math.round(Number(requiredTotal)*100);
  const recordedCents=Math.round(Number(booking.refundAmount)*100);
  const orderCents=Math.round(Number(booking.orderValue)*100);
  if(!Number.isSafeInteger(requiredCents)||requiredCents<0||
     !Number.isSafeInteger(recordedCents)||recordedCents<0||
     !Number.isSafeInteger(orderCents)||orderCents<=0||
     !Array.isArray(providerPage?.data)||providerPage.has_more!==false)
    failure('invalid totals or incomplete provider result');
  let settled=0,found=false;
  for(const refund of providerPage.data){
    if(String(refund?.payment_intent||'')!==String(booking.stripePaymentIntentId) ||
       String(refund?.metadata?.bookingId||'')!==String(booking.bookingId) ||
       String(refund?.currency||'').toLowerCase()!=='eur' ||
       !Number.isSafeInteger(refund?.amount)||refund.amount<=0)
      failure('refund identity or amount mismatch');
    const status=String(refund.status||'').toLowerCase();
    if(!['succeeded','pending','failed','canceled'].includes(status))
      failure('unknown provider refund status');
    if(refund.id===booking.stripeRefundId){
      found=true;
      if(status!=='succeeded')failure('recorded refund not settled');
    }
    if(status==='pending')failure('another refund is still pending');
    if(status==='succeeded')settled+=refund.amount;
  }
  if(!found||settled>orderCents||settled!==recordedCents||
     settled<requiredCents||!Number.isSafeInteger(settled))
    failure('local refund amount does not match settled provider total');
  return true;
}
