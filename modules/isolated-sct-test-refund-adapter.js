// Isolated platform SCT refund adapter. Not imported by server.js.
// Requires a caller-attested Stripe TEST secret; never supply real keys in code
// or invoke this from public routes. LIVE key mode is always rejected.
const match=(v,prefix)=>typeof v==='string'&&new RegExp('^'+prefix+'[A-Za-z0-9]+$').test(v);

export function makeIsolatedSctTestRefundAdapter({stripe,stripeMode,stripeSecretKey}={}){
  if(stripeMode!=='test'||!/^sk_test_[A-Za-z0-9_-]{8,}$/.test(stripeSecretKey||'')||
     // When SDK exposes its configured API key, require a matching key.
     stripe?._apiKey!==stripeSecretKey||
     typeof stripe?.refunds?.create!=='function'||
     typeof stripe?.refunds?.retrieve!=='function')
    return {blocked:'trusted_platform_test_stripe_client_required'};
  return {
    async createRefund(plan){
      const r=plan?.refund;
      if(!match(r?.charge,'ch_')||
         !match(r?.metadata?.paymentIntentId,'pi_')||
         !/^RB-[A-Za-z0-9-]+$/.test(r?.metadata?.bookingId||'')||
         plan.idempotencyKey!==`booking:${r.metadata.bookingId}:sct-full-refund:v1`||
         r.metadata.purpose!=='sct_rental_full_refund'||
         r.reason!=='requested_by_customer'||
         !Number.isSafeInteger(r.amount)||r.amount<50)
        return {blocked:'invalid_refund_plan'};
      // Deliberately no stripeAccount option: platform owns the charge/refund.
      const created=await stripe.refunds.create(r,{idempotencyKey:plan.idempotencyKey});
      if(!match(created?.id,'re_'))
        return {blocked:'refund_provider_result_unknown'};
      return {refundId:created.id};
    },
    async retrieveRefund(refundId){
      if(!match(refundId,'re_'))return {blocked:'invalid_refund_id'};
      const refund=await stripe.refunds.retrieve(refundId);
      if(refund?.id!==refundId||refund.livemode!==false)
        return {blocked:'refund_provider_binding_mismatch'};
      return refund;
    },
  };
}
