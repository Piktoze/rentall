// Real HTTP multi-account rental handover test. Runs on a disposable local database.
// No Railway volume, remote Stripe, production, email worker or external endpoints.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';

const folder=fs.mkdtempSync(path.join(os.tmpdir(),'rentinorbit-api-e2e-'));
const dbPath=path.join(folder,'integration.sqlite');
const env={...process.env,DB_PATH:dbPath,UPLOADS_DIR:path.join(folder,'uploads'),NODE_ENV:'test',RENTINORBIT_STAGING:'true',
  RENTINORBIT_DEMO_PAYMENTS:'true',RENTINORBIT_PREAUTH_ENABLED:'true',EMAIL_WORKER_ENABLED:'false',BACKUP_SCHEDULER_ENABLED:'false',
  RENTALL_SEED_DEMO_USERS:'false'};
for(const k of ['RAILWAY_ENVIRONMENT_ID','RAILWAY_PROJECT_ID','RAILWAY_SERVICE_ID',
  'RAILWAY_VOLUME_MOUNT_PATH','PERSISTENT_DATA_DIR','DATABASE_URL','RENTINORBIT_DB_PATH',
  'STRIPE_SECRET_KEY','STRIPE_PUBLISHABLE_KEY','STRIPE_WEBHOOK_SECRET','RESEND_API_KEY',
  'SESSION_SECRET','APP_URL','PUBLIC_BASE_URL','PORT','HOST'])delete env[k];
const previous={...process.env};
for(const k of Object.keys(process.env)){if(!(k in env))delete process.env[k];}
Object.assign(process.env,env);
const {db,createAppUser,upsertRentalListing,createRentalBookingAtomic,
  setBookingPaymentDetails,createRentalAgreement}=await import('./db.js');
const supplier='api-e2e-supplier@example.invalid',renter='api-e2e-renter@example.invalid',
  outsider='api-e2e-outsider@example.invalid',password='Testing12345!',id='api-e2e-1';
for(const [email,role] of [[supplier,'supplier'],[renter,'customer'],[outsider,'customer']])
  createAppUser({email,password,role,displayName:'E2E Test'});
upsertRentalListing({listingId:'api-e2e-listing',ownerEmail:supplier,title:'Temporary API test item',totalQuantity:1});
createRentalBookingAtomic({bookingId:id,listingId:'api-e2e-listing',startDate:'2099-06-01',
  endDate:'2099-06-02',quantity:1,status:'confirmed',customerEmail:renter,customerName:'API Renter',orderValue:100});
setBookingPaymentDetails({bookingId:id,paymentIntentId:'pi_test_mock_not_stripe',paymentStatus:'paid',
  paymentProvider:'mock',platformFeeAmount:15,supplierAmount:85});
createRentalAgreement({bookingId:id,termsVersion:'e2e-v1',snapshot:{listingTitle:'Temporary API test item',total:100}});
const pendingId='api-e2e-pending';
createRentalBookingAtomic({bookingId:pendingId,listingId:'api-e2e-listing',
  startDate:'2099-07-01',endDate:'2099-07-02',quantity:1,status:'pending',
  customerEmail:renter,customerName:'API Renter',orderValue:100});
const payId='api-e2e-payment';
const payFixture=createRentalBookingAtomic({bookingId:payId,listingId:'api-e2e-listing',
  startDate:'2099-06-05',endDate:'2099-06-06',quantity:1,status:'confirmed',
  customerEmail:renter,customerName:'API Renter',orderValue:100});
setBookingPaymentDetails({bookingId:payId,paymentIntentId:'demo_pi_prepared_e2e',
  paymentStatus:'requires_payment_method',paymentProvider:'demo',platformFeeAmount:15,supplierAmount:85});

db.close();
Object.keys(process.env).forEach(k=>delete process.env[k]);
Object.assign(process.env,previous);

const socket=net.createServer();
const port=await new Promise((resolve,reject)=>{
 socket.once('error',reject);socket.listen(0,'127.0.0.1',()=>{const p=socket.address().port;socket.close(()=>resolve(p));});
});
const base='http://127.0.0.1:'+port;
env.PORT=String(port);env.HOST='127.0.0.1';env.APP_URL=base;env.PUBLIC_BASE_URL=base;
const child=spawn(process.execPath,['server.js'],{cwd:process.cwd(),env,stdio:['ignore','pipe','pipe']});
let logs='';
child.stdout.on('data',b=>logs+=String(b).slice(-3000));
child.stderr.on('data',b=>logs+=String(b).slice(-3000));

async function api(url,{method='GET',cookie='',data}={}){
 const response=await fetch(base+url,{method,headers:{...(cookie?{cookie}:{}),...(data?{'content-type':'application/json'}:{})},
   ...(data?{body:JSON.stringify(data)}:{})});
 const body=await response.json().catch(()=>({}));
 return {status:response.status,body,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function signIn(email){
 const r=await api('/api/auth/login',{method:'POST',data:{email,password}});
 assert.equal(r.status,200,'Login: '+email+' '+JSON.stringify(r.body));
 assert.ok(r.cookie?.startsWith('rentinorbit_session='),'Session cookie expected');
 return r.cookie;
}
function status(r,s,label){assert.equal(r.status,s,label+' '+JSON.stringify(r.body));}
let outcome=false;
try{
 let ready=false;
 for(let n=0;n<75;n++){
   if(child.exitCode!==null)throw new Error('Server crashed: '+logs.slice(-2500));
   try{const r=await fetch(base+'/healthz');if(r.ok){ready=true;break}}catch{}
   await new Promise(done=>setTimeout(done,100));
 }
 assert.ok(ready,'Temporary server startup failed: '+logs.slice(-2500));
 // Direct API callers must not bypass legally required account consent.
 const registration={email:'consent-http-e2e@example.invalid',password:'Testing12345!',role:'customer'};
 const rejected=await api('/api/auth/register',{method:'POST',data:registration});
 status(rejected,400,'Account registration without explicit terms acceptance denied');
 assert.equal(rejected.body.code,'TERMS_ACCEPTANCE_REQUIRED');
 const registered=await api('/api/auth/register',{method:'POST',data:{...registration,termsAccepted:true}});
 status(registered,200,'Account registration with explicit terms acceptance succeeds');
 assert.equal(registered.body.user.email,registration.email);
 console.log('PASS HTTP registration requires explicit terms consent');
 const renterCookie=await signIn(renter),supplierCookie=await signIn(supplier),
   outsiderCookie=await signIn(outsider);
 // New public listing must have two to five real uploaded photo files.
 const listingBase={id:'photo-e2e-listing',title:'Photo integration fixture',
   city:'Vilnius',quantity:1,priceDay:12,bookingMode:'request'};
 const publish=photos=>api('/api/supplier/listings',{method:'POST',cookie:supplierCookie,
   data:{listing:{...listingBase,photos,coverPhoto:photos[0]||''}}});
 status(await publish([]),400,'No-photo listing denied');
 status(await publish(['/uploads/not-present.png']),400,'Single-photo listing denied');
 const tinyPng='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/Y4kAAAAASUVORK5CYII=';
 const photos=[];
 for(let i=0;i<2;i++){
   const uploaded=await api('/api/uploads/image',{method:'POST',cookie:supplierCookie,
     data:{dataUrl:tinyPng,fileName:'e2e-photo-'+i+'.png'}});
   status(uploaded,200,'Photo file upload');
   assert.ok(uploaded.body.url?.startsWith('/uploads/'));
   photos.push(uploaded.body.url);
 }
 status(await publish([photos[0]]),400,'One uploaded photo denied');
 status(await publish([...photos,...photos,...photos]),400,'Six uploaded photos denied');
 status(await publish(['/uploads/missing-a.png','/uploads/missing-b.png']),400,'Missing uploaded image denied');
 const published=await publish(photos);
 status(published,200,'Two uploaded photos permit listing publication');
 assert.equal(published.body.listing.photos.length,2);

 // Demo is strictly local: verify authorization and terminal state do not regress.
 // Pending request must never create a TEST or demo payment intent until
 // the supplier has accepted the booking, even if preauth flag is requested.
 const pendingCheckout=await api('/api/payments/create-intent',{method:'POST',cookie:renterCookie,
   data:{bookingId:pendingId}});
 status(pendingCheckout,409,'Pending request checkout must be blocked');
 assert.equal(pendingCheckout.body.code,'SUPPLIER_CONFIRMATION_REQUIRED');
 const approved=await api('/api/rentals/bookings/'+pendingId+'/status',{method:'POST',
   cookie:supplierCookie,data:{status:'confirmed'}});
 status(approved,200,'Supplier approval without prior card authorization');
 const unlocked=await api('/api/payments/create-intent',{method:'POST',cookie:renterCookie,
   data:{bookingId:pendingId}});
 status(unlocked,200,'Payment intent only after supplier approval');
 assert.ok(unlocked.body.paymentIntentId?.startsWith('demo_pi_'));
 const pendingPaid=await api('/api/payments/demo/confirm',{method:'POST',cookie:renterCookie,
   data:{bookingId:pendingId,outcome:'succeeded'}});
 status(pendingPaid,200,'Confirmed rental can complete demo payment');
 assert.equal(pendingPaid.body.booking.paymentStatus,'paid');
 // Guest tokens work only without a different authenticated account.
 const impersonated=await api('/api/payments/create-intent',{method:'POST',cookie:outsiderCookie,
   data:{bookingId:payId,paymentToken:payFixture.paymentToken}});
 status(impersonated,403,'Foreign logged-in account cannot use valid guest payment token');
 const validGuest=await api('/api/payments/create-intent',{method:'POST',
   data:{bookingId:payId,paymentToken:payFixture.paymentToken}});
 status(validGuest,200,'Unauthenticated genuine guest can use booking token');
 const payRoute='/api/payments/demo/confirm';
 status(await api(payRoute,{method:'POST',cookie:outsiderCookie,
   data:{bookingId:payId,outcome:'succeeded'}}),403,'Outsider cannot pay somebody else booking');
 status(await api(payRoute,{method:'POST',cookie:renterCookie,
   data:{bookingId:payId,outcome:'not_a_real_outcome'}}),400,'Unexpected payment result denied');
 const paid=await api(payRoute,{method:'POST',cookie:renterCookie,
   data:{bookingId:payId,outcome:'succeeded'}});
 status(paid,200,'Demo payment first success');
 assert.equal(paid.body.booking.paymentStatus,'paid');
 const twice=await api(payRoute,{method:'POST',cookie:renterCookie,
   data:{bookingId:payId,outcome:'succeeded'}});
 status(twice,409,'Repeat payment confirmation blocked');
 assert.equal(twice.body.code,'BOOKING_PAYMENT_FINAL');
 const downgrade=await api(payRoute,{method:'POST',cookie:renterCookie,
   data:{bookingId:payId,outcome:'failed'}});
 status(downgrade,409,'Paid booking cannot be downgraded to failed');
 assert.equal(downgrade.body.code,'BOOKING_PAYMENT_FINAL');

 const route='/api/rentals/bookings/'+id;
 status(await api(route+'/transfer-code',{method:'POST',cookie:renterCookie,data:{purpose:'pickup'}}),
   409,'Unsigned renter must not receive PIN');
 status(await api(route+'/agreement/accept',{method:'POST',cookie:outsiderCookie,data:{accepted:true}}),
   403,'Outsider cannot sign');
 status(await api(route+'/agreement/accept',{method:'POST',cookie:renterCookie,data:{accepted:false}}),
   400,'Explicit consent required');
 status(await api(route+'/agreement/accept',{method:'POST',cookie:renterCookie,data:{accepted:true}}),
   200,'Renter signs independently');
 status(await api(route+'/transfer-code',{method:'POST',cookie:supplierCookie,data:{purpose:'pickup'}}),
   403,'Supplier must never receive renter PIN');
 const code=await api(route+'/transfer-code',{method:'POST',cookie:renterCookie,data:{purpose:'pickup'}});
 status(code,200,'Renter PIN after own consent');
 assert.match(code.body.code,/^\d{6}$/);
 status(await api(route+'/transfer-confirm',{method:'POST',cookie:supplierCookie,
   data:{purpose:'pickup',code:code.body.code}}),409,'Cannot hand over before supplier signs');
 status(await api(route+'/agreement/accept',{method:'POST',cookie:supplierCookie,data:{accepted:true}}),
   200,'Supplier must sign independently');
 status(await api(route+'/transfer-confirm',{method:'POST',cookie:outsiderCookie,
   data:{purpose:'pickup',code:code.body.code}}),403,'Outsider cannot confirm transfer');
 status(await api(route+'/status',{method:'POST',cookie:supplierCookie,data:{status:'active'}}),
   409,'Legacy activation blocked');
 const pickup=await api(route+'/transfer-confirm',{method:'POST',cookie:supplierCookie,
   data:{purpose:'pickup',code:code.body.code}});
 status(pickup,200,'Pickup');
 assert.equal(pickup.body.booking.status,'active');
 status(await api(route+'/transfer-confirm',{method:'POST',cookie:supplierCookie,
   data:{purpose:'pickup',code:code.body.code}}),409,'Pickup replay blocked');
 status(await api(route+'/return',{method:'POST',cookie:supplierCookie,data:{condition:'good'}}),
   409,'Legacy return blocked');
 status(await api(route+'/transfer-code',{method:'POST',cookie:renterCookie,data:{purpose:'return'}}),
   409,'Renter must not need a return PIN');
 status(await api(route+'/return-confirm',{method:'POST',cookie:outsiderCookie,
   data:{returnCondition:'good'}}),403,'Outsider cannot confirm return');
 status(await api(route+'/transfer-confirm',{method:'POST',cookie:supplierCookie,
   data:{purpose:'return',code:code.body.code,returnCondition:'good'}}),409,'Legacy return PIN route disabled');
 status(await api(route+'/return-confirm',{method:'POST',cookie:supplierCookie,
   data:{}}),400,'Return condition required');
 status(await api(route+'/return-confirm',{method:'POST',cookie:supplierCookie,
   data:{returnCondition:'damaged'}}),400,'Damage notes required');
 const returned=await api(route+'/return-confirm',{method:'POST',cookie:supplierCookie,
   data:{returnCondition:'good',returnNotes:'No damage'}});
 status(returned,200,'Return verified without second PIN');
 status(await api(route+'/return-confirm',{method:'POST',cookie:supplierCookie,
   data:{returnCondition:'good'}}),409,'Return cannot be repeated');
 assert.equal(returned.body.booking.status,'returned');
 outcome=true;
 console.log('PASS real HTTP two-account pickup PIN and supplier-only return without PIN: consent, role enforcement and replay protection');
}finally{
 child.kill('SIGTERM');
 await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,2500))]);
 if(child.exitCode===null)child.kill('SIGKILL');
 fs.rmSync(folder,{recursive:true,force:true});
}
if(!outcome)process.exitCode=1;
