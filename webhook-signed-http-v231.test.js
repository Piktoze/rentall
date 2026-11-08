// Isolated signed-webhook integration test. No Railway, live Stripe, or external API calls.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import Database from 'better-sqlite3';

const folder=fs.mkdtempSync(path.join(os.tmpdir(),'rio-webhook-e2e-'));
const dbPath=path.join(folder,'fixture.sqlite');
const email='webhook-e2e-supplier@example.invalid';
const bookingId='webhook-e2e-booking';
const accountId='acct_test_webhook_e2e';
const paymentIntentId='pi_test_webhook_e2e';
const secret='whsec_webhook_e2e_fake_local_only';
const env={...process.env,DB_PATH:dbPath,UPLOADS_DIR:path.join(folder,'uploads'),
 NODE_ENV:'test',RENTINORBIT_STAGING:'true',RENTINORBIT_DEMO_PAYMENTS:'false',
 EMAIL_WORKER_ENABLED:'false',BACKUP_SCHEDULER_ENABLED:'false',
 RENTALL_SEED_DEMO_USERS:'false',STRIPE_SECRET_KEY:'sk_test_local_webhook_fixture',
 STRIPE_WEBHOOK_SECRET:secret,STRIPE_MODE:'test'};
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
  events:database.prepare("SELECT event_id,status FROM webhook_events WHERE event_id LIKE 'evt_webhook_e2e_%' ORDER BY event_id").all()}}
 finally{database.close()}
};
async function post(evt,{badSignature=false}={}){
 const payload=JSON.stringify(evt),t=Math.floor(Date.now()/1000);
 const hash=crypto.createHmac('sha256',secret).update(t+'.'+payload).digest('hex');
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
 const good=await post(valid);assert.equal(good.status,200,'Valid signed event');
 assert.equal(read().booking.payment_status,'paid','Valid account-bound signed event pays booking');
 const duplicate=await post(valid);assert.equal(duplicate.status,200);
 assert.equal(JSON.parse(duplicate.body).duplicate,true,'Webhook replay is idempotent');
 assert.equal(read().booking.payment_status,'paid');
 const recorded=read().events;
 assert.equal(recorded.find(x=>x.event_id===valid.id)?.status,'processed');
 console.log('PASS signed webhook HTTP E2E: bad signature denied, account binding enforced, paid booking persisted, replay idempotent');
}finally{
 child.kill('SIGTERM');
 await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);setTimeout(resolve,3000).unref()});
 fs.rmSync(folder,{recursive:true,force:true});
}
