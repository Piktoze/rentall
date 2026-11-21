import test from 'node:test';import assert from 'node:assert/strict';import Database from 'better-sqlite3';
import {inspectBankPayoutReadiness,createConnectPayoutReconciler} from './modules/connect-readiness.js';
import {createOnboardingOnly} from './modules/connect-onboarding-only.js';
import {createCommercialStripeClient} from './modules/commercial-sct-client.js';
import {createCommissionCompletion,commissionSeriesYear} from './modules/commission-completion.js';
const schema=()=>{const d=new Database(':memory:');d.exec(`CREATE TABLE stripe_connections(user_id TEXT,user_email TEXT,stripe_account_id TEXT,connect_api TEXT);INSERT INTO stripe_connections VALUES('u','owner@test','acct_owner','v2_recipient_sct_test');`);return d;};
test('bank readiness requires provider permission, clear requirements and usable EUR bank; new status alone is insufficient',async()=>{
 let account={id:'acct_owner',payouts_enabled:false,requirements:{currently_due:[],past_due:[],pending_verification:[]}},bank={object:'bank_account',currency:'eur',default_for_currency:true,status:'new',available_payout_methods:['standard']};
 const stripe={accounts:{retrieve:async()=>account,listExternalAccounts:async()=>({data:[bank],has_more:false})}};
 assert.equal((await inspectBankPayoutReadiness(stripe,'acct_owner',false)).bankPayoutsReady,false);account.payouts_enabled=true;assert.equal((await inspectBankPayoutReadiness(stripe,'acct_owner',false)).bankPayoutsReady,true);
 account.requirements.pending_verification=['identity'];assert.equal((await inspectBankPayoutReadiness(stripe,'acct_owner',false)).bankPayoutsReady,false);account.requirements.pending_verification=[];bank.status='errored';assert.equal((await inspectBankPayoutReadiness(stripe,'acct_owner',false)).bankPayoutsReady,false);
});
test('durable Connect payout readback pins owner and account context, deduplicates across restart, provider truth beats stale event',async()=>{
 const db=schema();let reads=0,status='paid';const stripe={payouts:{retrieve:async(id,params,options)=>{reads++;assert.equal(options.stripeAccount,'acct_owner');return {id,livemode:false,currency:'eur',amount:8500,status};}}};
 const event={id:'evt_owned',type:'payout.paid',account:'acct_owner',livemode:false,data:{object:{id:'po_example',status:'pending',amount:1}}};
 const reconcile=createConnectPayoutReconciler({db,stripe,livemode:false});assert.equal((await reconcile(event)).bankPayoutExecuted,true);assert.equal(db.prepare('SELECT amount FROM connect_bank_payouts').get().amount,8500);
 assert.equal((await createConnectPayoutReconciler({db,stripe,livemode:false})(event)).duplicate,true);assert.equal(reads,1);
 await assert.rejects(reconcile({...event,id:'evt_wrong',account:'acct_stranger'}));await assert.rejects(reconcile({...event,id:'evt_live',livemode:true}));await assert.rejects(reconcile({...event,type:'payout.failed'}));
 status='failed';await reconcile({...event,id:'evt_later',type:'payout.failed'});assert.equal(db.prepare('SELECT status FROM connect_bank_payouts').get().status,'failed');db.close();
});
test('onboarding-only LIVE-shaped service has no financial runtime and requires explicit mode/new store/platform; no provider writes on startup',async()=>{
 const db=new Database(':memory:');db.exec(`CREATE TABLE app_users(user_id TEXT,email TEXT,role TEXT,display_name TEXT,business_name TEXT);CREATE TABLE stripe_connections(user_id TEXT,user_email TEXT,stripe_account_id TEXT,connect_api TEXT);CREATE TABLE rental_bookings(booking_id TEXT);`);
 const key='sk_live_synthetic_onboarding_only_no_network',stripe=createCommercialStripeClient(key);stripe.accounts.retrieve=async()=>({id:'acct_platform'});
 const env={CONNECT_ONBOARDING_ONLY_ENABLED:'true',STRIPE_MODE:'live',STRIPE_SECRET_KEY:key,COMMERCIAL_STRIPE_PLATFORM_ACCOUNT_ID:'acct_platform',APP_URL:'https://rentinorbit.com'};
 const service=await createOnboardingOnly({db,stripe,env});assert.equal(service.transfer,undefined);assert.equal(service.refund,undefined);assert.equal(service.createPayment,undefined);
 await assert.rejects(createOnboardingOnly({db,stripe,env:{...env,COMMERCIAL_SCT_RUNTIME_ENABLED:'true'}}));db.prepare("INSERT INTO rental_bookings VALUES('old')").run();await assert.rejects(createOnboardingOnly({db,stripe,env}));db.close();
});
test('bilateral completion, annual shared counter, immutable invoice, partial credits and retry keys; unapproved series blocks issue',()=>{
 const db=new Database(':memory:');db.exec(`CREATE TABLE app_users(user_id TEXT,email TEXT,role TEXT);INSERT INTO app_users VALUES('s','s@test','supplier'),('c','c@test','customer'),('x','x@test','customer');
 CREATE TABLE rental_listings(listing_id TEXT,owner_email TEXT);INSERT INTO rental_listings VALUES('l','s@test');
 CREATE TABLE rental_bookings(booking_id TEXT,listing_id TEXT,customer_email TEXT,status TEXT,return_condition TEXT,payment_status TEXT,stripe_refund_id TEXT,security_deposit_amount INTEGER);
 INSERT INTO rental_bookings VALUES('new','l','c@test','returned','good','paid',NULL,0);
 CREATE TABLE commercial_sct_enrollments(booking_id TEXT,hold_reason TEXT);INSERT INTO commercial_sct_enrollments VALUES('new',NULL);
 CREATE TABLE commercial_sct_bindings(booking_id TEXT,fee_cents INTEGER,amount_cents INTEGER);INSERT INTO commercial_sct_bindings VALUES('new',1500,10000);`);
 const c=createCommissionCompletion({db,env:{NODE_ENV:'test',COMMISSION_ISSUANCE_ENABLED:'true'},now:()=>new Date('2026-11-21T10:00:00Z')});
 assert.throws(()=>c.invoice('new'));assert.throws(()=>c.accept('new',{userId:'x',email:'x@test'}));c.accept('new',{userId:'s',email:'s@test'});assert.throws(()=>c.invoice('new'));c.accept('new',{userId:'c',email:'c@test'});assert.throws(()=>c.invoice('new'),{code:'COMMISSION_SERIES_NOT_APPROVED'});
 c.approveSeries(2026,{unused:true});db.prepare("UPDATE commercial_sct_enrollments SET hold_reason='review'").run();assert.throws(()=>c.invoice('new'));db.prepare('UPDATE commercial_sct_enrollments SET hold_reason=NULL').run();
 const inv=c.invoice('new');assert.equal(inv.number,'RIO-2026-000001');assert.equal(inv.amount_cents,1500);assert.equal(c.invoice('new').document_id,inv.document_id);c.accept('new',{userId:'c',email:'c@test'});assert.equal(db.prepare('SELECT count(*) n FROM commission_documents').get().n,1);
 const cr=c.credit(inv.document_id,500,'credit-request-one');assert.equal(cr.number,'RIO-2026-000002');assert.equal(c.credit(inv.document_id,500,'credit-request-one').document_id,cr.document_id);assert.equal(c.credit(inv.document_id,1000,'credit-request-two').number,'RIO-2026-000003');assert.throws(()=>c.credit(inv.document_id,1,'credit-request-three'));assert.throws(()=>db.prepare('UPDATE commission_documents SET amount_cents=0').run());assert.equal(db.prepare('SELECT snapshot FROM commission_documents WHERE document_id=?').get(inv.document_id).snapshot,inv.snapshot);db.close();
});

test('onboarding-only HTTP guard blocks payments, transfers, refunds and admin writes while own authenticated status/form stay isolated',async()=>{
 const {default:express}=await import('express');const {onboardingOnlyWriteGuard}=await import('./modules/connect-onboarding-only.js');const {installSctOnboardingRoutes}=await import('./modules/sct-onboarding-routes.js');
 const app=express();app.use(express.json());app.use('/api',onboardingOnlyWriteGuard(true));let moneyCalls=0;
 for(const p of ['/api/payments/pay','/api/stripe/refund','/api/rentals/one/transfer','/api/customer/bookings/one/payment','/api/admin/refund'])app.post(p,(req,res)=>{moneyCalls++;res.json({ok:true});});
 const auth=(...roles)=>(req,res,next)=>{const role=req.headers['x-test-role'];if(!role)return res.sendStatus(401);if(!roles.includes(role))return res.sendStatus(403);req.appUser={userId:req.headers['x-test-user'],email:req.headers['x-test-user']+'@test',role};next();};
 const own={status:async user=>({accountId:'acct_'+user.userId}),hostedLink:async user=>({url:'https://connect.stripe.com/'+user.userId})};installSctOnboardingRoutes(app,{enabled:()=>true,getService:async()=>own,requireRole:auth});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 try{for(const p of ['/api/payments/pay','/api/stripe/refund','/api/rentals/one/transfer','/api/customer/bookings/one/payment','/api/admin/refund'])assert.equal((await fetch(base+p,{method:'POST'})).status,403);assert.equal(moneyCalls,0);
  assert.equal((await fetch(base+'/api/stripe/connect/status')).status,401);assert.equal((await fetch(base+'/api/stripe/connect/status',{headers:{'x-test-role':'customer'}})).status,403);
  const r=await fetch(base+'/api/stripe/connect/hosted-onboarding-link',{method:'POST',headers:{'Content-Type':'application/json','x-test-role':'supplier','x-test-user':'owner'},body:JSON.stringify({userId:'other',accountId:'acct_other'})});assert.equal(r.status,200);assert.equal((await r.json()).url,'https://connect.stripe.com/owner');assert.equal(r.headers.get('cache-control'),'private, no-store');
 }finally{await new Promise(r=>server.close(r));}
});

test('annual RIO series follows Lithuania year at UTC boundary',()=>{assert.equal(commissionSeriesYear(new Date('2026-12-31T22:30:00Z')),2027);assert.equal(commissionSeriesYear(new Date('2026-12-31T21:30:00Z')),2026);});
