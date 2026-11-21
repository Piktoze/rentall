
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import http from 'node:http';import https from 'node:https';
http.request=https.request=()=>{throw Error('Commercial rehearsal forbids network');};
const root=process.env.COMMERCIAL_RESTART_ROOT;
fs.writeFileSync(path.join(root,'.rentinorbit-commercial.json'),JSON.stringify({version:1,purpose:'fresh-commercial-live',platformAccount:'acct_commercialPlatform',policy:'sct-a-15-85-v1'}));
import assert from 'node:assert/strict';
process.env.NODE_ENV='test';process.env.DB_PATH=path.join(root,'commercial.sqlite');process.env.PRIVATE_TEST_ENABLED='false';
for(const k of ['DATABASE_URL','RENTINORBIT_DB_PATH','RAILWAY_ENVIRONMENT_ID','RAILWAY_PROJECT_ID','RAILWAY_SERVICE_ID','RAILWAY_VOLUME_MOUNT_PATH'])delete process.env[k];
const d=await import('../db.js');
const {createCommercialSctRuntime}=await import('../modules/commercial-sct-runtime.js');

const {createCommercialStripeClient}=await import('../modules/commercial-sct-client.js');
const key='sk_live_synthetic_never_sent_to_stripe';
const env={NODE_ENV:'test',STRIPE_MODE:'live',PRIVATE_TEST_ENABLED:'false',COMMERCIAL_SCT_RUNTIME_ENABLED:'true',COMMERCIAL_SCT_POLICY_VERSION:'sct-a-15-85-v1',COMMERCIAL_STRIPE_PLATFORM_ACCOUNT_ID:'acct_commercialPlatform',COMMERCIAL_SCT_STORAGE_ROOT:root,STRIPE_SECRET_KEY:key,RENTINORBIT_SCT_TEST_RUNTIME:'false',SCT_STRIPE_FEE_PAYER:'platform'};
let seq=0;
const supplier='sct-supplier@example.test',customer='sct-renter@example.test';
if(!d.db.prepare('SELECT 1 FROM app_users WHERE email=?').get(supplier))d.createAppUser({email:supplier,password:'SyntheticPassword123',role:'supplier'});
if(!d.db.prepare('SELECT 1 FROM app_users WHERE email=?').get(customer))d.createAppUser({email:customer,password:'SyntheticPassword123',role:'customer'});
d.upsertRentalListing({listingId:'sct-runtime-item',ownerEmail:supplier,title:'SCT synthetic item',totalQuantity:100});
const account={id:'acct_runtimeTest',livemode:true,identity:{country:'LT',entity_type:'individual'},dashboard:'express',
 defaults:{responsibilities:{fees_collector:'application',losses_collector:'application'}},requirements:{entries:[]},
 configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{status:'active'}}}}}};
async function fixture(payer='platform'){
 const stripe=createCommercialStripeClient(key),stateFile=path.join(root,'provider.json');
 const state=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile,'utf8')):{pis:[],charges:[],refunds:[],transfers:[],calls:{payment:0,refund:0,transfer:0}};
 const {pis,charges,refunds,transfers}=state;
 const persist=kind=>{fs.writeFileSync(stateFile,JSON.stringify(state));if(process.env.SCT_KILL_KIND===kind)process.kill(process.pid,'SIGKILL');};
 const calls=state.calls,fault={};
 const list=data=>async()=>({data,has_more:false});
 stripe.accounts.retrieve=async()=>({id:'acct_commercialPlatform',charges_enabled:true,payouts_enabled:true,details_submitted:true,capabilities:{card_payments:'active'},requirements:{currently_due:[],past_due:[]}});
 stripe.v2.core.accounts.retrieve=async()=>account;
 stripe.paymentIntents.create=async payload=>{calls.payment++;const p={...payload,id:'pi_runtime'+(++seq),livemode:true,
  client_secret:'synthetic_secret',status:'requires_payment_method'};pis.push(p);persist('payment');if(fault.payment)throw Error('connection lost after provider commit');return p;};
 stripe.paymentIntents.retrieve=async id=>pis.find(p=>p.id===id);
 stripe.paymentIntents.cancel=async id=>{const p=pis.find(p=>p.id===id);if(p.status==='succeeded')throw Error('already paid');p.status='canceled';return p;};
 stripe.paymentIntents.list=list(pis);
 stripe.charges.retrieve=async id=>charges.find(c=>c.id===id);
 stripe.balanceTransactions.retrieve=async()=>({id:'txn_runtime',currency:'eur',amount:10000,fee:175,net:9825,status:'available'});
 stripe.refunds.list=async({charge}={})=>({data:refunds.filter(r=>!charge||r.charge===charge),has_more:false});
 stripe.refunds.create=async payload=>{calls.refund++;const r={...payload,currency:'eur',id:'re_runtime'+(++seq),livemode:true,status:'succeeded',
  payment_intent:charges.find(c=>c.id===payload.charge).payment_intent};refunds.push(r);
  persist('refund');if(fault.refund)throw Error('connection lost after refund');return r;};
 stripe.refunds.retrieve=async id=>refunds.find(r=>r.id===id);
 stripe.disputes.list=list([]);
 stripe.transfers.list=async({transfer_group}={})=>({data:transfers.filter(t=>!transfer_group||t.transfer_group===transfer_group),has_more:false});
 stripe.transfers.create=async payload=>{calls.transfer++;const t={...payload,id:'tr_runtime'+(++seq),livemode:true,reversed:false};transfers.push(t);
  persist('transfer');if(fault.transfer)throw Error('connection lost after transfer');return t;};
 stripe.transfers.retrieve=async id=>transfers.find(t=>t.id===id);
 const userId=d.db.prepare('SELECT user_id FROM app_users WHERE email=?').get(supplier).user_id;
 d.saveStripeConnection({userId,userEmail:supplier,stripeAccountId:account.id,connectApi:'v2_recipient_sct_live',transferCapabilityStatus:'active',requirements:[]});
 const service=await createCommercialSctRuntime({db:d.db,stripe,env:{...env,SCT_STRIPE_FEE_PAYER:payer}});
 function paid(id){const p=pis.find(x=>x.metadata.bookingId===id);Object.assign(p,{status:'succeeded',amount_received:p.amount,latest_charge:'ch_runtime'+(++seq)});
  charges.push({id:p.latest_charge,livemode:true,payment_intent:p.id,status:'succeeded',paid:true,captured:true,
   amount:p.amount,amount_captured:p.amount,amount_refunded:0,refunded:false,disputed:false,currency:'eur',balance_transaction:'txn_runtime'});persist('paid');}
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
 d.markRentalReturned(id,'good');}

const action=process.argv[2],kind=process.argv[3],f=await fixture();
const idFile=path.join(root,'booking-id');
if(action==='crash'){
 const id=await booking(f);fs.writeFileSync(idFile,id);
 await f.service.createPayment(id);
 if(kind!=='payment'){f.paid(id);await f.service.settle(id);if(kind==='transfer')returned(id);
  await (kind==='transfer'?f.service.transfer(id):f.service.refund(id,10000));}
 throw Error('Expected SIGKILL did not happen');
}else{
 const id=fs.readFileSync(idFile,'utf8');
 await f.service.sweep();await f.service.sweep();
 const result=await f.service.recover(id,kind);
 const row=d.getRentalBookingById(id);
 console.log(JSON.stringify({result,journalSynchronous:d.db.pragma('synchronous',{simple:true}),calls:f.calls,booking:{payment:row.paymentStatus,payout:row.payoutStatus,status:row.status,amount:row.payoutAmount,refund:row.refundAmount}}));
 d.closeDatabase();
}
