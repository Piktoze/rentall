// Isolated signed-webhook integration test. No Railway, live Stripe, or external API calls.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import Database from 'better-sqlite3';
const webhookSource=fs.readFileSync('./server.js','utf8');
assert.match(webhookSource,/process\.env\.STRIPE_CONNECT_WEBHOOK_SECRET/,
 'Separate Connect webhook signing secret must be supported');
assert.match(webhookSource,/if\s*\(!signingSecrets\.length\)/,
 'Missing both webhook signing secrets must fail closed');
assert.doesNotMatch(webhookSource,/event = JSON\.parse\(req\.body\.toString\('utf8'\)\)/,
 'Unsigned webhook JSON fallback is prohibited');

const folder=fs.mkdtempSync(path.join(os.tmpdir(),'rio-webhook-e2e-'));
const dbPath=path.join(folder,'fixture.sqlite');
const email='webhook-e2e-supplier@example.invalid';
const bookingId='webhook-e2e-booking';
const accountId='acct_test_webhook_e2e';
const paymentIntentId='pi_test_webhook_e2e';
const secret='whsec_webhook_e2e_fake_local_only';
const connectSecret='whsec_connect_webhook_e2e_fake_local_only';
const env={...process.env,DB_PATH:dbPath,UPLOADS_DIR:path.join(folder,'uploads'),
 NODE_ENV:'test',RENTINORBIT_STAGING:'true',RENTINORBIT_DEMO_PAYMENTS:'false',
 EMAIL_WORKER_ENABLED:'false',BACKUP_SCHEDULER_ENABLED:'false',
 RENTALL_SEED_DEMO_USERS:'false',STRIPE_SECRET_KEY:'sk_test_local_webhook_fixture',
 STRIPE_WEBHOOK_SECRET:secret,STRIPE_CONNECT_WEBHOOK_SECRET:connectSecret,STRIPE_MODE:'test'};
for(const key of ['RAILWAY_ENVIRONMENT_ID','RAILWAY_PROJECT_ID','RAILWAY_SERVICE_ID',
 'RAILWAY_VOLUME_MOUNT_PATH','PERSISTENT_DATA_DIR','DATABASE_URL','RENTINORBIT_DB_PATH',
 'STRIPE_PUBLISHABLE_KEY','RESEND_API_KEY','APP_URL','PUBLIC_BASE_URL','PORT','HOST'])
 delete env[key];
const previous={...process.env};
for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];
Object.assign(process.env,env);
const {db,createAppUser,upsertRentalListing,createRentalBookingAtomic,
 saveStripeConnection,setBookingPaymentDetails,closeDatabase,
 beginWebhookEvent,markWebhookFailed,claimWebhookRetry,markWebhookProcessed}=await import('./db.js');
const {saveDirectMerchantMetadata}=await import('./modules/stripe-connect-store-v195.js');
const user=createAppUser({email,password:'TestLocalOnly1!',role:'supplier',displayName:'Webhook fixture'});
saveStripeConnection({userId:user.userId,userEmail:email,stripeAccountId:accountId,connectApi:'v2_merchant_direct'});
saveDirectMerchantMetadata(db,{userId:user.userId,accountId,merchantCapabilityStatus:'active',onboardingStatus:'complete'});
upsertRentalListing({listingId:'webhook-e2e-listing',ownerEmail:email,title:'Temporary webhook fixture',totalQuantity:1});
createRentalBookingAtomic({bookingId,listingId:'webhook-e2e-listing',
 startDate:'2099-10-01',endDate:'2099-10-02',quantity:1,status:'confirmed',
 customerEmail:'webhook-e2e-customer@example.invalid',orderValue:100});
setBookingPaymentDetails({bookingId,paymentIntentId,paymentStatus:'requires_payment_method',
 platformFeeAmount:15,supplierAmount:85,paymentProvider:'stripe'});
// Independent local security deposit fixture; no external Stripe API calls.
const depositBookingId='webhook-e2e-deposit';
const depositPi='pi_test_webhook_deposit';
createRentalBookingAtomic({bookingId:depositBookingId,listingId:'webhook-e2e-listing',
 startDate:'2099-11-01',endDate:'2099-11-02',quantity:1,status:'confirmed',
 customerEmail:'webhook-deposit-customer@example.invalid',orderValue:100});
db.prepare("UPDATE rental_bookings SET security_deposit_amount=50,security_deposit_payment_intent_id=?,security_deposit_status='authorized',security_deposit_provider_status='requires_capture' WHERE booking_id=?")
 .run(depositPi,depositBookingId);

// Persistent retry claims are conditional SQL updates, not a read/write race.
const retryId='evt_retry_claim_atomic_e2e';
assert.equal(beginWebhookEvent({eventId:retryId,type:'payment_intent.succeeded'}).duplicate,false);
markWebhookFailed(retryId,'simulated recoverable crash');
assert.equal(claimWebhookRetry(retryId).claimed,true,'First retry owns failed event');
assert.equal(claimWebhookRetry(retryId).claimed,false,'Second retry cannot reclaim an active event');
db.prepare("UPDATE webhook_events SET processing_started_at=? WHERE event_id=?")
 .run('2020-01-01T00:00:00.000Z',retryId);
assert.equal(claimWebhookRetry(retryId,{staleMinutes:5}).claimed,true,
 'Orphaned processing event can be reclaimed after timeout');
assert.equal(claimWebhookRetry(retryId).claimed,false,
 'Recovered event must be owned by only one worker');
markWebhookProcessed(retryId);
assert.equal(claimWebhookRetry(retryId).claimed,false,'Processed event cannot be reclaimed');
closeDatabase();
for(const key of Object.keys(process.env))delete process.env[key];
Object.assign(process.env,previous);

const listener=net.createServer();
const port=await new Promise((resolve,reject)=>{
 listener.once('error',reject);listener.listen(0,'127.0.0.1',()=>{
 const assigned=listener.address().port;listener.close(()=>resolve(assigned));});
});
const base='http://127.0.0.1:'+port;
Object.assign(env,{PORT:String(port),HOST:'127.0.0.1',APP_URL:base,PUBLIC_BASE_URL:base});
const child=spawn(process.execPath,['server.js'],{cwd:process.cwd(),env,stdio:['ignore','pipe','pipe']});
let logs='';
child.stdout.on('data',data=>logs+=String(data).slice(-2000));
child.stderr.on('data',data=>logs+=String(data).slice(-2000));
const event=(id,account)=>({
 id,type:'payment_intent.succeeded',account,livemode:false,
 data:{object:{id:paymentIntentId,object:'payment_intent',amount:10000,currency:'eur',
  status:'succeeded',metadata:{bookingId,purpose:'rental_payment'}}}
});
const read=()=>{
 const database=new Database(dbPath,{readonly:true,fileMustExist:true});
 try{return {booking:database.prepare('SELECT payment_status, stripe_payment_intent_id FROM rental_bookings WHERE booking_id=?').get(bookingId),
  events:database.prepare("SELECT event_id,status,payload_json AS payloadJson FROM webhook_events WHERE event_id LIKE 'evt_webhook_e2e_%' ORDER BY event_id").all(),
  notifications:database.prepare("SELECT audience,type,unique_key FROM rental_notifications WHERE booking_id=? ORDER BY audience,type").all(bookingId),
  outbox:database.prepare("SELECT template_key,dedupe_key FROM email_outbox WHERE dedupe_key LIKE ?").all('%'+paymentIntentId+'%')}}
 finally{database.close()}
};
async function post(evt,{badSignature=false,connect=false}={}){
 const payload=JSON.stringify(evt),t=Math.floor(Date.now()/1000);
 const hash=crypto.createHmac('sha256',connect?connectSecret:secret).update(t+'.'+payload).digest('hex');
 const response=await fetch(base+'/api/stripe/webhook',{method:'POST',
 headers:{'content-type':'application/json','stripe-signature':`t=${t},v1=${badSignature?'0'.repeat(64):hash}`},
 body:payload});
 return {status:response.status,body:await response.text()};
}
try{
 let started=false;
 for(let n=0;n<100;n++){
  if(child.exitCode!==null)throw Error('Local server stopped: '+logs.slice(-1000));
  try{const r=await fetch(base+'/healthz');if(r.ok){started=true;break}}catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 assert.ok(started,'Local server startup: '+logs.slice(-1000));
 const invalid=await post(event('evt_webhook_e2e_bad_signature',accountId),{badSignature:true});
 assert.equal(invalid.status,400,'Unsigned/invalid event must be rejected');
 assert.equal(read().booking.payment_status,'requires_payment_method');
 const wrongModeEvent={...event('evt_webhook_e2e_wrong_mode',accountId),livemode:true};
 const wrongMode=await post(wrongModeEvent,{connect:true});
 assert.equal(read().booking.payment_status,'requires_payment_method',
   'An event from the wrong Stripe mode must not mark the booking paid');
 assert.equal(wrongMode.status,400,'A signed event from the wrong Stripe mode must be rejected');
 assert.ok(!read().events.some(row=>row.event_id===wrongModeEvent.id),
   'Wrong-mode events must not claim a webhook idempotency record');
 const wrong=await post(event('evt_webhook_e2e_wrong_account','acct_different_merchant'));
 assert.equal(wrong.status,200,'Wrong-account event is accepted but ignored');
 assert.equal(read().booking.payment_status,'requires_payment_method','Wrong connected account cannot pay booking');
 // A correctly signed event missing explicit rental_payment purpose must not
 // mark the booking paid: an intent ID and amount alone do not prove its purpose.
 const missingPurpose=event('evt_webhook_e2e_missing_purpose',accountId);
 delete missingPurpose.data.object.metadata.purpose;
 const missing=await post(missingPurpose,{connect:true});
 assert.equal(missing.status,200,'Missing-purpose signed event is accepted but ignored');
 assert.equal(read().booking.payment_status,'requires_payment_method',
   'Missing-purpose Stripe intent cannot mark booking paid');
 const valid=event('evt_webhook_e2e_valid',accountId);
 // Signed Stripe objects may include customer PII and client secrets; do not
 // persist them in webhook audit history.
 valid.data.object.billing_details={email:'audit-private@example.invalid'};
 valid.data.object.client_secret='audit-test-secret-must-not-be-stored';
 const good=await post(valid,{connect:true});
  assert.equal(good.status,200,
    'Valid Connect-signed event: HTTP '+good.status+' response='+good.body.slice(0,900)+
    ' localServerLog='+logs.slice(-1800));
 assert.equal(read().booking.payment_status,'paid','Valid account-bound signed event pays booking');
 const storedAudit=read().events.find(row=>row.event_id===valid.id);
 assert.ok(storedAudit,'Signed event must have persistent audit record');
 assert.equal(storedAudit.status,'processed');
 assert.ok(!storedAudit.payloadJson.includes('audit-private@example.invalid'),
  'Audit must not persist customer email from Stripe event');
 assert.ok(!storedAudit.payloadJson.includes('audit-test-secret-must-not-be-stored'),
  'Audit must not persist client secret');
 assert.equal(JSON.parse(storedAudit.payloadJson).objectId,paymentIntentId,
  'Audit must retain useful provider object correlation');
 const duplicate=await post(valid);assert.equal(duplicate.status,200);
 assert.equal(JSON.parse(duplicate.body).duplicate,true,'Webhook replay is idempotent');
 assert.equal(read().booking.payment_status,'paid');
 // Stripe can deliver the same underlying charge through multiple endpoints
 // with distinct event IDs: business effects must stay deduplicated by PI.
 const beforeSecondDelivery=read();
 assert.equal(beforeSecondDelivery.notifications.length,2,'Customer and supplier receive one notice each');
 assert.equal(beforeSecondDelivery.outbox.length,2,'Customer and supplier receive one email each');
 const secondDelivery=await post(event('evt_webhook_e2e_other_endpoint',accountId),{connect:true});
 assert.equal(secondDelivery.status,200,'Distinct Stripe event for same PaymentIntent should be accepted');
 const afterSecondDelivery=read();
 assert.equal(afterSecondDelivery.booking.payment_status,'paid');
 assert.equal(afterSecondDelivery.notifications.length,beforeSecondDelivery.notifications.length,'No duplicate booking notifications');
 assert.equal(afterSecondDelivery.outbox.length,beforeSecondDelivery.outbox.length,'No duplicate payment emails');
 // Stripe can deliver a stale payment_failed event after the same PaymentIntent
 // was marked paid or refunded. It must never downgrade financial state.
 const failedEvent=id=>({...event(id,accountId),type:'payment_intent.payment_failed',
   data:{object:{...event(id,accountId).data.object,status:'requires_payment_method'}}});
 const afterPaidFailed=await post(failedEvent('evt_webhook_e2e_failed_after_paid'),{connect:true});
 assert.equal(afterPaidFailed.status,200);
 assert.equal(read().booking.payment_status,'paid','Late failed webhook must not downgrade paid booking');
 const fixtureDb=new Database(dbPath);
 try{
  fixtureDb.prepare("UPDATE rental_bookings SET payment_status='refunded' WHERE booking_id=?").run(bookingId);
 }finally{fixtureDb.close();}
 const afterRefundFailed=await post(failedEvent('evt_webhook_e2e_failed_after_refund'),{connect:true});
 assert.equal(afterRefundFailed.status,200);
 assert.equal(read().booking.payment_status,'refunded','Late failed webhook must not downgrade refunded booking');
 assert.equal(read().notifications.length,beforeSecondDelivery.notifications.length,
   'Late failure must not create misleading failure notifications');
 const afterRefundSuccess=await post(event('evt_webhook_e2e_success_after_refund',accountId),{connect:true});
 assert.equal(afterRefundSuccess.status,200);
 assert.equal(read().booking.payment_status,'refunded',
   'Delayed succeeded webhook must not reopen a refunded booking');
 assert.equal(read().notifications.length,beforeSecondDelivery.notifications.length,
   'Delayed success must not re-notify the renter or supplier as newly paid');

 // Stripe's refund.updated/failed events reconcile an earlier pending
 // cancellation refund without exposing or touching any real provider account.
 const refundId='re_test_local_webhook_refund';
 const refundDb=new Database(dbPath);
 try{
   refundDb.prepare("UPDATE rental_bookings SET payment_status='paid',stripe_refund_id=?,refund_status='pending',refund_amount=100 WHERE booking_id=?")
     .run(refundId,bookingId);
 }finally{refundDb.close();}
 const refundEvent=(id,account,status,overrides={})=>({
   id,type:status==='failed'?'refund.failed':'refund.updated',account,livemode:false,
   data:{object:{id:refundId,object:'refund',payment_intent:paymentIntentId,
     amount:10000,currency:'eur',status,metadata:{bookingId},...overrides}}
 });
 const refundState=()=>{
   const database=new Database(dbPath,{readonly:true,fileMustExist:true});
   try{return database.prepare("SELECT payment_status,refund_status FROM rental_bookings WHERE booking_id=?").get(bookingId)}
   finally{database.close()}
 };
 assert.equal((await post(refundEvent('evt_refund_wrong_account','acct_wrong','succeeded'),{connect:true})).status,200);
 assert.equal(refundState().refund_status,'pending','Wrong connected account cannot settle refund');
 assert.equal((await post(refundEvent('evt_refund_wrong_intent',accountId,'succeeded',
   {payment_intent:'pi_other'}),{connect:true})).status,200);
 assert.equal(refundState().refund_status,'pending','Wrong payment intent cannot settle refund');
 assert.equal((await post(refundEvent('evt_refund_wrong_amount',accountId,'succeeded',
   {amount:9999}),{connect:true})).status,200);
 assert.equal(refundState().refund_status,'pending','Wrong refund amount cannot settle refund');
 assert.equal((await post(refundEvent('evt_refund_succeeded',accountId,'succeeded'),{connect:true})).status,200);
 assert.equal(refundState().refund_status,'succeeded','Signed refund success must settle refund');
 assert.equal(refundState().payment_status,'refunded','Fully refunded charge must be marked refunded');
 const countAfterRefund=read().notifications.length;
 assert.equal((await post(refundEvent('evt_refund_stale_pending',accountId,'pending'),{connect:true})).status,200);
 assert.equal(refundState().refund_status,'succeeded','Stale pending update must not downgrade succeeded refund');
 assert.equal((await post(refundEvent('evt_refund_stale_failed',accountId,'failed'),{connect:true})).status,200);
 assert.equal(refundState().refund_status,'succeeded','Stale failed update must not downgrade succeeded refund');
 assert.equal(read().notifications.length,countAfterRefund,'Stale refund events must not duplicate notifications');
 // A separate refund-failure scenario must preserve paid funds status.
 const failedDb=new Database(dbPath);
 try{
   failedDb.prepare("UPDATE rental_bookings SET payment_status='paid',refund_status='pending' WHERE booking_id=?").run(bookingId);
 }finally{failedDb.close();}
 assert.equal((await post(refundEvent('evt_refund_failed_new',accountId,'failed'),{connect:true})).status,200);
 assert.equal(refundState().refund_status,'failed','Signed refund failure must be recorded');
 assert.equal(refundState().payment_status,'paid','Failed refund must not be marked refunded');
 const notificationsAfterFailure=read().notifications.length;
 assert.equal((await post(refundEvent('evt_refund_late_pending_after_failed',accountId,'pending'),{connect:true})).status,200);
 assert.equal(refundState().refund_status,'failed',
   'Late pending event must never reopen failed refund');
 assert.equal(refundState().payment_status,'paid',
   'Failed refund must remain collected after late pending update');
 assert.equal(read().notifications.length,notificationsAfterFailure,
   'Late pending refund must not add contradictory notifications');
 const cancelledDb=new Database(dbPath);
 try{
   cancelledDb.prepare("UPDATE rental_bookings SET payment_status='paid',refund_status='pending' WHERE booking_id=?").run(bookingId);
 }finally{cancelledDb.close()}
 assert.equal((await post(refundEvent('evt_refund_canceled_terminal',accountId,'canceled'),{connect:true})).status,200);
 assert.equal(refundState().refund_status,'canceled','Canceled refund must remain terminal');
 assert.equal((await post(refundEvent('evt_refund_late_pending_after_canceled',accountId,'pending'),{connect:true})).status,200);
 assert.equal(refundState().refund_status,'canceled',
   'Late pending event must not reopen canceled refund');
 assert.equal(refundState().payment_status,'paid',
   'Canceled refund must not falsely mark payment refunded');

 const depositEvent=(id,type,account=accountId)=>({
   id,type,account,livemode:false,
   data:{object:{id:depositPi,object:'payment_intent',amount:5000,currency:'eur',
     status:type==='payment_intent.canceled'?'canceled':'requires_capture',
     metadata:{bookingId:depositBookingId,purpose:'security_deposit'}}}
 });
 const depositStatus=()=>{
   const snapshot=new Database(dbPath,{readonly:true,fileMustExist:true});
   try{return snapshot.prepare("SELECT security_deposit_status AS status,security_deposit_provider_status AS provider FROM rental_bookings WHERE booking_id=?").get(depositBookingId)}
   finally{snapshot.close()}
 };
 assert.equal((await post(depositEvent('evt_dep_canceled','payment_intent.canceled'),{connect:true})).status,200);
 assert.equal(depositStatus().status,'released','Verified cancellation releases deposit');
 assert.equal((await post(depositEvent('evt_dep_stale_authorized','payment_intent.amount_capturable_updated'),{connect:true})).status,200);
 assert.equal(depositStatus().status,'released','Late authorized event must not reopen released deposit');
 assert.equal(depositStatus().provider,'canceled','Late authorized event must not downgrade provider status');
 const capturedDb=new Database(dbPath);
 try{capturedDb.prepare("UPDATE rental_bookings SET security_deposit_status='captured',security_deposit_provider_status='succeeded' WHERE booking_id=?").run(depositBookingId)}
 finally{capturedDb.close()}
 assert.equal((await post(depositEvent('evt_dep_stale_canceled_after_capture','payment_intent.canceled'),{connect:true})).status,200);
 assert.equal(depositStatus().status,'captured','Late canceled event must not erase captured deposit');
 assert.equal(depositStatus().provider,'succeeded');
 assert.equal((await post(depositEvent('evt_dep_stale_authorized_after_capture','payment_intent.amount_capturable_updated'),{connect:true})).status,200);
 assert.equal(depositStatus().status,'captured','Late authorized event must not reopen captured deposit');
 console.log('PASS signed security deposit webhook ordering: released and captured remain terminal under stale events');
 console.log('PASS signed refund webhook HTTP: account, intent and amount binding; settled, failed and out-of-order states');
 const recorded=read().events;
 assert.equal(recorded.find(x=>x.event_id===valid.id)?.status,'processed');
 console.log('PASS signed webhook HTTP E2E: bad signature denied, account binding enforced, paid booking persisted, replay and cross-endpoint delivery deduplicated');
}finally{
 child.kill('SIGTERM');
 await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);setTimeout(resolve,3000).unref()});
 fs.rmSync(folder,{recursive:true,force:true});
}
