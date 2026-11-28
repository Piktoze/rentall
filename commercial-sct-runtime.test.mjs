import test,{after} from 'node:test';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import http from 'node:http';import https from 'node:https';
http.request=https.request=()=>{throw Error('Commercial rehearsal forbids network');};
const root=fs.mkdtempSync(path.join(os.tmpdir(),'rio-commercial-'));
fs.writeFileSync(path.join(root,'.rentinorbit-commercial.json'),JSON.stringify({version:1,purpose:'fresh-commercial-live',platformAccount:'acct_commercialPlatform',policy:'sct-a-15-85-v1'}));
import assert from 'node:assert/strict';
process.env.NODE_ENV='test';process.env.DB_PATH=path.join(root,'commercial.sqlite');process.env.PRIVATE_TEST_ENABLED='false';
for(const k of ['DATABASE_URL','RENTINORBIT_DB_PATH','RAILWAY_ENVIRONMENT_ID','RAILWAY_PROJECT_ID','RAILWAY_SERVICE_ID','RAILWAY_VOLUME_MOUNT_PATH'])delete process.env[k];
const d=await import('./db.js');
const {commercialSctNotifications}=await import('./modules/commercial-sct-notifications.js');
const {createCommercialSctRuntime}=await import('./modules/commercial-sct-runtime.js');
after(()=>{d.closeDatabase();fs.rmSync(root,{recursive:true,force:true});});
const {createCommercialStripeClient}=await import('./modules/commercial-sct-client.js');
const key='sk_live_synthetic_never_sent_to_stripe';
const env={NODE_ENV:'test',STRIPE_MODE:'live',PRIVATE_TEST_ENABLED:'false',COMMERCIAL_SCT_RUNTIME_ENABLED:'true',COMMERCIAL_SCT_POLICY_VERSION:'sct-a-15-85-v1',COMMERCIAL_STRIPE_PLATFORM_ACCOUNT_ID:'acct_commercialPlatform',COMMERCIAL_SCT_STORAGE_ROOT:root,STRIPE_SECRET_KEY:key,RENTINORBIT_SCT_TEST_RUNTIME:'false',SCT_STRIPE_FEE_PAYER:'platform',COMMISSION_ISSUANCE_ENABLED:'true'};
let seq=0;
const supplier='sct-supplier@example.test',customer='sct-renter@example.test';
d.createAppUser({email:supplier,password:'SyntheticPassword123',role:'supplier'});
d.createAppUser({email:customer,password:'SyntheticPassword123',role:'customer'});
d.upsertRentalListing({listingId:'sct-runtime-item',ownerEmail:supplier,title:'SCT synthetic item',totalQuantity:100});
const account={id:'acct_runtimeTest',livemode:true,identity:{country:'LT',entity_type:'individual'},dashboard:'express',
 defaults:{responsibilities:{fees_collector:'application',losses_collector:'application'}},requirements:{entries:[]},
 configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{status:'active'}}}}}};
async function fixture(payer='platform'){
 const stripe=createCommercialStripeClient(key),pis=[],charges=[],refunds=[],transfers=[];
 const calls={payment:0,refund:0,transfer:0},fault={};
 const list=data=>async()=>({data,has_more:false});
 stripe.accounts.retrieve=async()=>({id:'acct_commercialPlatform',charges_enabled:true,payouts_enabled:true,details_submitted:true,capabilities:{card_payments:'active'},requirements:{currently_due:[],past_due:[]}});
 stripe.v2.core.accounts.retrieve=async()=>account;
 stripe.paymentIntents.create=async payload=>{calls.payment++;const p={...payload,id:'pi_runtime'+(++seq),livemode:true,
  client_secret:'synthetic_secret',status:'requires_payment_method'};pis.push(p);if(fault.payment)throw Error('connection lost after provider commit');return p;};
 stripe.paymentIntents.retrieve=async id=>pis.find(p=>p.id===id);
 stripe.paymentIntents.cancel=async id=>{const p=pis.find(p=>p.id===id);if(p.status==='succeeded')throw Error('already paid');p.status='canceled';return p;};
 stripe.paymentIntents.list=list(pis);
 stripe.charges.retrieve=async id=>charges.find(c=>c.id===id);
 stripe.balanceTransactions.retrieve=async()=>({id:'txn_runtime',currency:'eur',amount:10000,fee:175,net:9825,status:'available'});
 stripe.refunds.list=async({charge}={})=>({data:refunds.filter(r=>!charge||r.charge===charge),has_more:false});
 stripe.refunds.create=async payload=>{calls.refund++;const r={...payload,currency:'eur',id:'re_runtime'+(++seq),livemode:true,status:'succeeded',
  payment_intent:charges.find(c=>c.id===payload.charge).payment_intent};refunds.push(r);
  if(fault.refund)throw Error('connection lost after refund');return r;};
 stripe.refunds.retrieve=async id=>refunds.find(r=>r.id===id);
 stripe.disputes.list=list([]);
 stripe.transfers.list=async({transfer_group}={})=>({data:transfers.filter(t=>!transfer_group||t.transfer_group===transfer_group),has_more:false});
 stripe.transfers.create=async payload=>{calls.transfer++;const t={...payload,id:'tr_runtime'+(++seq),livemode:true,reversed:false};transfers.push(t);
  if(fault.transfer)throw Error('connection lost after transfer');return t;};
 stripe.transfers.retrieve=async id=>transfers.find(t=>t.id===id);
 const userId=d.db.prepare('SELECT user_id FROM app_users WHERE email=?').get(supplier).user_id;
 d.saveStripeConnection({userId,userEmail:supplier,stripeAccountId:account.id,connectApi:'v2_recipient_sct_live',transferCapabilityStatus:'active',requirements:[]});
 const service=await createCommercialSctRuntime({db:d.db,stripe,env:{...env,SCT_STRIPE_FEE_PAYER:payer},...commercialSctNotifications({db:d.db,enqueue:d.enqueueTransactionalEmail})});
 function paid(id){const p=pis.find(x=>x.metadata.bookingId===id);Object.assign(p,{status:'succeeded',amount_received:p.amount,latest_charge:'ch_runtime'+(++seq)});
  charges.push({id:p.latest_charge,livemode:true,payment_intent:p.id,status:'succeeded',paid:true,captured:true,
   amount:p.amount,amount_captured:p.amount,amount_refunded:0,refunded:false,disputed:false,currency:'eur',balance_transaction:'txn_runtime'});}
 return {service,stripe,paid,calls,fault,transfers,refunds,pis,charges};
}
async function booking(f){await f.service.registerRecipient(supplier,account.id,'individual');
 const id='RB-synthetic-'+(++seq);d.db.transaction(()=>{
  d.createRentalBookingAtomic({bookingId:id,listingId:'sct-runtime-item',startDate:'2099-01-01',endDate:'2099-01-02',
   quantity:1,status:'pending',customerEmail:customer,customerName:'Synthetic renter',orderValue:100});
  f.service.enrollNewBooking(id,supplier);
 }).immediate();d.updateRentalBookingStatus(id,'confirmed');return id;
}
function returned(id){d.createRentalAgreement({bookingId:id,termsVersion:'sct-test-v1',snapshot:{total:100}});
 d.acceptRentalAgreement(id,'customer',{actorEmail:customer,authMethod:'session'});
 assert.throws(()=>d.verifyAndConsumeRentalTransferCode(id,'pickup','123456'));
 d.acceptRentalAgreement(id,'supplier',{actorEmail:supplier,authMethod:'session'});
 const pin=d.issueRentalTransferCode(id,'pickup','customer');
 assert.equal(d.verifyAndConsumeRentalTransferCode(id,'pickup',pin.code).ok,true);
 d.markRentalReturned(id,'good');
 for(const [party,email] of [['customer',customer],['supplier',supplier]])d.db.prepare('INSERT OR IGNORE INTO commission_return_acceptance VALUES(?,?,?,?)').run(id,party,d.db.prepare('SELECT user_id FROM app_users WHERE email=?').get(email).user_id,new Date().toISOString());
 d.db.prepare("INSERT OR IGNORE INTO commission_series VALUES(?,0,'synthetic_test_only')").run(new Date().getUTCFullYear());}

test('commercial policy A (offline): new booking, platform payment, two agreements, handover, return, one 85 EUR transfer',async()=>{
 const f=await fixture(),id=await booking(f);
 await f.service.createPayment(id);await assert.rejects(f.service.transfer(id));assert.equal(f.calls.transfer,0);
 f.paid(id);await f.service.settle(id);assert.equal((await f.service.settle(id)).duplicate,true);
 returned(id);const attempts=await Promise.allSettled([f.service.transfer(id),f.service.transfer(id)]);
 assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);assert.equal(f.calls.transfer,1);
 assert.equal(f.transfers[0].amount,8500);assert.equal(d.getRentalBookingById(id).payoutStatus,'transferred');
 await assert.rejects(f.service.refund(id,10000));assert.equal(f.calls.refund,0);
});
test('commercial policy B (offline): independent new booking, full refund, duplicate refund and transfer blocked',async()=>{
 const f=await fixture(),id=await booking(f);await f.service.createPayment(id);f.paid(id);await f.service.settle(id);
 assert.equal((await f.service.refund(id,10000)).status,'refunded');
 await assert.rejects(f.service.refund(id,10000));await assert.rejects(f.service.settle(id));
 await assert.rejects(f.service.transfer(id));assert.equal(f.calls.refund,1);assert.equal(f.calls.transfer,0);
 const b=d.getRentalBookingById(id);assert.equal(b.status,'cancelled');assert.equal(b.paymentStatus,'refunded');assert.equal(b.refundAmount,100);
 assert.equal(b.platformFeeAmount,0);assert.equal(b.supplierAmount,0);
});
test('approved A model refuses supplier-paid configuration and absorbs higher fees',async()=>{
 await assert.rejects(fixture('supplier'),{code:'SCT_PLATFORM_COST_POLICY_REQUIRED'});
 const f=await fixture(),id=await booking(f);await f.service.createPayment(id);f.paid(id);await f.service.settle(id);returned(id);
 f.stripe.balanceTransactions.retrieve=async()=>({currency:'eur',amount:10000,fee:900,net:9100,status:'available'});
 assert.equal((await f.service.transfer(id)).amountCents,8500);
});
test('unknown payment result recovers provider object after restart without another create',async()=>{
 const f=await fixture(),id=await booking(f);f.fault.payment=true;await assert.rejects(f.service.createPayment(id));
 const restarted=await createCommercialSctRuntime({db:d.db,stripe:f.stripe,env});
 assert.equal((await restarted.recover(id,'payment')).paymentIntentId.startsWith('pi_'),true);assert.equal(f.calls.payment,1);
});
test('unknown transfer and refund results reconcile once; a crash never authorizes a second request',async()=>{
 for(const kind of ['transfer','refund']){
  const f=await fixture(),id=await booking(f);await f.service.createPayment(id);f.paid(id);await f.service.settle(id);
  if(kind==='transfer')returned(id);f.fault[kind]=true;
  await assert.rejects(kind==='transfer'?f.service.transfer(id):f.service.refund(id,10000));
  const restarted=await createCommercialSctRuntime({db:d.db,stripe:f.stripe,env});
  assert.equal((await restarted.recover(id,kind)).status,kind==='transfer'?'transferred':'refunded');
  assert.equal((await restarted.recover(id,kind)).status,'already_reconciled');assert.equal(f.calls[kind],1);
 }
});
test('hold arriving during provider verification prevents transfer, wrong proof cannot settle',async()=>{
 const f=await fixture(),id=await booking(f);await f.service.createPayment(id);f.paid(id);await f.service.settle(id);returned(id);
 f.stripe.balanceTransactions.retrieve=async()=>{f.service.setHold(id,'Synthetic dispute hold');return {currency:'eur',amount:10000,fee:175,net:9825,status:'available'};};
 await assert.rejects(f.service.transfer(id));assert.equal(f.calls.transfer,0);
 const g=await fixture(),other=await booking(g);await g.service.createPayment(other);g.paid(other);
 g.stripe.charges.retrieve=async()=>({livemode:false});await assert.rejects(g.service.settle(other));
 assert.notEqual(d.getRentalBookingById(other).paymentStatus,'paid');
});
test('commercial factory rejects disabled execution, TEST mode and wrong platform before financial work',async()=>{
 const f=await fixture();
 await assert.rejects(createCommercialSctRuntime({db:d.db,stripe:f.stripe,env:{...env,COMMERCIAL_SCT_RUNTIME_ENABLED:'false'}}),{code:'COMMERCIAL_EXECUTION_NOT_APPROVED'});
 await assert.rejects(createCommercialSctRuntime({db:d.db,stripe:f.stripe,env:{...env,STRIPE_MODE:'test'}}),{code:'COMMERCIAL_EXECUTION_NOT_APPROVED'});
 await assert.rejects(f.service.createPayment('RB-historical-never-enrolled'));
 assert.deepEqual(f.calls,{payment:0,refund:0,transfer:0});
});
test('checkout repeats reuse the one intent; unpaid cancellation prevents future payment',async()=>{
 const f=await fixture(),id=await booking(f);
 const first=await f.service.createPayment(id),again=await f.service.createPayment(id);
 assert.equal(first.paymentIntentId,again.paymentIntentId);assert.equal(f.calls.payment,1);
 assert.equal((await f.service.cancelUnpaid(id)).status,'cancelled');
 await assert.rejects(f.service.createPayment(id));await assert.rejects(f.service.settle(id));
 assert.equal(d.getRentalBookingById(id).status,'cancelled');assert.equal(f.calls.refund,0);
 const other=await booking(f);await f.service.cancelUnpaid(other);
 assert.equal(d.getRentalBookingById(other).status,'cancelled');assert.equal(f.calls.payment,1);
});
test('worker transfers only returned rentals and reconciles a pending refund without a new request',async()=>{
 const f=await fixture(),id=await booking(f);await f.service.createPayment(id);f.paid(id);await f.service.settle(id);
 await f.service.sweep();assert.equal(f.calls.transfer,0);returned(id);
 await f.service.sweep();await f.service.sweep();assert.equal(f.calls.transfer,1);
 const g=await fixture(),other=await booking(g);await g.service.createPayment(other);g.paid(other);await g.service.settle(other);
 const retrieve=g.stripe.refunds.retrieve;g.stripe.refunds.retrieve=async id=>({...await retrieve(id),status:'pending'});
 await assert.rejects(g.service.refund(other,10000));assert.equal(d.getRentalBookingById(other).paymentStatus,'refund_pending');
 g.stripe.refunds.retrieve=retrieve;await g.service.sweep();await g.service.sweep();
 assert.equal(d.getRentalBookingById(other).paymentStatus,'refunded');assert.equal(g.calls.refund,1);
});
test('missing or ambiguous provider evidence never permits another financial request',async()=>{
 const f=await fixture(),id=await booking(f);f.fault.payment=true;await assert.rejects(f.service.createPayment(id));
 f.stripe.paymentIntents.list=async()=>({data:[],has_more:false});
 await assert.rejects(f.service.recover(id,'payment'),{code:'SCT_MANUAL_RECONCILIATION_REQUIRED'});
 await assert.rejects(f.service.createPayment(id));assert.equal(f.calls.payment,1);
 const g=await fixture(),other=await booking(g);await g.service.createPayment(other);g.paid(other);await g.service.settle(other);
 returned(other);g.fault.transfer=true;await assert.rejects(g.service.transfer(other));
 const original=g.transfers[0];g.stripe.transfers.list=async()=>({data:[original,{...original,id:'tr_duplicateEvidence'}],has_more:false});
 await assert.rejects(g.service.recover(other,'transfer'),{code:'SCT_MANUAL_RECONCILIATION_REQUIRED'});
 await assert.rejects(g.service.transfer(other));assert.equal(g.calls.transfer,1);
});

test('blocked old commands do not starve later uncertain payments across worker sweeps',async()=>{
 const f=await fixture(),ids=[];
 for(let n=0;n<11;n++){const id=await booking(f);ids.push(id);f.fault.payment=true;await assert.rejects(f.service.createPayment(id));}
 const list=f.stripe.paymentIntents.list;
 f.stripe.paymentIntents.list=async args=>{const page=await list(args);return {...page,data:page.data.filter(p=>p.metadata.bookingId===ids[10])};};
 await f.service.sweep();await f.service.sweep();
 assert.equal(d.db.prepare("SELECT status FROM commercial_sct_commands WHERE booking_id=? AND kind='payment'").get(ids[10]).status,'done');
 assert.equal(f.calls.payment,11);
});

test('worker recovery results cannot leak a PaymentIntent client secret to operational logs',async()=>{
 const f=await fixture(),id=await booking(f);f.fault.payment=true;await assert.rejects(f.service.createPayment(id));
 const result=await f.service.sweep();assert.equal(JSON.stringify(result).includes('synthetic_secret'),false);
 assert.equal(JSON.stringify(result).includes('clientSecret'),false);assert.equal(f.calls.payment,1);
});

test('signed platform LIVE-shaped event settles once; TEST, connected-account and conflicting events fail closed',async()=>{
 const f=await fixture(),id=await booking(f);await f.service.createPayment(id);f.paid(id);
 const event={id:'evt_commercialProof',type:'payment_intent.succeeded',livemode:true,data:{object:f.pis[0]}};
 const payload=JSON.stringify(event),secret='whsec_synthetic_commercial_only';
 const header=f.stripe.webhooks.generateTestHeaderString({payload,secret});
 assert.throws(()=>f.stripe.webhooks.constructEvent(payload,header,'whsec_wrong'));
 const verified=f.stripe.webhooks.constructEvent(payload,header,secret);
 await assert.rejects(f.service.handleVerifiedEvent({...verified,id:'evt_wrongMode',livemode:false}));
 await assert.rejects(f.service.handleVerifiedEvent({...verified,id:'evt_wrongAccount',account:'acct_other'}));
 assert.equal((await f.service.handleVerifiedEvent(verified)).handled,true);
 assert.equal((await f.service.handleVerifiedEvent(verified)).duplicate,true);
 assert.equal(d.getRentalBookingById(id).paymentStatus,'paid');assert.equal(f.calls.payment,1);
 await assert.rejects(f.service.handleVerifiedEvent({...verified,type:'payment_intent.payment_failed'}),{code:'COMMERCIAL_EVENT_IDENTITY_CONFLICT'});
});
test('provider-confirmed platform dispute blocks 85 percent transfer, including after dispute closes',async()=>{
 const f=await fixture(),id=await booking(f);await f.service.createPayment(id);f.paid(id);await f.service.settle(id);returned(id);
 const dispute={id:'dp_syntheticCommercial',payment_intent:f.pis[0].id,charge:f.charges[0].id,currency:'eur',amount:10000,status:'won',livemode:true};
 f.stripe.disputes.retrieve=async()=>dispute;
 await f.service.handleVerifiedEvent({id:'evt_commercialDispute',type:'charge.dispute.closed',livemode:true,data:{object:dispute}});
 await assert.rejects(f.service.transfer(id),{code:'SCT_FINANCIAL_HOLD'});assert.equal(f.calls.transfer,0);
});
test('lost webhook is recovered by bounded payment polling, without a second payment request',async()=>{
 const f=await fixture(),id=await booking(f);await f.service.createPayment(id);f.paid(id);
 await f.service.sweep();assert.equal(d.getRentalBookingById(id).paymentStatus,'paid');assert.equal(f.calls.payment,1);
});
test('LIVE binding rejects TEST provider truth and a changed platform identity',async()=>{
 const f=await fixture(),id=await booking(f);await f.service.createPayment(id);f.paid(id);f.pis[0].livemode=false;
 await assert.rejects(f.service.settle(id));assert.notEqual(d.getRentalBookingById(id).paymentStatus,'paid');
 f.stripe.accounts.retrieve=async()=>({id:'acct_wrong',charges_enabled:true,payouts_enabled:true,details_submitted:true,capabilities:{card_payments:'active'},requirements:{currently_due:[],past_due:[]}});
 await assert.rejects(createCommercialSctRuntime({db:d.db,stripe:f.stripe,env}),{code:'COMMERCIAL_PLATFORM_NOT_READY'});
 assert.equal(f.calls.payment,1);
});
test('commercial recipient reassignment and enrollment outside a fresh transaction are refused',async()=>{
 const f=await fixture();await f.service.registerRecipient(supplier,account.id,'individual');
 f.stripe.v2.core.accounts.retrieve=async id=>({...account,id});
 await assert.rejects(f.service.registerRecipient(supplier,'acct_reassigned','individual'),{code:'COMMERCIAL_RECIPIENT_REBIND_REQUIRES_REVIEW'});
 assert.throws(()=>f.service.enrollNewBooking('RB-old',supplier),{code:'COMMERCIAL_NEW_BOOKING_TRANSACTION_REQUIRED'});
});

test('settlement and recovered full refund atomically enqueue one message per party without sending',async()=>{
 const f=await fixture(),id=await booking(f);await f.service.createPayment(id);f.paid(id);
 await f.service.settle(id);await f.service.settle(id);
 f.fault.refund=true;await assert.rejects(f.service.refund(id,10000));await f.service.recover(id,'refund');await f.service.recover(id,'refund');
 const rows=d.db.prepare("SELECT recipient,template_key,payload_json FROM email_outbox WHERE dedupe_key LIKE ?").all('booking:'+id+':%');
 assert.equal(rows.length,4);assert.equal(rows.filter(x=>x.template_key.startsWith('booking_paid')).length,2);
 assert.equal(rows.filter(x=>x.template_key.startsWith('booking_cancelled')).length,2);
 assert.ok(rows.every(x=>!x.payload_json.includes('before Stripe processing fees')));
});

test('bounded retry reuses original key and payload; expired window and changed payload cannot write',async()=>{
 const f=await fixture(),id=await booking(f);let firstKey,requests=0;const create=f.stripe.paymentIntents.create;
 f.stripe.paymentIntents.create=async(payload,options)=>{requests++;if(requests===1){firstKey=options.idempotencyKey;throw Error('synthetic connection failure before acceptance');}assert.equal(options.idempotencyKey,firstKey);return create(payload,options);};
 await assert.rejects(f.service.createPayment(id));await f.service.retryUncertain(id,'payment');
 assert.equal(f.calls.payment,1);assert.equal(requests,2);
 const g=await fixture(),other=await booking(g);g.fault.payment=true;await assert.rejects(g.service.createPayment(other));
 g.stripe.paymentIntents.list=async()=>({data:[],has_more:false});
 d.db.prepare("UPDATE commercial_sct_commands SET created_ms=? WHERE booking_id=? AND kind='payment'").run(Date.now()-24*3600000,other);
 await assert.rejects(g.service.retryUncertain(other,'payment'),{code:'COMMERCIAL_RETRY_WINDOW_EXPIRED'});assert.equal(g.calls.payment,1);
 d.db.prepare("UPDATE commercial_sct_commands SET payload_json='{}' WHERE booking_id=? AND kind='payment'").run(other);
 await assert.rejects(g.service.retryUncertain(other,'payment'),{code:'COMMERCIAL_COMMAND_PAYLOAD_CHANGED'});assert.equal(g.calls.payment,1);
});

test('commercial startup rejects even unpaid TEST enrollments without changing them',async()=>{
 const f=await fixture();d.db.exec('CREATE TABLE sct_test_enrollments(booking_id TEXT PRIMARY KEY)');
 try{d.db.prepare('INSERT INTO sct_test_enrollments VALUES(?)').run('RB-unpaidSyntheticTest');
 await assert.rejects(createCommercialSctRuntime({db:d.db,stripe:f.stripe,env}),{code:'COMMERCIAL_TEST_DATA_PRESENT'});
 assert.equal(d.db.prepare('SELECT count(*) n FROM sct_test_enrollments').get().n,1);
 }finally{d.db.exec('DROP TABLE sct_test_enrollments');}
});

test('account ID supplied by an administrator cannot replace authenticated recipient ownership binding',async()=>{
 const f=await fixture();d.db.prepare("UPDATE stripe_connections SET connect_api='v2_merchant_direct' WHERE user_email=?").run(supplier);
 await assert.rejects(f.service.registerRecipient(supplier,account.id,'individual'),{code:'COMMERCIAL_AUTHENTICATED_RECIPIENT_BINDING_REQUIRED'});
 assert.equal(f.calls.transfer,0);
});

test('new commercial transfer requires both return confirmations and one invoice; repeated confirmation cannot duplicate either',async()=>{
 const f=await fixture(),id=await booking(f);await f.service.createPayment(id);f.paid(id);await f.service.settle(id);returned(id);
 d.db.prepare("DELETE FROM commission_return_acceptance WHERE booking_id=? AND party='customer'").run(id);
 await assert.rejects(f.service.transfer(id),{code:'COMMISSION_BOTH_RETURN_ACCEPTANCES_REQUIRED'});assert.equal(f.calls.transfer,0);assert.equal(d.db.prepare('SELECT count(*) n FROM commission_documents WHERE booking_id=?').get(id).n,0);
 const u=d.db.prepare('SELECT user_id FROM app_users WHERE email=?').get(customer);f.service.commission.accept(id,{userId:u.user_id,email:customer});
 await f.service.transfer(id);f.service.commission.accept(id,{userId:u.user_id,email:customer});await assert.rejects(f.service.transfer(id));
 assert.equal(f.calls.transfer,1);assert.equal(d.db.prepare("SELECT count(*) n FROM commission_documents WHERE booking_id=? AND kind='invoice'").get(id).n,1);
});

test('commercial booking route checks listing declaration before inventory or payment enrollment',()=>{
 const server=fs.readFileSync(new URL('./server.js',import.meta.url),'utf8');
 const route=server.split("app.post('/api/rentals/bookings',")[1].split("const agreement=createRentalAgreement(")[0];
 const transaction=route.indexOf('const result = db.transaction(');
 const gate=route.indexOf('if(commercialRuntime&&(!revision||!currentDeclarations.length))');
 const inventory=route.indexOf('const created=createRentalBookingAtomic(');
 const enrollment=route.indexOf('sctRuntime.enrollNewBooking(');
 const archive=route.indexOf("INSERT INTO booking_listing_revision_evidence_v1");
 const commit=route.indexOf('}).immediate()');
 assert.ok(transaction>=0&&transaction<gate&&gate<inventory&&inventory<enrollment&&enrollment<archive&&archive<commit);
 assert.match(route.slice(gate,inventory),/LISTING_RISK_RECONFIRMATION_REQUIRED/);
});
