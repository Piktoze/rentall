// Authoritative SCT TEST payment reconciliation. No booking mutations, transfers
// or refunds occur in this module. A Stripe webhook is only a hint, never proof.
// Caller supplies a trusted immutable SCT binding and a platform TEST Stripe client.
const id=(v,prefix)=>typeof v==='string'&&new RegExp('^'+prefix+'[A-Za-z0-9]+$').test(v);
const objectId=v=>typeof v==='string'?v:v?.id;
const completeList=v=>Array.isArray(v?.data)&&v.has_more===false;

// Platform-wide transfer history is paginated: a successful first page is not
// sufficient evidence that no earlier, ungrouped transfer used this Charge.
// Refuse incomplete pages, unexpected IDs, repeated cursors and excessive
// history. This is deliberately read-only and fail-closed.
export async function readCompletePlatformTestTransferHistory(stripe,{maxPages=20}={}){
  if(typeof stripe?.transfers?.list!=='function'||
     !Number.isSafeInteger(maxPages)||maxPages<1||maxPages>20)
    return {blocked:'invalid_transfer_history_reader'};
  const all=[];
  const seen=new Set();
  let cursor;
  for(let pageIndex=0;pageIndex<maxPages;pageIndex++){
    let page;
    try{
      page=await stripe.transfers.list(cursor?{limit:100,starting_after:cursor}:{limit:100});
    }catch{
      return {blocked:'platform_transfer_history_unavailable'};
    }
    if(!Array.isArray(page?.data)||typeof page.has_more!=='boolean'||
       page.data.length>100||
       (page.has_more&&page.data.length===0))
      return {blocked:'platform_transfer_history_incomplete'};
    for(const transfer of page.data){
      if(!id(transfer?.id,'tr_')||seen.has(transfer.id))
        return {blocked:'platform_transfer_history_invalid_cursor'};
      seen.add(transfer.id);
      all.push(transfer);
    }
    if(!page.has_more)return {data:all,has_more:false};
    const next=page.data.at(-1)?.id;
    if(!id(next,'tr_')||next===cursor)
      return {blocked:'platform_transfer_history_invalid_cursor'};
    cursor=next;
  }
  return {blocked:'platform_transfer_history_page_limit'};
}

export function verifySctTestPaymentEvidence(binding,evidence){
  if(!binding||binding.livemode!==false||!/^RB-[A-Za-z0-9-]+$/.test(binding.id||'')||
     !id(binding.paymentIntentId,'pi_')||!id(binding.destination,'acct_')||
     !Number.isSafeInteger(binding.amountCents)||binding.amountCents<50||
     !Number.isSafeInteger(binding.feeCents)||binding.feeCents<0||
     binding.feeCents>=binding.amountCents)return {blocked:'invalid_booking_binding'};
  const {intent,charge,refunds,disputes,transfers,platformTransfers}=evidence||{};
  if(!intent||!charge||!completeList(refunds)||!completeList(disputes)||
     !completeList(transfers)||!completeList(platformTransfers))
    return {blocked:'provider_evidence_incomplete'};
  if(intent.livemode!==false||charge.livemode!==false||
     intent.id!==binding.paymentIntentId||intent.status!=='succeeded'||
     intent.currency!=='eur'||intent.amount!==binding.amountCents||
     intent.amount_received!==binding.amountCents||
     intent.metadata?.bookingId!==binding.id||
     intent.metadata?.listingId!==binding.listingId||
     intent.metadata?.purpose!=='rental_payment'||
     intent.metadata?.paymentFlow!=='separate_charges_and_transfers'||
     intent.metadata?.supplierStripeAccountId!==binding.destination||
     intent.metadata?.commissionCents!==String(binding.feeCents)||
     intent.transfer_data!=null||intent.application_fee_amount!=null||
     intent.on_behalf_of!=null||
     !id(charge.id,'ch_')||objectId(intent.latest_charge)!==charge.id||
     objectId(charge.payment_intent)!==intent.id||
     charge.status!=='succeeded'||charge.paid!==true||
     charge.captured!==true||charge.livemode!==false||
     charge.currency!=='eur'||charge.amount!==binding.amountCents||
     charge.amount_captured!==binding.amountCents)
    return {blocked:'provider_payment_binding_mismatch'};
  if(charge.refunded!==false||charge.disputed!==false||
     charge.amount_refunded!==0||
     refunds.data.length!==0||disputes.data.length!==0)
    return {blocked:'refund_or_dispute_hold'};
  // Even a transfer to another account or an external manual transfer must
  // be reviewed before starting the rental or creating another transfer.
  if(transfers.data.length!==0)return {blocked:'existing_transfer_requires_review'};
  // A Stripe Transfer can be created with source_transaction and WITHOUT
  // transfer_group. The group-only list cannot prove the charge was unused.
  // Only an EXHAUSTIVE account-wide list (has_more:false) is accepted.
  // For unrelated transfers keep the original accounting data intact; inspect
  // charge, group and booking metadata to detect transfers outside the group.
  const sourceUsed=platformTransfers.data.some(t=>{
    const source=objectId(t?.source_transaction);
    return source===charge.id || t?.transfer_group===binding.id ||
      t?.metadata?.bookingId===binding.id ||
      t?.metadata?.paymentIntentId===intent.id;
  });
  if(sourceUsed)return {blocked:'existing_ungrouped_transfer_requires_review'};
  return {ok:true,bookingId:binding.id,paymentIntentId:intent.id,
    chargeId:charge.id,amountCents:binding.amountCents,
    feeCents:binding.feeCents,supplierCents:binding.amountCents-binding.feeCents};
}

export async function reconcileIsolatedSctTestPayment({stripe,stripeMode,binding}={}){
  if(stripeMode!=='test'||!stripe?.paymentIntents?.retrieve||
     !stripe?.charges?.retrieve||!stripe?.refunds?.list||
     !stripe?.disputes?.list||!stripe?.transfers?.list)
    return {blocked:'test_platform_provider_required'};
  if(binding?.livemode!==false||!id(binding.paymentIntentId,'pi_'))
    return {blocked:'invalid_booking_binding'};
  try{
    // All requests run in the PLATFORM account context: no stripeAccount option.
    // The lists must be complete; a single page that has_more cannot certify zero.
    const intent=await stripe.paymentIntents.retrieve(binding.paymentIntentId);
    const chargeId=objectId(intent?.latest_charge);
    if(!id(chargeId,'ch_'))return {blocked:'provider_charge_missing'};
    const charge=await stripe.charges.retrieve(chargeId);
    const [refunds,disputes,transfers,platformTransfers]=await Promise.all([
      stripe.refunds.list({charge:chargeId,limit:100}),
      stripe.disputes.list({charge:chargeId,limit:100}),
      stripe.transfers.list({transfer_group:binding.id,limit:100}),
      readCompletePlatformTestTransferHistory(stripe),
    ]);
    if(platformTransfers.blocked)return platformTransfers;
    return verifySctTestPaymentEvidence(binding,{
      intent,charge,refunds,disputes,transfers,platformTransfers,
    });
  }catch{
    return {blocked:'provider_reconciliation_unavailable'};
  }
}
