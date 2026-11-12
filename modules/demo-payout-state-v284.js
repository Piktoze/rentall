// Demo balances are estimates, not actual Stripe Connect payouts.
// A completed booking never proves that funds reached the supplier.
export function demoPayoutStatus(booking,{hasOpenDispute=false,completed=false}={}){
  if(!booking || String(booking.paymentProvider||'')!=='demo')return 'not_ready';
  if(String(booking.paymentStatus||'')!=='paid' ||
     booking.stripeRefundId ||
     ['pending','succeeded','failed','canceled'].includes(String(booking.refundStatus||'').toLowerCase()) ||
     hasOpenDispute ||
     (Number(booking.securityDepositAmount||0)>0 &&
      !['released','captured'].includes(String(booking.securityDepositStatus||'').toLowerCase())))
    return 'pending';
  return completed?'simulated':'ready';
}
