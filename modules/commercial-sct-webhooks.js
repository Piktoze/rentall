// Called ONLY after server-side Stripe signature verification. Provider objects
// are re-read in the pinned platform account; webhook bodies cannot authorize money.
const oid=v=>typeof v==='string'?v:v?.id;
const fail=code=>{throw Object.assign(new Error(code),{code});};
export function createCommercialWebhookHandler({db,stripe,runtime,platformAccount}){
 db.exec(`CREATE TABLE IF NOT EXISTS commercial_sct_events(event_id TEXT PRIMARY KEY,event_type TEXT NOT NULL,object_id TEXT NOT NULL,status TEXT NOT NULL)`);
 const inFlight=new Set();
 return async function handleVerifiedEvent(event){
  const object=event?.data?.object;
  if(!event?.id?.startsWith('evt_')||typeof event.type!=='string'||!object?.id)fail('COMMERCIAL_EVENT_INVALID');
  if(!['payment_intent.succeeded','payment_intent.payment_failed','refund.created','refund.updated','refund.failed','charge.dispute.created','charge.dispute.updated','charge.dispute.closed'].includes(event.type))return {handled:false};
  const intentId=event.type.startsWith('payment_intent.')?object.id:oid(object.payment_intent);
  const matches=intentId?db.prepare('SELECT booking_id FROM commercial_sct_bindings WHERE payment_intent_id=? LIMIT 2').all(intentId):[];
  const byMetadata=object.metadata?.bookingId;
  const bookingId=matches.length===1?matches[0].booking_id:byMetadata;
  if(!bookingId||!runtime.owned(bookingId))return {handled:false};
  if(event.account!=null||event.livemode!==true||object.livemode===false)fail('COMMERCIAL_PLATFORM_LIVE_EVENT_REQUIRED');
  if(matches.length!==1||matches[0].booking_id!==bookingId||
   (byMetadata&&byMetadata!==bookingId))fail('COMMERCIAL_EVENT_BINDING_MISMATCH');
  const prior=db.prepare('SELECT * FROM commercial_sct_events WHERE event_id=?').get(event.id);
  if(prior&&(prior.event_type!==event.type||prior.object_id!==object.id))fail('COMMERCIAL_EVENT_IDENTITY_CONFLICT');
  if(prior?.status==='processed')return {handled:true,duplicate:true};
  if(inFlight.has(event.id))fail('COMMERCIAL_EVENT_BUSY');inFlight.add(event.id);
  try{
   db.prepare("INSERT INTO commercial_sct_events VALUES(?,?,?,'processing') ON CONFLICT(event_id) DO UPDATE SET status='processing'").run(event.id,event.type,object.id);
   if(event.type==='payment_intent.succeeded')await runtime.settle(bookingId);
   else if(['refund.created','refund.updated','refund.failed'].includes(event.type)){
    const command=db.prepare("SELECT * FROM commercial_sct_commands WHERE booking_id=? AND kind='refund'").get(bookingId);
    if(!command||(command.provider_id&&command.provider_id!==object.id)){runtime.setHold(bookingId,'External refund requires ledger reconciliation');fail('COMMERCIAL_EXTERNAL_REFUND_REQUIRES_REVIEW');}
    // Recovery retrieves the actual refund; a pending/failed readback cannot be marked succeeded.
    await runtime.recover(bookingId,'refund');
   }else if(event.type.startsWith('charge.dispute.')){
    const dispute=await stripe.disputes.retrieve(object.id);
    const charge=await stripe.charges.retrieve(oid(dispute.charge));
    const binding=db.prepare('SELECT * FROM commercial_sct_bindings WHERE booking_id=?').get(bookingId);
    if(dispute.id!==object.id||dispute.livemode===false||dispute.currency!=='eur'||
     !Number.isSafeInteger(dispute.amount)||dispute.amount<=0||dispute.amount>binding.amount_cents||
     oid(dispute.payment_intent)!==intentId||charge.livemode!==true||
     oid(charge.payment_intent)!==intentId||charge.id!==oid(dispute.charge)||
     binding.platform_account!==platformAccount)fail('COMMERCIAL_DISPUTE_READBACK_MISMATCH');
    // Even closed/won disputes retain the hold until an independently reviewed ledger reconciliation.
    runtime.setHold(bookingId,'Stripe dispute '+dispute.id+' requires ledger reconciliation');
   }else if(event.type==='payment_intent.payment_failed'){
    // Neither a failed webhook nor a failed attempt proves the absence of a later payment.
    // Keep the unpaid intent reusable; no cancellation or refund is inferred here.
    const intent=await stripe.paymentIntents.retrieve(intentId);
    if(intent.id!==intentId||intent.livemode!==true)fail('COMMERCIAL_INTENT_READBACK_MISMATCH');
   }else return {handled:false};
   db.prepare("UPDATE commercial_sct_events SET status='processed' WHERE event_id=?").run(event.id);
   return {handled:true};
  }catch(error){db.prepare("UPDATE commercial_sct_events SET status='failed' WHERE event_id=?").run(event.id);throw error;}
  finally{inFlight.delete(event.id);}
 };
}
