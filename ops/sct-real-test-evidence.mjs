// Explicit one-shot build-time TEST validation; never opens a mounted database.
import assert from 'node:assert/strict';
import {createIsolatedStripeTestClient} from '../modules/isolated-stripe-test-client.js';
import {planIsolatedSctRecipientOnboarding} from '../modules/isolated-sct-recipient-onboarding-plan.js';
import {inspectIsolatedSctRecipientAccount} from '../modules/isolated-sct-recipient-account-gate.js';
import {createSctTestRuntime} from '../modules/sct-test-runtime.js';
const run=process.env.RENTINORBIT_SCT_REAL_TEST_RUN_ID;
if(!/^[a-f0-9]{32}$/.test(run||'')||process.env.RENTINORBIT_STAGING!=='true'||
 process.env.STRIPE_MODE!=='test'||! /^[sr]k_test_[A-Za-z0-9_-]{8,}$/.test(process.env.STRIPE_SECRET_KEY||''))
 throw new Error('EXPLICIT_STAGING_TEST_RUN_REQUIRED');
const report={type:'real_sct_test_evidence',run,storage:'memory',liveFinancialOperations:false,scenarioA:'BLOCKED',scenarioB:'BLOCKED'};
let step='verify_platform';
const safeError=e=>({code:e.code||e.type||e.name,requestId:e.requestId||null,
 message:String(e.message||'').replace(/(?:[sr]k_(?:test|live)_[A-Za-z0-9_-]+|whsec_[A-Za-z0-9_-]+|pi_[A-Za-z0-9]+_secret_[A-Za-z0-9]+)/g,'[redacted]').slice(0,500)});
try{
 const stripe=createIsolatedStripeTestClient(process.env.STRIPE_SECRET_KEY);
 const balance=await stripe.balance.retrieve();assert.equal(balance.livemode,false);
 const platform=await stripe.accounts.retrieve();
 if(!['acct_1UT4J2LlutaSFdau','acct_1UT4JCLM72MR015z'].includes(platform.id))throw new Error('EXPECTED_PLATFORM_TEST_ACCOUNT_REQUIRED');
 report.platformAccountId=platform.id;report.providerModeVerified='TEST';
 step='create_new_synthetic_recipient';
 const supplier='synthetic-sct-'+run+'@example.test',customer='synthetic-renter-'+run+'@example.test';
 const plan=planIsolatedSctRecipientOnboarding({stripeMode:'test',country:'LT',entityType:'individual',contactEmail:supplier,
  displayName:'RentInOrbit synthetic TEST '+run,termsAccepted:true,platformLiabilityApproved:true});
 if(plan.blocked)throw new Error(plan.blocked);
 const created=await stripe.v2.core.accounts.create(plan.accountCreatePayload,{idempotencyKey:'rio-synthetic-recipient-'+run});
 report.recipientAccountId=created.id;
 step='verify_new_recipient';
 const recipient=await stripe.v2.core.accounts.retrieve(created.id,{include:['identity','configuration.recipient','configuration.merchant','requirements','defaults']});
 const gate=inspectIsolatedSctRecipientAccount(recipient,{expectedAccountId:created.id,expectedEntityType:'individual'});
 if(gate.blocked){report.recipientBlocker=gate.blocked;report.transferCapability=recipient.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status;
  report.recipientRequirementCount=recipient.requirements?.entries?.length??null;throw new Error(gate.blocked);}
 // Isolate db.js's actual canonical rental tables before importing it.
 process.env.NODE_ENV='test';process.env.DB_PATH=':memory:';process.env.RENTINORBIT_CATALOG_ONLY='false';
 process.env.RENTINORBIT_SCT_TEST_RUNTIME='true';process.env.SCT_STRIPE_FEE_PAYER='platform';process.env.PLATFORM_FEE_PERCENT='15';
 for(const k of ['DATABASE_URL','RENTINORBIT_DB_PATH','RAILWAY_ENVIRONMENT_ID','RAILWAY_PROJECT_ID','RAILWAY_SERVICE_ID','RAILWAY_VOLUME_MOUNT_PATH','PERSISTENT_DATA_DIR'])delete process.env[k];
 const d=await import('../db.js');assert.equal(d.db.name,':memory:');
 d.createAppUser({email:supplier,password:'SyntheticOnly-'+run,role:'supplier'});
 d.createAppUser({email:customer,password:'SyntheticOnly-'+run,role:'customer'});
 const listing='sct-real-'+run;d.upsertRentalListing({listingId:listing,ownerEmail:supplier,title:'Synthetic TEST only',totalQuantity:10});
 const rt=createSctTestRuntime({db:d.db,stripe,env:process.env});await rt.registerRecipient(supplier,created.id,'individual');
 async function booking(suffix){const id='RB-real-'+run+'-'+suffix;d.db.transaction(()=>{
  d.createRentalBookingAtomic({bookingId:id,listingId:listing,startDate:'2099-01-01',endDate:'2099-01-02',quantity:1,status:'pending',customerEmail:customer,customerName:'Synthetic TEST renter',orderValue:100});
  rt.enrollNewBooking(id,supplier);
 }).immediate();d.updateRentalBookingStatus(id,'confirmed');return id;}
 async function pay(id){const result=await rt.createPayment(id);
  await stripe.paymentIntents.confirm(result.paymentIntentId,{payment_method:'pm_card_visa',return_url:'https://rentall-staging.up.railway.app/'});
  const pi=await stripe.paymentIntents.retrieve(result.paymentIntentId);assert.equal(pi.livemode,false);assert.equal(pi.status,'succeeded');
  await rt.settle(id);assert.equal((await rt.settle(id)).duplicate,true);
  return {bookingId:id,paymentIntentId:pi.id,chargeId:typeof pi.latest_charge==='string'?pi.latest_charge:pi.latest_charge.id,amountCents:10000,commissionCents:1500};}
 step='scenario_A';const a=await booking('A');
 report.A=await pay(a);await assert.rejects(rt.transfer(a));
 d.createRentalAgreement({bookingId:a,termsVersion:'synthetic-test-only',snapshot:{total:100}});
 d.acceptRentalAgreement(a,'customer',{actorEmail:customer,authMethod:'session'});d.acceptRentalAgreement(a,'supplier',{actorEmail:supplier,authMethod:'session'});
 const pin=d.issueRentalTransferCode(a,'pickup','customer');assert.equal(d.verifyAndConsumeRentalTransferCode(a,'pickup',pin.code).ok,true);
 d.markRentalReturned(a,'good');
 try{const t=await rt.transfer(a);assert.equal(t.amountCents,8500);await assert.rejects(rt.transfer(a));report.A.transfer=t;report.scenarioA='PASS';}
 catch(e){report.A.blocker=safeError(e);}
 step='scenario_B';const b=await booking('B');report.B=await pay(b);
 const refund=await rt.refund(b,10000);assert.equal(refund.amountCents,10000);await assert.rejects(rt.refund(b,10000));await assert.rejects(rt.settle(b));
 report.B.refund=refund;const final=d.getRentalBookingById(b);report.B.finalState={status:final.status,paymentStatus:final.paymentStatus,refundStatus:final.refundStatus,refundAmount:final.refundAmount,payoutStatus:final.payoutStatus};
 report.scenarioB='PASS';
 const held=await booking('hold');rt.setHold(held,'Synthetic explicit financial hold');await assert.rejects(rt.transfer(held),{code:'SCT_FINANCIAL_HOLD'});
 report.holdBlocked=true;
 const events=await stripe.events.list({type:'payment_intent.succeeded',limit:100});
 report.providerEventIds=events.data.filter(e=>[report.A.paymentIntentId,report.B.paymentIntentId].includes(e.data?.object?.id)).map(e=>e.id);
 report.webhookTransportVerified=false;report.bankPayoutVerified=false;d.db.close();
}catch(e){report.blockedAt=step;report.blocker=safeError(e);}
// A BLOCKED financial test is explicit evidence, never a build/launch GO.
console.log(JSON.stringify(report));
