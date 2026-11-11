// Provider-backed cancellation must fail closed unless Stripe confirms the
// exact PaymentIntent was cancelled. Never infer success from HTTP 200 alone.
export function assertCancelledPaymentIntent(actual,expectedId,{deposit=false}={}){
  if(String(actual?.id||'')===String(expectedId||'') && String(actual?.status||'')==='canceled')
    return actual;
  const error=new Error(deposit
    ?'Stripe deposit cancellation is not confirmed; manual reconciliation required'
    :'Stripe payment cancellation is not confirmed; manual reconciliation required');
  error.code=deposit?'DEPOSIT_CANCELLATION_UNCONFIRMED':'PAYMENT_CANCELLATION_UNCONFIRMED';
  throw error;
}
