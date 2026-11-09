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
 saveStripeConnection,setBookingPaymentDetails,closeDatabase}=await import('./db.js');
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
  events:database.prepare("SELECT event_id,status FROM webhook_events WHERE event_id LIKE 'evt_webhook_e2e_%' ORDER BY event_id").all(),
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
 const wrong=await post(event('evt_webhook_e2e_wrong_account','acct_different_merchant'));
 assert.equal(wrong.status,200,'Wrong-account event is accepted but ignored');
 assert.equal(read().booking.payment_status,'requires_payment_method','Wrong connected account cannot pay booking');
 const valid=event('evt_webhook_e2e_valid',accountId);
 const good=await post(valid,{connect:true});assert.equal(good.status,200,'Valid Connect-signed event');
 assert.equal(read().booking.payment_status,'paid','Valid account-bound signed event pays booking');
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

 const recorded=read().events;
 assert.equal(recorded.find(x=>x.event_id===valid.id)?.status,'processed');
 console.log('PASS signed webhook HTTP E2E: bad signature denied, account binding enforced, paid booking persisted, replay and cross-endpoint delivery deduplicated');
}finally{
 child.kill('SIGTERM');
 await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);setTimeout(resolve,3000).unref()});
 fs.rmSync(folder,{recursive:true,force:true});
}
