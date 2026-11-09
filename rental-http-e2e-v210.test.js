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
const administrator='api-e2e-admin@example.invalid',
  supplier='api-e2e-supplier@example.invalid',renter='api-e2e-renter@example.invalid',
  outsider='api-e2e-outsider@example.invalid',otherSupplier='api-e2e-second-supplier@example.invalid',password='Testing12345!',id='api-e2e-1';
for(const [email,role] of [[administrator,'admin'],[supplier,'supplier'],[otherSupplier,'supplier'],[renter,'customer'],[outsider,'customer']])
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
createRentalAgreement({bookingId:pendingId,termsVersion:'e2e-full-lifecycle-v1',
  snapshot:{listingTitle:'Temporary API test item',total:100,startDate:'2099-07-01',endDate:'2099-07-02'}});
const payId='api-e2e-payment';
const payFixture=createRentalBookingAtomic({bookingId:payId,listingId:'api-e2e-listing',
  startDate:'2099-06-05',endDate:'2099-06-06',quantity:1,status:'confirmed',
  customerEmail:renter,customerName:'API Renter',orderValue:100});
setBookingPaymentDetails({bookingId:payId,paymentIntentId:'demo_pi_prepared_e2e',
  paymentStatus:'requires_payment_method',paymentProvider:'demo',platformFeeAmount:15,supplierAmount:85});

upsertRentalListing({listingId:'api-e2e-instant',ownerEmail:supplier,title:'Instant mode fixture',totalQuantity:1});
db.prepare("UPDATE rental_listings SET booking_mode='instant' WHERE listing_id=?").run('api-e2e-instant');
createRentalBookingAtomic({bookingId:'api-e2e-instant-pending',listingId:'api-e2e-instant',
  startDate:'2099-08-01',endDate:'2099-08-02',quantity:1,status:'pending',
  customerEmail:renter,customerName:'Instant test renter',orderValue:100});

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
   outsiderCookie=await signIn(outsider),adminCookie=await signIn(administrator);
 // Booking lists must be scoped to the account identity (not request parameters).
 // Financial audit is never exposed to renters, suppliers or guests.
 status(await api('/api/stripe/webhook-events',{cookie:renterCookie}),403,
   'Renter cannot read payment/webhook audit');
 status(await api('/api/stripe/webhook-events',{cookie:supplierCookie}),403,
   'Supplier cannot read platform-wide payment/webhook audit');
 status(await api('/api/stripe/webhook-events',{cookie:outsiderCookie}),403,
   'Other account cannot read financial audit');
 // Supplier trader self-declaration must not equal verified legal status.
 const initialTrader=await api('/api/supplier/trader-status',{cookie:supplierCookie});
 status(initialTrader,200,'Supplier can inspect trader declaration');
 assert.equal(initialTrader.body.trader.status,'undeclared');
 assert.equal(initialTrader.body.trader.verified,false);
 status(await api('/api/supplier/trader-status',{method:'POST',cookie:supplierCookie,
   data:{status:'trader',confirmed:false}}),400,'Explicit declaration consent required');
 status(await api('/api/supplier/trader-status',{method:'POST',cookie:renterCookie,
   data:{status:'trader',confirmed:true}}),403,'Renter cannot self-declare as supplier');
 status(await api('/api/supplier/trader-status',{method:'POST',cookie:supplierCookie,
   data:{status:'company',confirmed:true}}),400,'Stripe legal entity type is not trader status');
 const declaredTrader=await api('/api/supplier/trader-status',{method:'POST',cookie:supplierCookie,
   data:{status:'trader',confirmed:true}});
 status(declaredTrader,200,'Supplier can declare commercial status');
 assert.equal(declaredTrader.body.trader.status,'trader');
 assert.equal(declaredTrader.body.trader.verified,false,'Self-declared trader is never verified');
 status(await api('/api/supplier/trader-profile',{cookie:renterCookie}),403,
   'Renter cannot view trader traceability details');
 status(await api('/api/supplier/trader-profile',{method:'POST',cookie:renterCookie,
   data:{legalName:'Other Firm'}}),403,'Renter cannot write supplier identity');
 const initialProfile=await api('/api/supplier/trader-profile',{cookie:supplierCookie});
 status(initialProfile,200,'Supplier can view own traceability draft');
 assert.equal(initialProfile.body.profile,null);
 status(await api('/api/supplier/trader-profile',{method:'POST',cookie:supplierCookie,
   data:{legalName:'Test Supplier',contactAddress:'Test Street 1, Vilnius',
     contactPhone:'+37061234567',contactEmail:'supplier@example.invalid',
     euComplianceCertified:false}}),400,'EU compliance self-certification must be explicit');
 const traderProfile=await api('/api/supplier/trader-profile',{method:'POST',cookie:supplierCookie,
   data:{legalName:'Test Supplier',contactAddress:'Test Street 1, Vilnius',
     contactPhone:'+37061234567',contactEmail:'supplier@example.invalid',
     registerName:'Sample Register',registerNumber:'TEST-999',
     euComplianceCertified:true}});
 status(traderProfile,200,'Supplier can submit complete traceability draft');
 assert.equal(traderProfile.body.profile.verified,false,'Draft cannot imply third-party identity verification');
 const savedProfile=await api('/api/supplier/trader-profile',{cookie:supplierCookie});
 status(savedProfile,200,'Submitted traceability details persist');
 assert.equal(savedProfile.body.profile.legalName,'Test Supplier');
 console.log('PASS HTTP trader traceability: supplier-only access, explicit compliance certification, persistence, unverified draft');
 const customerBookings=await api('/api/customer/bookings',{cookie:renterCookie});
 status(customerBookings,200,'Renter booking list');
 assert.ok(customerBookings.body.bookings.some(b=>b.bookingId===id),'Renter sees own rental');
 const unrelatedBookings=await api('/api/customer/bookings',{cookie:outsiderCookie});
 status(unrelatedBookings,200,'Unrelated account booking list');
 assert.ok(!unrelatedBookings.body.bookings.some(b=>b.bookingId===id),'Outsider must not see renter booking');
 const supplierBookings=await api('/api/rentals/bookings',{cookie:supplierCookie});
 status(supplierBookings,200,'Supplier booking list');
 assert.ok(supplierBookings.body.bookings.some(b=>b.bookingId===id),'Supplier sees booking for owned listing');
 const supplierWithForeignFilter=await api('/api/rentals/bookings?ownerEmail=not-the-supplier@example.invalid',{cookie:supplierCookie});
 status(supplierWithForeignFilter,200,'Supplier cannot override ownership via query');
 assert.ok(supplierWithForeignFilter.body.bookings.some(b=>b.bookingId===id),'Supplier owner filter must use session identity');
 status(await api('/api/rentals/bookings',{cookie:renterCookie}),403,'Renter cannot view supplier booking list');
 status(await api('/api/rentals/bookings',{cookie:outsiderCookie}),403,'Outsider cannot view supplier booking list');
 status(await api('/api/customer/bookings/'+id,{cookie:outsiderCookie}),403,'Outsider cannot access renter booking detail');
 const renterDetail=await api('/api/customer/bookings/'+id,{cookie:renterCookie});
 status(renterDetail,200,'Renter can open own booking detail');
 status(await api('/api/customer/bookings/'+id+'?accessToken='+encodeURIComponent(payFixture.paymentToken),{cookie:outsiderCookie}),403,
   'Signed-in outsider cannot use a guest token to impersonate another renter');
 console.log('PASS HTTP booking list and detail account isolation');
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
 const publicTraderListings=await api('/api/listings');
 status(publicTraderListings,200,'Public listings available with trader disclosure');
 const publicListing=publicTraderListings.body.listings.find(item=>item.id===listingBase.id);
 assert.ok(publicListing,'Published supplier listing present publicly');
 assert.equal(publicListing.supplierTraderStatus,'trader');
 assert.equal(publicListing.supplierTraderVerified,false);
 assert.equal(publicListing.supplierPublicIdentity,null,'Unverified submitted trader contact data must stay private');
 const publicSellerDisclosure=await api('/api/listings/'+encodeURIComponent(listingBase.id)+'/trader-disclosure');
 status(publicSellerDisclosure,200,'Renter can query authoritative trader status without login');
 assert.equal(publicSellerDisclosure.body.status,'trader');
 assert.equal(publicSellerDisclosure.body.verified,false);
 assert.equal(publicSellerDisclosure.body.publicIdentity,null,
   'Precontract disclosure must never leak unverified trader contact details');
 status(await api('/api/listings/nonexistent-test-item/trader-disclosure'),404,
   'Unknown listing must not expose supplier information');

 status(await api('/api/admin/trader-reviews',{cookie:supplierCookie}),403,
   'Supplier cannot read admin trader evidence queue');
 status(await api('/api/admin/trader-reviews',{cookie:renterCookie}),403,
   'Customer cannot read admin trader evidence queue');
 const queue=await api('/api/admin/trader-reviews',{cookie:adminCookie});
 status(queue,200,'Admin can inspect submitted trader data');
 const reviewRow=queue.body.profiles.find(p=>p.email===supplier);
 assert.ok(reviewRow,'Supplier submitted profile is in admin review queue');
 const reviewUrl='/api/admin/trader-reviews/'+encodeURIComponent(reviewRow.userId);
 const reviewBase={decision:'approved',submittedAt:reviewRow.submittedAt,
   evidenceReference:'TEST-ONLY-SYNTHETIC-EVIDENCE',reviewNote:'Synthetic external checks for isolated HTTP regression',
   identityChecked:true,contactChecked:true,registryChecked:true,paymentAccountChecked:true};
 status(await api(reviewUrl,{method:'POST',cookie:supplierCookie,data:reviewBase}),403,
   'Supplier cannot self-approve trader identity');
 status(await api(reviewUrl,{method:'POST',cookie:adminCookie,
   data:{...reviewBase,identityChecked:false}}),400,
   'Admin may not approve without all independent evidence attestations');
 const approvedTrader=await api(reviewUrl,{method:'POST',cookie:adminCookie,data:reviewBase});
 status(approvedTrader,200,'Admin approval with evidence succeeds');
 assert.equal(approvedTrader.body.review.verified,true);
 const afterReviewListing=await api('/api/listings');
 const reviewedListing=afterReviewListing.body.listings.find(l=>l.id===listingBase.id);
 assert.equal(reviewedListing.supplierTraderVerified,true);
 assert.equal(reviewedListing.supplierPublicIdentity?.legalName,'Test Supplier');
 status(await api(reviewUrl,{method:'POST',cookie:adminCookie,data:reviewBase}),409,
   'Duplicate approval denied');
 const rejectedTrader=await api(reviewUrl,{method:'POST',cookie:adminCookie,
   data:{...reviewBase,decision:'rejected',reviewNote:'Synthetic dispute of verification evidence'}});
 status(rejectedTrader,200,'Admin rejection revokes verified trader status');
 assert.equal(rejectedTrader.body.review.verified,false);
 const afterRejection=await api('/api/listings');
 assert.equal(afterRejection.body.listings.find(l=>l.id===listingBase.id).supplierPublicIdentity,null,
   'Revoked trader identity must be removed from public listing');
 const again=await api(reviewUrl,{method:'POST',cookie:adminCookie,data:reviewBase});
 status(again,200,'Admin may reapprove after a documented rejection');
 const revisedProfile=await api('/api/supplier/trader-profile',{method:'POST',cookie:supplierCookie,
   data:{legalName:'Revised Supplier',contactAddress:'New Test Street 4, Vilnius',
     contactPhone:'+37061234567',contactEmail:'supplier@example.invalid',
     registerName:'Sample Register',registerNumber:'TEST-999',euComplianceCertified:true}});
 status(revisedProfile,200,'Supplier may edit approved profile');
 assert.equal(revisedProfile.body.profile.verified,false,
   'Editing previously approved trader profile revokes its verification');
 const afterProfileEdit=await api('/api/listings');
 const changedListing=afterProfileEdit.body.listings.find(l=>l.id===listingBase.id);
 assert.equal(changedListing.supplierTraderVerified,false);
 assert.equal(changedListing.supplierPublicIdentity,null,
   'Edited identity data stays hidden pending independent re-review');
 status(await api(reviewUrl,{method:'POST',cookie:adminCookie,data:reviewBase}),409,
   'Old approval evidence cannot be reused after supplier profile update');
 console.log('PASS HTTP admin trader review: role isolation, evidence, approval, replay guard, revocation');

 console.log('PASS HTTP supplier trader declaration: identity, consent and unverified public classification');
 const anotherSupplierCookie=await signIn(otherSupplier);
 const attemptedTakeover=await api('/api/supplier/listings',{method:'POST',cookie:anotherSupplierCookie,
   data:{listing:{...listingBase,title:'Unauthorized takeover',photos,coverPhoto:photos[0]}}});
 status(attemptedTakeover,400,'Other supplier must not overwrite listing ID');
 const ownerStillOwns=await api('/api/supplier/listings',{cookie:supplierCookie});
 status(ownerStillOwns,200,'Original supplier listing list');
 assert.ok(ownerStillOwns.body.listings.some(l=>l.id===listingBase.id&&l.title===listingBase.title),
   'Rejected takeover must preserve original owner and title');
 const otherListings=await api('/api/supplier/listings',{cookie:anotherSupplierCookie});
 status(otherListings,200,'Another supplier listing list');
 assert.ok(!otherListings.body.listings.some(l=>l.id===listingBase.id),'Other supplier must not own another listing');
 status(await api('/api/supplier/listings/'+listingBase.id,{method:'DELETE',cookie:anotherSupplierCookie}),
   404,'Other supplier cannot delete listing');
 status(await api('/api/supplier/listings/'+listingBase.id+'/archive',{method:'POST',cookie:anotherSupplierCookie}),
   404,'Other supplier cannot archive listing');
 const updated=await api('/api/supplier/listings',{method:'POST',cookie:supplierCookie,
   data:{listing:{...listingBase,title:'Owner updated title',photos,coverPhoto:photos[0]}}});
 status(updated,200,'Owner can edit listing with valid photos');
 assert.equal(updated.body.listing.title,'Owner updated title');
 console.log('PASS HTTP listing create/edit, photo count, account ownership, archive/delete access');


 // Instant mode must follow the same supplier-first payment rule for the MVP.
 const instantPending=await api('/api/payments/create-intent',{method:'POST',cookie:renterCookie,
   data:{bookingId:'api-e2e-instant-pending'}});
 status(instantPending,409,'Instant mode cannot create a payment intent before supplier approval');
 assert.equal(instantPending.body.code,'SUPPLIER_CONFIRMATION_REQUIRED');
 const instantDemoPending=await api('/api/payments/demo/confirm',{method:'POST',cookie:renterCookie,
   data:{bookingId:'api-e2e-instant-pending',outcome:'succeeded'}});
 status(instantDemoPending,409,'Instant mode cannot complete demo payment before supplier approval');
 assert.equal(instantDemoPending.body.code,'SUPPLIER_CONFIRMATION_REQUIRED');
 status(await api('/api/rentals/bookings/api-e2e-instant-pending/status',{method:'POST',
   cookie:supplierCookie,data:{status:'confirmed'}}),200,'Supplier can confirm instant-mode request');
 const instantUnlocked=await api('/api/payments/create-intent',{method:'POST',cookie:renterCookie,
   data:{bookingId:'api-e2e-instant-pending'}});
 status(instantUnlocked,200,'Instant mode payment unlocked only after supplier confirmation');
 console.log('PASS supplier approval required before payment in request and instant booking modes');

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
 const beforePaymentTrust=await api('/api/rentals/bookings/'+pendingId+'/trust',{cookie:renterCookie});
 status(beforePaymentTrust,200,'Renter sees agreement after supplier booking approval');
 assert.equal(beforePaymentTrust.body.agreement?.customerAcceptedAt,null,
   'Supplier booking approval must never sign the renter agreement');
 assert.equal(beforePaymentTrust.body.agreement?.supplierAcceptedAt,null,
   'Supplier booking approval must not silently sign the supplier agreement');
 const unlocked=await api('/api/payments/create-intent',{method:'POST',cookie:renterCookie,
   data:{bookingId:pendingId}});
 status(unlocked,200,'Payment intent only after supplier approval');
 assert.ok(unlocked.body.paymentIntentId?.startsWith('demo_pi_'));
 const pendingPaid=await api('/api/payments/demo/confirm',{method:'POST',cookie:renterCookie,
   data:{bookingId:pendingId,outcome:'succeeded'}});
 status(pendingPaid,200,'Confirmed rental can complete demo payment');
 assert.equal(pendingPaid.body.booking.paymentStatus,'paid');
 const afterPaymentTrust=await api('/api/rentals/bookings/'+pendingId+'/trust',{cookie:renterCookie});
 status(afterPaymentTrust,200,'Renter agreement remains independently unsigned after payment');
 assert.equal(afterPaymentTrust.body.agreement?.customerAcceptedAt,null,
   'Successful payment must not sign the renter agreement');
 // Follow ONE booking from pending through approval, payment, two signatures,
 // pickup, return and subsequent dispute (all local demo money only).
 const fullRoute='/api/rentals/bookings/'+pendingId;
 const renterConsent=await api(fullRoute+'/agreement/accept',{method:'POST',cookie:renterCookie,
   data:{accepted:true}});
 status(renterConsent,200,'Lifecycle renter independently signs agreement');
 const lifecyclePin=await api(fullRoute+'/transfer-code',{method:'POST',cookie:renterCookie,
   data:{purpose:'pickup'}});
 status(lifecyclePin,200,'Lifecycle renter obtains handover PIN');
 assert.equal(lifecyclePin.body.validUntilUsed,true);
 assert.equal(lifecyclePin.body.expiresAt,null);
 status(await api(fullRoute+'/transfer-confirm',{method:'POST',cookie:supplierCookie,
   data:{purpose:'pickup',code:lifecyclePin.body.code}}),409,
   'Full-cycle handover requires the supplier signature independently');
 status(await api(fullRoute+'/agreement/accept',{method:'POST',cookie:supplierCookie,
   data:{accepted:true}}),200,'Lifecycle supplier signs agreement');
 const handover=await api(fullRoute+'/transfer-confirm',{method:'POST',cookie:supplierCookie,
   data:{purpose:'pickup',code:lifecyclePin.body.code}});
 status(handover,200,'Full-cycle item handover');
 assert.equal(handover.body.booking.status,'active');
 status(await api(fullRoute+'/transfer-confirm',{method:'POST',cookie:supplierCookie,
   data:{purpose:'pickup',code:lifecyclePin.body.code}}),409,'Full-cycle pickup PIN replay denied');
 const fullReturn=await api(fullRoute+'/return-confirm',{method:'POST',cookie:supplierCookie,
   data:{returnCondition:'good'}});
 status(fullReturn,200,'Full-cycle supplier confirms return without PIN');
 assert.equal(fullReturn.body.booking.status,'returned');
 const fullDispute=await api('/api/rentals/disputes',{method:'POST',cookie:renterCookie,
   data:{bookingId:pendingId,reason:'Lifecycle test of return dispute'}});
 status(fullDispute,200,'Full-cycle renter can open dispute after return');
 status(await api(fullRoute+'/cancel',{method:'POST',cookie:renterCookie,
   data:{reason:'Cannot cancel already returned item'}}),409,
   'Full-cycle returned booking cannot be cancelled for automatic refund');
 console.log('PASS single-booking HTTP lifecycle: pending → approval → demo payment → signatures → PIN → return → dispute');

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
 // A supplier-initiated cancellation after a completed demo payment must
 // refund the full amount once and reject further cancellation/refund attempts.
 const refunded=await api('/api/rentals/bookings/'+payId+'/cancel',{method:'POST',
   cookie:supplierCookie,data:{reason:'Supplier cannot fulfil rental'}});
 status(refunded,200,'Supplier cancels paid booking');
 assert.equal(refunded.body.refundAmount,100,'Supplier cancellation refunds all €100');
 assert.equal(refunded.body.booking.status,'cancelled');
 const refundReplay=await api('/api/rentals/bookings/'+payId+'/cancel',{method:'POST',
   cookie:supplierCookie,data:{reason:'Duplicate cancellation'}});
 status(refundReplay,409,'Duplicate cancellation cannot issue a second refund');
 const afterRefund=await api('/api/payments/create-intent',{method:'POST',
   cookie:renterCookie,data:{bookingId:payId}});
 status(afterRefund,409,'Refunded booking cannot restart checkout');
 console.log('PASS HTTP demo paid €100 refund and duplicate cancellation protection');

 // A valid guest token must not become an identity override for an unrelated signed-in user.
 status(await api('/api/rentals/disputes',{method:'POST',cookie:outsiderCookie,
   data:{bookingId:payId,reason:'Unauthorized dispute probe',accessToken:payFixture.paymentToken}}),
   403,'Signed-in outsider cannot open a dispute with another renter guest token');
 const route='/api/rentals/bookings/'+id;
 // The agreement and acceptance evidence are private to the two booking parties.
 status(await api(route+'/trust',{cookie:outsiderCookie}),403,'Outsider cannot read agreement acceptance evidence');
 status(await api(route+'/agreement',{cookie:outsiderCookie}),403,'Outsider cannot read rental agreement');
 status(await api(route+'/trust',{cookie:renterCookie}),200,'Renter can view booking trust status');
 status(await api(route+'/agreement',{cookie:supplierCookie}),200,'Supplier can view booking agreement');
 status(await api(route+'/agreement/accept',{method:'POST',cookie:outsiderCookie,
   data:{accepted:true,accessToken:payFixture.paymentToken}}),403,
   'Signed-in outsider cannot sign with another booking guest token');
 status(await api(route+'/transfer-code',{method:'POST',cookie:outsiderCookie,
   data:{purpose:'pickup',accessToken:payFixture.paymentToken}}),403,
   'Signed-in outsider cannot obtain renter PIN with guest token');
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
 assert.equal(code.body.validUntilUsed,true,'Issued pickup code must remain valid until used');
 assert.equal(code.body.expiresAt,null,'Issued pickup code must not expose a countdown');
 const repeatCode=await api(route+'/transfer-code',{method:'POST',cookie:renterCookie,
   data:{purpose:'pickup'}});
 status(repeatCode,200,'Reopening the renter booking must preserve the PIN');
 assert.equal(repeatCode.body.code,code.body.code,'Unused pickup PIN must remain stable');
 const pinTrust=await api(route+'/trust',{cookie:renterCookie});
 status(pinTrust,200,'Renter can inspect pickup PIN status');
 assert.equal(pinTrust.body.transfer.pickup_customer.validUntilUsed,true);
 assert.equal(pinTrust.body.transfer.pickup_customer.expiresAt,null,'Do not expose year-9999 sentinel');

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
 status(await api(route+'/return-confirm',{method:'POST',cookie:renterCookie,
   data:{returnCondition:'good'}}),403,'Renter cannot confirm own return');
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
 // After handover or return, cancellation/refund must be blocked; disputes remain available.
 status(await api(route+'/cancel',{method:'POST',cookie:supplierCookie,
   data:{reason:'Attempt to cancel after physical return'}}),409,
   'Supplier cannot cancel and refund a returned rental');
 status(await api(route+'/cancel',{method:'POST',cookie:renterCookie,
   data:{reason:'Attempt to cancel after physical return'}}),409,
   'Renter cannot cancel and refund a returned rental');
 const disputeOpened=await api('/api/rentals/disputes',{method:'POST',cookie:renterCookie,
   data:{bookingId:id,openedBy:'supplier',reason:'Returned item condition disagreement',
     details:'Requesting administrator review'}});
 status(disputeOpened,200,'Renter can open dispute after return');
 assert.equal(disputeOpened.body.dispute.openedBy,'customer',
   'Caller cannot spoof dispute initiator using openedBy request field');
 const repeatDispute=await api('/api/rentals/disputes',{method:'POST',cookie:supplierCookie,
   data:{bookingId:id,reason:'Second dispute for same booking'}});
 status(repeatDispute,409,'Only one open dispute per booking');
 assert.equal(repeatDispute.body.code,'DISPUTE_ALREADY_OPEN');
 status(await api('/api/rentals/disputes',{method:'POST',cookie:outsiderCookie,
   data:{bookingId:id,reason:'Unrelated account dispute'}}),403,
   'Outsider cannot open a dispute');
 console.log('PASS HTTP disputed return: participant identity, one open dispute, no post-handover refund');
 // A foreign renter cannot attach a conversation to someone else's booking.
 const forgedConversation=await api('/api/conversations',{method:'POST',cookie:outsiderCookie,
   data:{listingId:'api-e2e-listing',bookingId:id}});
 status(forgedConversation,403,'Unrelated account cannot create a booking-bound conversation');
 assert.equal(forgedConversation.body.code,'BOOKING_ACCESS_DENIED');
 // Supplier can discover an existing booking in Messages before a conversation exists.
 const supplierChats=await api('/api/conversations',{cookie:supplierCookie});
 status(supplierChats,200,'Supplier booking chat candidates');
 assert.ok(supplierChats.body.bookingCandidates.some(b=>b.bookingId===id&&b.side==='supplier'),
   'Messages must offer the booking renter as an available recipient');
 const outsiderChats=await api('/api/conversations',{cookie:outsiderCookie});
 status(outsiderChats,200,'Outsider messages list');
 assert.ok(!outsiderChats.body.bookingCandidates.some(b=>b.bookingId===id),
   'Unrelated accounts must never see booking chat candidates');
 const conversation=await api('/api/conversations',{method:'POST',cookie:supplierCookie,
   data:{listingId:'api-e2e-listing',bookingId:id}});
 status(conversation,200,'Supplier starts the renter conversation');
 const conversationId=conversation.body.conversation.conversationId;
 const sent=await api('/api/conversations/'+encodeURIComponent(conversationId)+'/messages',{
   method:'POST',cookie:supplierCookie,data:{body:'Sveiki, daiktas jau paruoštas.'}});
 status(sent,200,'Supplier can send a booking message');
 const inbox=await api('/api/conversations/'+encodeURIComponent(conversationId)+'/messages',{cookie:renterCookie});
 status(inbox,200,'Renter receives the supplier conversation');
 assert.ok(inbox.body.messages.some(m=>m.body==='Sveiki, daiktas jau paruoštas.'));
 const reply=await api('/api/conversations/'+encodeURIComponent(conversationId)+'/messages',{
   method:'POST',cookie:renterCookie,data:{body:'Ačiū, atvyksiu sutartu laiku.'}});
 status(reply,200,'Renter can reply to supplier');
 const supplierInbox=await api('/api/conversations/'+encodeURIComponent(conversationId)+'/messages',
   {cookie:supplierCookie});
 status(supplierInbox,200,'Supplier can read renter reply');
 assert.ok(supplierInbox.body.messages.some(m=>m.body==='Ačiū, atvyksiu sutartu laiku.'));
 status(await api('/api/conversations/'+encodeURIComponent(conversationId)+'/messages',
   {cookie:outsiderCookie}),403,'Outsider cannot read the conversation');
 status(await api('/api/conversations/'+encodeURIComponent(conversationId)+'/messages',{
   method:'POST',cookie:outsiderCookie,data:{body:'Nepriklausantis asmuo'}}),403,
   'Outsider cannot send conversation messages');
 console.log('PASS HTTP two-way booking messages and outsider read/write isolation');
 outcome=true;
 console.log('PASS real HTTP two-account pickup PIN and supplier-only return without PIN: consent, role enforcement and replay protection');
}finally{
 child.kill('SIGTERM');
 await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,2500))]);
 if(child.exitCode===null)child.kill('SIGKILL');
 fs.rmSync(folder,{recursive:true,force:true});
}
if(!outcome)process.exitCode=1;
