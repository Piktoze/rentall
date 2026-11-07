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
const env={...process.env,DB_PATH:dbPath,NODE_ENV:'test',RENTINORBIT_STAGING:'true',
  RENTINORBIT_DEMO_PAYMENTS:'false',EMAIL_WORKER_ENABLED:'false',BACKUP_SCHEDULER_ENABLED:'false',
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
 const renterCookie=await signIn(renter),supplierCookie=await signIn(supplier),
   outsiderCookie=await signIn(outsider);
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
 const ret=await api(route+'/transfer-code',{method:'POST',cookie:renterCookie,data:{purpose:'return'}});
 status(ret,200,'New renter return PIN');
 status(await api(route+'/transfer-confirm',{method:'POST',cookie:supplierCookie,
   data:{purpose:'return',code:ret.body.code}}),400,'Return condition required');
 const returned=await api(route+'/transfer-confirm',{method:'POST',cookie:supplierCookie,
   data:{purpose:'return',code:ret.body.code,returnCondition:'good',returnNotes:'No damage'}});
 status(returned,200,'Return verified');
 assert.equal(returned.body.booking.status,'returned');
 outcome=true;
 console.log('PASS real HTTP two-account pickup and return: own signatures, one-time PIN, role enforcement, replay and legacy bypass');
}finally{
 child.kill('SIGTERM');
 await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,2500))]);
 if(child.exitCode===null)child.kill('SIGKILL');
 fs.rmSync(folder,{recursive:true,force:true});
}
if(!outcome)process.exitCode=1;
