// Validate the final Stripe response, not just an optimistic local capture request.
// For a partial manual capture, amount_received must equal amount_to_capture.
export function assertConfirmedDepositCapture(result,{paymentIntentId,bookingId,amountCents}={}){
  const mismatch=reason=>{
    const error=new Error('Security deposit capture cannot be reconciled: '+reason);
    error.code='DEPOSIT_CAPTURE_RECONCILIATION_REQUIRED';
    throw error;
  };
  const expected=Number(amountCents);
  if(!Number.isSafeInteger(expected)||expected<=0)mismatch('invalid requested amount');
  if(String(result?.id||'')!==String(paymentIntentId||''))mismatch('payment intent mismatch');
  if(String(result?.status||'')!=='succeeded')mismatch('capture not succeeded');
  if(Number(result?.amount_received)!==expected)mismatch('received amount differs from capture amount');
  if(String(result?.currency||'').toLowerCase()!=='eur')mismatch('currency mismatch');
  if(String(result?.metadata?.bookingId||'')!==String(bookingId||''))mismatch('booking mismatch');
  if(String(result?.metadata?.purpose||'')!=='security_deposit')mismatch('purpose mismatch');
  return result;
}
