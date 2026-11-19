// Explicit one-shot build-time TEST validation; never opens a mounted database.
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';
import crypto from 'node:crypto';
import {createIsolatedStripeTestClient} from '../modules/isolated-stripe-test-client.js';
import {planIsolatedSctRecipientOnboarding} from '../modules/isolated-sct-recipient-onboarding-plan.js';
import {inspectIsolatedSctRecipientAccount} from '../modules/isolated-sct-recipient-account-gate.js';
import {createSctTestRuntime} from '../modules/sct-test-runtime.js';
const run=process.env.RENTINORBIT_SCT_REAL_TEST_RUN_ID;
if(!/^[a-f0-9]{32}$/.test(run||'')||process.env.RENTINORBIT_STAGING!=='true'||
 process.env.STRIPE_MODE!=='test'||! /^[sr]k_test_[A-Za-z0-9_-]{8,}$/.test(process.env.STRIPE_SECRET_KEY||''))
 throw new Error('EXPLICIT_STAGING_TEST_RUN_REQUIRED');
const report={type:'real_sct_test_evidence',run,storage:'memory',liveFinancialOperations:false,scenarioA:'BLOCKED',scenarioB:'BLOCKED'};
let temporary,listener,server,db;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const stop=child=>{if(child?.pid)try{process.kill(-child.pid,'SIGTERM');}catch{}};
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
 assert.equal(created.livemode,false);assert.equal(created.contact_email,supplier);
 // Official Stripe TEST fixtures, never the operator's identity or bank details.
 // https://docs.stripe.com/connect/testing?accounts-namespace=v2
 step='complete_synthetic_test_onboarding';
 const beforeOnboarding=await stripe.v2.core.accounts.retrieve(created.id,{include:['identity','defaults']});
 try{if(!beforeOnboarding.identity?.individual)await stripe.v2.core.accounts.update(created.id,{
  defaults:{profile:{business_url:'https://rentall-staging.up.railway.app'}},
  identity:{individual:{given_name:'Synthetic',surname:'Test',date_of_birth:{day:1,month:1,year:1902},
   address:{country:'LT',city:'Vilnius',postal_code:'01100',line1:'address_full_match'}}},
 },{idempotencyKey:'rio-synthetic-recipient-identity-v3-'+run});}
 catch(e){report.syntheticIdentityPreparationError=safeError(e);}
 try{const banks=await stripe.accounts.listExternalAccounts(created.id,{object:'bank_account',limit:10});
 if(!banks.data.length)await stripe.accounts.createExternalAccount(created.id,{external_account:{object:'bank_account',country:'LT',currency:'eur',
  account_number:'LT121000011101001000'},default_for_currency:true},{idempotencyKey:'rio-synthetic-recipient-test-bank-'+run});}
 catch(e){report.syntheticBankPreparationError=safeError(e);}
 step='verify_new_recipient';
 let recipient,gate;
 for(let i=0;i<10;i++){
  recipient=await stripe.v2.core.accounts.retrieve(created.id,{include:['identity','configuration.recipient','configuration.merchant','requirements','defaults']});
  gate=inspectIsolatedSctRecipientAccount(recipient,{expectedAccountId:created.id,expectedEntityType:'individual'});
  if(!gate.blocked)break;await new Promise(resolve=>setTimeout(resolve,1000));
 }
 if(gate.blocked){report.recipientBlocker=gate.blocked;report.transferCapability=recipient.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status;
  report.recipientRequirementCount=recipient.requirements?.entries?.length??null;
  report.recipientRequirements=recipient.requirements?.entries?.map(e=>({field:e.description,awaitingActionFrom:e.awaiting_action_from}));
  const key=process.env.SCT_TEST_ONBOARDING_RESULT_KEY;
  if(/^[a-f0-9]{64}$/.test(key||'')){
   const link=await stripe.v2.core.accountLinks.create({account:created.id,use_case:{type:'account_onboarding',account_onboarding:{
    configurations:['recipient'],collection_options:{fields:'currently_due'},refresh_url:'https://rentall-staging.up.railway.app/help',return_url:'https://rentall-staging.up.railway.app/'}}});
   assert.equal(link.livemode,false);assert.equal(link.account,created.id);
   const url=new URL(link.url);assert.equal(url.protocol,'https:');assert.equal(url.hostname,'connect.stripe.com');
   const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',Buffer.from(key,'hex'),iv);
   const encrypted=Buffer.concat([cipher.update(link.url,'utf8'),cipher.final()]);
   report.onboardingEnvelope=[iv,cipher.getAuthTag(),encrypted].map(x=>x.toString('hex')).join('.');report.onboardingExpiresAt=link.expires_at;
  }
  throw new Error(gate.blocked);}
 // Isolate db.js's actual canonical rental tables before importing it.
 temporary=fs.mkdtempSync(path.join(os.tmpdir(),'rio-real-sct-'));report.storage='temporary_sqlite';
 process.env.NODE_ENV='test';process.env.DB_PATH=path.join(temporary,'synthetic.sqlite');process.env.RENTINORBIT_CATALOG_ONLY='false';
 process.env.RENTINORBIT_SCT_TEST_RUNTIME='true';process.env.SCT_STRIPE_FEE_PAYER='platform';process.env.PLATFORM_FEE_PERCENT='15';
 process.env.PRIVATE_TEST_ENABLED='false';process.env.PRIVATE_TEST_REQUIRED='false';
 process.env.DB_BACKUP_ENABLED='false';process.env.BACKUP_SCHEDULER_ENABLED='false';process.env.BACKUP_S3_ENABLED='false';
 process.env.BACKUP_DIR=path.join(temporary,'backups');process.env.DB_BACKUP_EVIDENCE_PATH=path.join(temporary,'backup-evidence.json');
 for(const k of ['DATABASE_URL','RENTINORBIT_DB_PATH','RAILWAY_ENVIRONMENT_ID','RAILWAY_PROJECT_ID','RAILWAY_SERVICE_ID','RAILWAY_VOLUME_MOUNT_PATH','PERSISTENT_DATA_DIR'])delete process.env[k];
 const d=await import('../db.js');db=d.db;assert.equal(d.db.name,process.env.DB_PATH);
 d.createAppUser({email:supplier,password:'SyntheticOnly-'+run,role:'supplier'});
 d.createAppUser({email:customer,password:'SyntheticOnly-'+run,role:'customer'});
 const listing='sct-real-'+run;d.upsertRentalListing({listingId:listing,ownerEmail:supplier,title:'Synthetic TEST only',totalQuantity:10});
 const rt=createSctTestRuntime({db:d.db,stripe,env:process.env});await rt.registerRecipient(supplier,created.id,'individual');
 // Real Stripe CLI forwarding signs actual TEST events to an isolated local server.
 // Its webhook secret stays in memory and is never printed or persisted.
 step='start_real_test_webhook_forwarding';let listenerOutput='',webhookSecret;
 listener=spawn('npm',['exec','--yes','--package=@stripe/cli@1.55.12','--','stripe','listen','--forward-to','http://127.0.0.1:32897/api/stripe/webhook',
  '--events','payment_intent.succeeded,refund.created,refund.updated,refund.failed'],{
  detached:true,stdio:['ignore','pipe','pipe'],env:{...process.env,STRIPE_API_KEY:process.env.STRIPE_SECRET_KEY}});
 const capture=data=>{listenerOutput+=data.toString();webhookSecret=listenerOutput.match(/whsec_[A-Za-z0-9]+/)?.[0];};
 listener.stdout.on('data',capture);listener.stderr.on('data',capture);
 for(let i=0;i<240&&!webhookSecret;i++){if(listener.exitCode!==null)throw new Error('STRIPE_TEST_FORWARDER_FAILED');await wait(250);}
 if(!webhookSecret)throw new Error('STRIPE_TEST_FORWARDER_NOT_READY');
 server=spawn(process.execPath,['server.js'],{detached:true,stdio:['ignore','ignore','ignore'],env:{...process.env,
  PORT:'32897',HOST:'127.0.0.1',APP_URL:'http://127.0.0.1:32897',PUBLIC_BASE_URL:'http://127.0.0.1:32897',UPLOADS_DIR:path.join(temporary,'uploads'),
  SESSION_SECRET:'Synthetic-SCT-Session-Only-'+run,STRIPE_WEBHOOK_SECRET:webhookSecret,STRIPE_CONNECT_WEBHOOK_SECRET:'',
  RENTINORBIT_DEMO_PAYMENTS:'false',RENTINORBIT_ISOLATED_RECOVERY_PROBE:'false',EMAIL_WORKER_ENABLED:'false',EMAIL_PROVIDER:'disabled'}});
 let healthy=false;for(let i=0;i<100;i++){try{healthy=(await fetch('http://127.0.0.1:32897/healthz')).ok;}catch{}if(healthy)break;await wait(100);}
 if(!healthy)throw new Error('ISOLATED_TEST_HTTP_NOT_READY');
 async function booking(suffix){const id='RB-real-'+run+'-'+suffix;d.db.transaction(()=>{
  d.createRentalBookingAtomic({bookingId:id,listingId:listing,startDate:'2099-01-01',endDate:'2099-01-02',quantity:1,status:'pending',customerEmail:customer,customerName:'Synthetic TEST renter',orderValue:100});
  rt.enrollNewBooking(id,supplier);
 }).immediate();d.updateRentalBookingStatus(id,'confirmed');return id;}
 async function pay(id){const result=await rt.createPayment(id);
  // Official TEST card makes funds available, without bypassing our balance guard.
  if(result.status!=='succeeded')await stripe.paymentIntents.confirm(result.paymentIntentId,{payment_method:'pm_card_bypassPending',return_url:'https://rentall-staging.up.railway.app/'});
  const pi=await stripe.paymentIntents.retrieve(result.paymentIntentId);assert.equal(pi.livemode,false);assert.equal(pi.status,'succeeded');
  // Wait for the actual signed forwarded event to drive the canonical paid state.
  for(let i=0;i<150&&d.getRentalBookingById(id).paymentStatus!=='paid';i++)await wait(100);
  assert.equal(d.getRentalBookingById(id).paymentStatus,'paid');assert.equal((await rt.settle(id)).duplicate,true);
  return {bookingId:id,paymentIntentId:pi.id,chargeId:typeof pi.latest_charge==='string'?pi.latest_charge:pi.latest_charge.id,amountCents:10000,commissionCents:1500};}
 step='scenario_A';const a=await booking('A');
 report.A=await pay(a);await assert.rejects(rt.transfer(a));
 d.createRentalAgreement({bookingId:a,termsVersion:'synthetic-test-only',snapshot:{total:100}});
 d.acceptRentalAgreement(a,'customer',{actorEmail:customer,authMethod:'session'});d.acceptRentalAgreement(a,'supplier',{actorEmail:supplier,authMethod:'session'});
 const pin=d.issueRentalTransferCode(a,'pickup','customer');assert.equal(d.verifyAndConsumeRentalTransferCode(a,'pickup',pin.code).ok,true);
 d.markRentalReturned(a,'good');
 try{const before=await stripe.balance.retrieve({},{stripeAccount:created.id});
  const t=await rt.transfer(a);assert.equal(t.amountCents,8500);await assert.rejects(rt.transfer(a));
  const after=await stripe.balance.retrieve({},{stripeAccount:created.id});
  const eur=b=>[...b.available,...b.pending].filter(x=>x.currency==='eur').reduce((n,x)=>n+x.amount,0);
  assert.equal(eur(after)-eur(before),8500);report.A.connectedBalanceIncreaseCents=8500;
  report.A.transfer=t;const final=d.getRentalBookingById(a);report.A.finalState={status:final.status,paymentStatus:final.paymentStatus,payoutStatus:final.payoutStatus};report.scenarioA='PASS';}
 catch(e){report.A.blocker=safeError(e);}
 step='scenario_B';const b=await booking('B');report.B=await pay(b);
 const refund=await rt.refund(b,10000);const refundRow=d.db.prepare("SELECT provider_id FROM sct_test_commands WHERE booking_id=? AND kind='refund'").get(b);
 const providerRefund=await stripe.refunds.retrieve(refundRow.provider_id);assert.equal(providerRefund.amount,10000);assert.equal(providerRefund.status,'succeeded');
 await assert.rejects(rt.refund(b,10000));await assert.rejects(rt.settle(b));
 report.B.refund={providerId:providerRefund.id,amountCents:providerRefund.amount,status:providerRefund.status};const final=d.getRentalBookingById(b);report.B.finalState={status:final.status,paymentStatus:final.paymentStatus,refundStatus:final.refundStatus,refundAmount:final.refundAmount,payoutStatus:final.payoutStatus};
 report.scenarioB='PASS';
 const held=await booking('hold');rt.setHold(held,'Synthetic explicit financial hold');await assert.rejects(rt.transfer(held),{code:'SCT_FINANCIAL_HOLD'});
 report.holdBlocked=true;
 const events=await stripe.events.list({type:'payment_intent.succeeded',limit:100});
 const ownEvents=events.data.filter(e=>[report.A.paymentIntentId,report.B.paymentIntentId].includes(e.data?.object?.id));
 report.providerEventIds=ownEvents.map(e=>e.id);
 for(let i=0;i<100;i++){if(ownEvents.length===2&&ownEvents.every(e=>d.db.prepare("SELECT 1 FROM webhook_events WHERE event_id=? AND status='processed'").get(e.id)))break;await wait(100);}
 assert.equal(ownEvents.length,2);
 for(const event of ownEvents){
  assert.ok(d.db.prepare("SELECT 1 FROM webhook_events WHERE event_id=? AND status='processed'").get(event.id));
  const body=JSON.stringify(event),signature=stripe.webhooks.generateTestHeaderString({payload:body,secret:webhookSecret});
  const replay=await fetch('http://127.0.0.1:32897/api/stripe/webhook',{method:'POST',headers:{'content-type':'application/json','stripe-signature':signature},body});
  assert.equal(replay.status,200);assert.equal((await replay.json()).duplicate,true);
 }
 report.webhookTransportVerified=true;report.webhookReplayBlocked=true;report.bankPayoutVerified=false;
}catch(e){report.blockedAt=step;report.blocker=safeError(e);}
finally{stop(server);stop(listener);if(db?.open)db.close();if(temporary)fs.rmSync(temporary,{recursive:true,force:true});}
// A BLOCKED financial test is explicit evidence, never a build/launch GO.
console.log(JSON.stringify(report));
