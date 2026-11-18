import test from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV='test';process.env.DB_PATH=':memory:';
for(const k of ['DATABASE_URL','RENTINORBIT_DB_PATH','RAILWAY_ENVIRONMENT_ID','RAILWAY_PROJECT_ID','RAILWAY_SERVICE_ID','RAILWAY_VOLUME_MOUNT_PATH'])delete process.env[k];
const d=await import('./db.js');
const {createSctTestRuntime,assertSctTestStorage}=await import('./modules/sct-test-runtime.js');
const {createIsolatedStripeTestClient}=await import('./modules/isolated-stripe-test-client.js');
const key='sk_test_synthetic_never_sent_to_stripe';
const env={NODE_ENV:'test',STRIPE_MODE:'test',STRIPE_SECRET_KEY:key,RENTINORBIT_SCT_TEST_RUNTIME:'true',SCT_STRIPE_FEE_PAYER:'platform'};
let seq=0;
const supplier='sct-supplier@example.test',customer='sct-renter@example.test';
d.createAppUser({email:supplier,password:'SyntheticPassword123',role:'supplier'});
d.createAppUser({email:customer,password:'SyntheticPassword123',role:'customer'});
d.upsertRentalListing({listingId:'sct-runtime-item',ownerEmail:supplier,title:'SCT synthetic item',totalQuantity:100});
const account={id:'acct_runtimeTest',livemode:false,identity:{country:'LT',entity_type:'individual'},dashboard:'express',
 defaults:{responsibilities:{fees_collector:'application',losses_collector:'application'}},requirements:{entries:[]},
 configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{status:'active'}}}}}};
function fixture(payer='platform'){
 const stripe=createIsolatedStripeTestClient(key),pis=[],charges=[],refunds=[],transfers=[];
 const calls={payment:0,refund:0,transfer:0},fault={};
 const list=data=>async()=>({data,has_more:false});
 stripe.v2.core.accounts.retrieve=async()=>account;
 stripe.paymentIntents.create=async payload=>{calls.payment++;const p={...payload,id:'pi_runtime'+(++seq),livemode:false,
  client_secret:'synthetic_secret',status:'requires_payment_method'};pis.push(p);if(fault.payment)throw Error('connection lost after provider commit');return p;};
 stripe.paymentIntents.retrieve=async id=>pis.find(p=>p.id===id);
 stripe.paymentIntents.cancel=async id=>{const p=pis.find(p=>p.id===id);if(p.status==='succeeded')throw Error('already paid');p.status='canceled';return p;};
 stripe.paymentIntents.list=list(pis);
 stripe.charges.retrieve=async id=>charges.find(c=>c.id===id);
 stripe.balanceTransactions.retrieve=async()=>({id:'txn_runtime',currency:'eur',amount:10000,fee:175,net:9825,status:'available'});
 stripe.refunds.list=async({charge}={})=>({data:refunds.filter(r=>!charge||r.charge===charge),has_more:false});
 stripe.refunds.create=async payload=>{calls.refund++;const r={...payload,currency:'eur',id:'re_runtime'+(++seq),livemode:false,status:'succeeded',
  payment_intent:charges.find(c=>c.id===payload.charge).payment_intent};refunds.push(r);
  if(fault.refund)throw Error('connection lost after refund');return r;};
 stripe.refunds.retrieve=async id=>refunds.find(r=>r.id===id);
 stripe.disputes.list=list([]);
 stripe.transfers.list=async({transfer_group}={})=>({data:transfers.filter(t=>!transfer_group||t.transfer_group===transfer_group),has_more:false});
 stripe.transfers.create=async payload=>{calls.transfer++;const t={...payload,id:'tr_runtime'+(++seq),livemode:false,reversed:false};transfers.push(t);
  if(fault.transfer)throw Error('connection lost after transfer');return t;};
 stripe.transfers.retrieve=async id=>transfers.find(t=>t.id===id);
 const service=createSctTestRuntime({db:d.db,stripe,env:{...env,SCT_STRIPE_FEE_PAYER:payer}});
 function paid(id){const p=pis.find(x=>x.metadata.bookingId===id);Object.assign(p,{status:'succeeded',amount_received:p.amount,latest_charge:'ch_runtime'+(++seq)});
  charges.push({id:p.latest_charge,livemode:false,payment_intent:p.id,status:'succeeded',paid:true,captured:true,
   amount:p.amount,amount_captured:p.amount,amount_refunded:0,refunded:false,disputed:false,currency:'eur',balance_transaction:'txn_runtime'});}
 return {service,stripe,paid,calls,fault,transfers,refunds};
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
 d.markRentalReturned(id,'good');}

test('SCT A: new booking, platform payment, two agreements, handover, return, one 85 EUR transfer',async()=>{
 const f=fixture(),id=await booking(f);
 await f.service.createPayment(id);await assert.rejects(f.service.transfer(id));assert.equal(f.calls.transfer,0);
 f.paid(id);await f.service.settle(id);assert.equal((await f.service.settle(id)).duplicate,true);
 returned(id);const attempts=await Promise.allSettled([f.service.transfer(id),f.service.transfer(id)]);
 assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);assert.equal(f.calls.transfer,1);
 assert.equal(f.transfers[0].amount,8500);assert.equal(d.getRentalBookingById(id).payoutStatus,'transferred');
 await assert.rejects(f.service.refund(id,10000));assert.equal(f.calls.refund,0);
});
test('SCT B: independent new booking, full refund, duplicate refund and transfer blocked',async()=>{
 const f=fixture(),id=await booking(f);await f.service.createPayment(id);f.paid(id);await f.service.settle(id);
 assert.equal((await f.service.refund(id,10000)).status,'refunded');
 await assert.rejects(f.service.refund(id,10000));await assert.rejects(f.service.settle(id));
 await assert.rejects(f.service.transfer(id));assert.equal(f.calls.refund,1);assert.equal(f.calls.transfer,0);
 const b=d.getRentalBookingById(id);assert.equal(b.status,'cancelled');assert.equal(b.paymentStatus,'refunded');assert.equal(b.refundAmount,100);
 assert.equal(b.platformFeeAmount,0);assert.equal(b.supplierAmount,0);
});
test('Stripe fee paid by supplier means 83.25 EUR, not an advertised net 85 EUR',async()=>{
 const f=fixture('supplier'),id=await booking(f);await f.service.createPayment(id);f.paid(id);await f.service.settle(id);returned(id);
 assert.equal((await f.service.transfer(id)).amountCents,8325);
});
test('unknown payment result recovers provider object after restart without another create',async()=>{
 const f=fixture(),id=await booking(f);f.fault.payment=true;await assert.rejects(f.service.createPayment(id));
 const restarted=createSctTestRuntime({db:d.db,stripe:f.stripe,env});
 assert.equal((await restarted.recover(id,'payment')).paymentIntentId.startsWith('pi_'),true);assert.equal(f.calls.payment,1);
});
test('unknown transfer and refund results reconcile once; a crash never authorizes a second request',async()=>{
 for(const kind of ['transfer','refund']){
  const f=fixture(),id=await booking(f);await f.service.createPayment(id);f.paid(id);await f.service.settle(id);
  if(kind==='transfer')returned(id);f.fault[kind]=true;
  await assert.rejects(kind==='transfer'?f.service.transfer(id):f.service.refund(id,10000));
  const restarted=createSctTestRuntime({db:d.db,stripe:f.stripe,env});
  assert.equal((await restarted.recover(id,kind)).status,kind==='transfer'?'transferred':'refunded');
  assert.equal((await restarted.recover(id,kind)).status,'already_reconciled');assert.equal(f.calls[kind],1);
 }
});
test('hold arriving during provider verification prevents transfer, wrong proof cannot settle',async()=>{
 const f=fixture(),id=await booking(f);await f.service.createPayment(id);f.paid(id);await f.service.settle(id);returned(id);
 f.stripe.balanceTransactions.retrieve=async()=>{f.service.setHold(id,'Synthetic dispute hold');return {currency:'eur',amount:10000,fee:175,net:9825,status:'available'};};
 await assert.rejects(f.service.transfer(id));assert.equal(f.calls.transfer,0);
 const g=fixture(),other=await booking(g);await g.service.createPayment(other);g.paid(other);
 g.stripe.charges.retrieve=async()=>({livemode:true});await assert.rejects(g.service.settle(other));
 assert.notEqual(d.getRentalBookingById(other).paymentStatus,'paid');
});
test('LIVE, /data and undecided fees cannot start SCT; unowned historical booking cannot be used',async()=>{
 assert.throws(()=>assertSctTestStorage({name:'/data/rentinorbit.sqlite'},env));
 assert.throws(()=>createSctTestRuntime({db:d.db,stripe:fixture().stripe,env:{...env,STRIPE_MODE:'live'}}));
 assert.throws(()=>createSctTestRuntime({db:d.db,stripe:fixture().stripe,env:{...env,SCT_STRIPE_FEE_PAYER:''}}));
 await assert.rejects(fixture().service.createPayment('RB-historical-never-enrolled'));
});
test('checkout repeats reuse the one intent; unpaid cancellation prevents future payment',async()=>{
 const f=fixture(),id=await booking(f);
 const first=await f.service.createPayment(id),again=await f.service.createPayment(id);
 assert.equal(first.paymentIntentId,again.paymentIntentId);assert.equal(f.calls.payment,1);
 assert.equal((await f.service.cancelUnpaid(id)).status,'cancelled');
 await assert.rejects(f.service.createPayment(id));await assert.rejects(f.service.settle(id));
 assert.equal(d.getRentalBookingById(id).status,'cancelled');assert.equal(f.calls.refund,0);
 const other=await booking(f);await f.service.cancelUnpaid(other);
 assert.equal(d.getRentalBookingById(other).status,'cancelled');assert.equal(f.calls.payment,1);
});
test('worker transfers only returned rentals and reconciles a pending refund without a new request',async()=>{
 const f=fixture(),id=await booking(f);await f.service.createPayment(id);f.paid(id);await f.service.settle(id);
 await f.service.sweep();assert.equal(f.calls.transfer,0);returned(id);
 await f.service.sweep();await f.service.sweep();assert.equal(f.calls.transfer,1);
 const g=fixture(),other=await booking(g);await g.service.createPayment(other);g.paid(other);await g.service.settle(other);
 const retrieve=g.stripe.refunds.retrieve;g.stripe.refunds.retrieve=async id=>({...await retrieve(id),status:'pending'});
 await assert.rejects(g.service.refund(other,10000));assert.equal(d.getRentalBookingById(other).paymentStatus,'refund_pending');
 g.stripe.refunds.retrieve=retrieve;await g.service.sweep();await g.service.sweep();
 assert.equal(d.getRentalBookingById(other).paymentStatus,'refunded');assert.equal(g.calls.refund,1);
});
test('missing or ambiguous provider evidence never permits another financial request',async()=>{
 const f=fixture(),id=await booking(f);f.fault.payment=true;await assert.rejects(f.service.createPayment(id));
 f.stripe.paymentIntents.list=async()=>({data:[],has_more:false});
 await assert.rejects(f.service.recover(id,'payment'),{code:'SCT_MANUAL_RECONCILIATION_REQUIRED'});
 await assert.rejects(f.service.createPayment(id));assert.equal(f.calls.payment,1);
 const g=fixture(),other=await booking(g);await g.service.createPayment(other);g.paid(other);await g.service.settle(other);
 returned(other);g.fault.transfer=true;await assert.rejects(g.service.transfer(other));
 const original=g.transfers[0];g.stripe.transfers.list=async()=>({data:[original,{...original,id:'tr_duplicateEvidence'}],has_more:false});
 await assert.rejects(g.service.recover(other,'transfer'),{code:'SCT_MANUAL_RECONCILIATION_REQUIRED'});
 await assert.rejects(g.service.transfer(other));assert.equal(g.calls.transfer,1);
});
