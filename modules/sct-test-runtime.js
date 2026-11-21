// Integrated, explicitly opt-in SCT TEST runtime. No historical booking migration.
// Disposable storage is the default. Persistent TEST requires a separately validated fresh-root marker; LIVE is refused.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {assertPersistentTestDatabase} from './sct-persistent-storage.js';
import {assertPlatformCostConfiguration,calculatePlatformCostSplit} from './platform-cost-policy.js';
import {isIsolatedStripeTestClient} from './isolated-stripe-test-client.js';
import {installSctBookingBindings,reserveSctBookingBinding,bindSctPaymentIntent,getSctBookingBinding} from './sct-booking-binding.js';
import {planIsolatedSctPaymentIntent,verifyIsolatedSctPaymentIntent} from './isolated-sct-platform-payment.js';
import {reconcileIsolatedSctTestPayment} from './isolated-sct-test-payment-reconciler.js';
import {inspectIsolatedSctRecipientAccount} from './isolated-sct-recipient-account-gate.js';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const idOf=v=>typeof v==='string'?v:v?.id;
export function assertSctTestStorage(db,env){
 if(env.RENTINORBIT_SCT_TEST_RUNTIME!=='true'||env.STRIPE_MODE!=='test')fail('SCT_TEST_ONLY');
 const file=db.name;
 if(file===':memory:'&&env.NODE_ENV==='test')return;
 // Resolve symlinks and the actual open SQLite filename, not a user attestation.
 const root=fs.realpathSync(os.tmpdir()),real=fs.realpathSync(file);
 if(!real.startsWith(root+path.sep)||real==='/data'||real.startsWith('/data/'))fail('SCT_DISPOSABLE_DATABASE_REQUIRED');
}
export function createSctTestRuntime(options){
 assertSctTestStorage(options.db,options.env);
 return createRuntime(options);
}
export function createPersistentSctTestRuntime(options){
 assertPersistentTestDatabase(options.db,options.env);
 // Flush every committed command before any provider call, including host power-loss durability.
 options.db.pragma('synchronous = FULL');
 if(options.db.pragma('synchronous',{simple:true})!==2)fail('SCT_DURABLE_JOURNAL_REQUIRED');
 return createRuntime(options);
}
function createRuntime({db,stripe,env,now=Date.now}){
 if(!isIsolatedStripeTestClient(stripe,env.STRIPE_SECRET_KEY))fail('SCT_TRUSTED_TEST_CLIENT_REQUIRED');
 assertPlatformCostConfiguration(env);
 const feePayer='platform';
 installSctBookingBindings(db);
 db.exec(`CREATE TABLE IF NOT EXISTS sct_test_recipients(
  email TEXT PRIMARY KEY COLLATE NOCASE,account_id TEXT NOT NULL UNIQUE,entity_type TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sct_test_enrollments(
  booking_id TEXT PRIMARY KEY,fee_payer TEXT NOT NULL,deadline_ms INTEGER NOT NULL,
  hold_reason TEXT,processor_fee_cents INTEGER,supplier_transfer_cents INTEGER);
 CREATE TABLE IF NOT EXISTS sct_test_commands(
  booking_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('payment','refund','transfer','cancel')),
  command_key TEXT NOT NULL UNIQUE,payload_json TEXT NOT NULL,status TEXT NOT NULL,
  provider_id TEXT UNIQUE,created_ms INTEGER NOT NULL,PRIMARY KEY(booking_id,kind));`);
 const owned=id=>!!db.prepare('SELECT 1 FROM sct_test_enrollments WHERE booking_id=?').get(id);
 const row=id=>db.prepare('SELECT * FROM rental_bookings WHERE booking_id=?').get(id);
 const enrollment=id=>db.prepare('SELECT * FROM sct_test_enrollments WHERE booking_id=?').get(id);
 const command=(id,kind)=>db.prepare('SELECT * FROM sct_test_commands WHERE booking_id=? AND kind=?').get(id,kind);
 const binding=id=>{const b=getSctBookingBinding(db,id);if(!owned(id)||!b)fail('SCT_NEW_BOOKING_REQUIRED');return b;};
 function held(id){
  if(enrollment(id)?.hold_reason) return true;
  const supplier=db.prepare(`SELECT s.status FROM rental_bookings b JOIN rental_listings l USING(listing_id)
   JOIN supplier_onboarding s ON s.email=l.owner_email COLLATE NOCASE WHERE b.booking_id=?`).get(id);
  if(supplier?.status==='suspended')return true;
  for(const table of ['rental_disputes','stripe_rental_disputes'])
   if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table)&&
    db.prepare(`SELECT 1 FROM ${table} WHERE booking_id=? LIMIT 1`).get(id))return true;
  return false;
 }
 async function recipient(accountId,entityType){
  const account=await stripe.v2.core.accounts.retrieve(accountId,{
   include:['identity','configuration.recipient','configuration.merchant','requirements','defaults']});
  if(account.livemode!==false)fail('SCT_RECIPIENT_NOT_TEST');
  const result=inspectIsolatedSctRecipientAccount(account,{expectedAccountId:accountId,expectedEntityType:entityType});
  if(result.blocked)fail(result.blocked);
  return account;
 }
 async function registerRecipient(email,accountId,entityType){
  if(!/^[^\s@]+@[^\s@]+$/.test(email||''))fail('SCT_RECIPIENT_EMAIL_INVALID');
  await recipient(accountId,entityType);
  // Map only an existing supplier. No credentials or identity documents are collected here.
  const user=db.prepare("SELECT user_id FROM app_users WHERE email=? COLLATE NOCASE AND role IN ('supplier','admin')").get(email);
  if(!user)fail('SCT_SUPPLIER_NOT_FOUND');
  db.prepare(`INSERT INTO sct_test_recipients VALUES(?,?,?) ON CONFLICT(email)
   DO UPDATE SET account_id=excluded.account_id,entity_type=excluded.entity_type`).run(email,accountId,entityType);
  return {status:'test_recipient_verified',accountId,bankPayoutVerified:false};
 }
 function newBookingRecipient(email){
  const r=db.prepare('SELECT * FROM sct_test_recipients WHERE email=? COLLATE NOCASE').get(email);
  if(!r)fail('SCT_VERIFIED_RECIPIENT_REQUIRED');return r;
 }
 // Called ONLY inside the transaction that inserts a brand-new booking.
 function enrollNewBooking(id,email){
  const b=row(id),r=newBookingRecipient(email);
  if(!b||b.status!=='pending'||b.payment_status!=='unpaid'||b.stripe_payment_intent_id||
   Number(b.security_deposit_amount||0)!==0||owned(id))fail('SCT_NEW_UNPAID_NO_DEPOSIT_BOOKING_REQUIRED');
  const cents=Math.round(b.order_value*100),fee=calculatePlatformCostSplit(cents).platformCommissionCents;
  if(!Number.isSafeInteger(cents)||cents<50)fail('SCT_INVALID_AMOUNT');
  const reserved=reserveSctBookingBinding(db,{id,listingId:b.listing_id,amountCents:cents,
   feeCents:fee,destination:r.account_id,livemode:false});
  if(reserved.blocked||reserved.alreadyExists)fail('SCT_BINDING_CONFLICT');
  db.prepare('INSERT INTO sct_test_enrollments(booking_id,fee_payer,deadline_ms) VALUES(?,?,?)')
   .run(id,feePayer,now()+90*86400000);
 }
 function snapshot(id){const b=binding(id);return {...b,paymentIntentId:null,status:'confirmed',paymentStatus:'unpaid',
  paymentFlow:'separate_charges_and_transfers',financialHold:false,listingApproved:true,supplierEligible:true};}
 function validateLocal(id,kind){
  binding(id);const b=row(id),e=enrollment(id);
  if(!b||held(id)||e.deadline_ms<=now())fail('SCT_FINANCIAL_HOLD');
  if(kind==='payment'){
   const listing=db.prepare('SELECT * FROM rental_listings WHERE listing_id=?').get(b.listing_id);
   const mapped=newBookingRecipient(listing?.owner_email);
   if(!listing||listing.moderation_status!=='active'||listing.lifecycle_status!=='active'||mapped.account_id!==binding(id).destination)fail('SCT_LISTING_NOT_ELIGIBLE');
  }
  if(kind==='payment'&&(b.status!=='confirmed'||!['unpaid','requires_payment_method'].includes(b.payment_status)))fail('SCT_PAYMENT_NOT_READY');
  if(kind==='payment'&&db.prepare("SELECT 1 FROM sct_test_commands WHERE booking_id=? AND kind!='payment'").get(id))fail('SCT_CONFLICTING_FINANCIAL_COMMAND');
  if(kind==='transfer'&&(b.status!=='returned'||!Number.isFinite(Date.parse(b.returned_at))||Date.parse(b.returned_at)>now()||
   b.return_condition!=='good'||b.payment_status!=='paid'||b.stripe_refund_id||
   Number(b.security_deposit_amount||0)!==0))fail('SCT_RETURN_NOT_RELEASABLE');
  if(['refund','cancel'].includes(kind)&&(!['pending','confirmed'].includes(b.status)||b.returned_at||b.stripe_refund_id))fail('SCT_CANCELLATION_NOT_READY');
  if(kind!=='payment'){
   const other=db.prepare("SELECT kind FROM sct_test_commands WHERE booking_id=? AND kind NOT IN ('payment',?)").get(id,kind);
   if(other)fail('SCT_CONFLICTING_FINANCIAL_COMMAND');
   // Never overlap with any legacy/prototype financial command.
   for(const table of ['sct_test_refund_commands','supplier_transfer_commands'])
    if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table)&&
     db.prepare(`SELECT 1 FROM ${table} WHERE booking_id=?`).get(id))fail('SCT_OTHER_COMMAND_REQUIRES_REVIEW');
  }
  return b;
 }
 function claim(id,kind,payload){return db.transaction(()=>{
  validateLocal(id,kind);
  if(command(id,kind))fail('SCT_COMMAND_RECONCILIATION_REQUIRED');
  const key=`booking:${id}:sct-runtime-${kind}:v1`;
  db.prepare('INSERT INTO sct_test_commands VALUES(?,?,?,?,?,?,?)')
   .run(id,kind,key,JSON.stringify(payload),'uncertain',null,now());
  if(kind==='refund')db.prepare("UPDATE rental_bookings SET payment_status='refund_pending' WHERE booking_id=?").run(id);
  if(kind==='transfer')db.prepare("UPDATE rental_bookings SET payout_status='processing' WHERE booking_id=?").run(id);
  return key;
 }).immediate();}
 async function completeList(read){const all=[];let cursor;const seen=new Set();
  for(let p=0;p<20;p++){
   const page=await read({limit:100,...(cursor?{starting_after:cursor}:{})});
   if(!Array.isArray(page.data)||typeof page.has_more!=='boolean')fail('SCT_PROVIDER_LIST_INCOMPLETE');
   for(const item of page.data){if(!item.id||seen.has(item.id))fail('SCT_PROVIDER_LIST_INVALID');seen.add(item.id);all.push(item);}
   if(!page.has_more)return all;if(!page.data.length)fail('SCT_PROVIDER_LIST_INCOMPLETE');cursor=page.data.at(-1).id;
  }fail('SCT_PROVIDER_LIST_LIMIT');
 }
 function savePayment(id,pi){
  const wanted=snapshot(id),proof=verifyIsolatedSctPaymentIntent(wanted,pi);
  if(proof.blocked)fail(proof.blocked);
  if(!['requires_payment_method','requires_confirmation','requires_action','processing','succeeded'].includes(pi.status))fail('SCT_PAYMENT_STATE_INVALID');
  db.transaction(()=>{
   validateLocal(id,'payment');
   const existing=binding(id).paymentIntentId;
   if(existing&&existing!==pi.id)fail('SCT_PAYMENT_ID_CONFLICT');
   const bound=bindSctPaymentIntent(db,id,pi.id);if(bound.blocked)fail(bound.blocked);
   db.prepare(`UPDATE rental_bookings SET stripe_payment_intent_id=?,payment_status='requires_payment_method',
    payment_provider='stripe',platform_fee_amount=?,supplier_amount=?,payout_status='not_ready' WHERE booking_id=?`)
    .run(pi.id,wanted.feeCents/100,(wanted.amountCents-wanted.feeCents)/100,id);
   db.prepare("UPDATE sct_test_commands SET status='done',provider_id=? WHERE booking_id=? AND kind='payment'").run(pi.id,id);
  }).immediate();
  return {provider:'stripe',paymentFlow:'separate_charges_and_transfers',paymentIntentId:pi.id,
   clientSecret:pi.client_secret,amount:wanted.amountCents/100,platformFee:wanted.feeCents/100,
   supplierShareBeforeStripeFees:(wanted.amountCents-wanted.feeCents)/100,
   supplierAmount:(wanted.amountCents-wanted.feeCents)/100,
   stripeFeePayer:enrollment(id).fee_payer,status:pi.status};
 }
 async function createPayment(id){
  validateLocal(id,'payment');const b=binding(id);
  if(b.paymentIntentId)return savePayment(id,await stripe.paymentIntents.retrieve(b.paymentIntentId));
  const recipientRow=db.prepare('SELECT * FROM sct_test_recipients WHERE account_id=?').get(b.destination);
  if(!recipientRow)fail('SCT_RECIPIENT_MAPPING_MISSING');await recipient(b.destination,recipientRow.entity_type);
  const plan=planIsolatedSctPaymentIntent(snapshot(id));if(plan.blocked)fail(plan.blocked);
  const key=claim(id,'payment',plan.paymentIntent);
  const pi=await stripe.paymentIntents.create(plan.paymentIntent,{idempotencyKey:key});
  return savePayment(id,await stripe.paymentIntents.retrieve(pi.id));
 }
 async function proof(id){const p=await reconcileIsolatedSctTestPayment({stripe,stripeMode:'test',binding:binding(id)});
  if(p.blocked)fail(p.blocked);return p;}
 async function settle(id){
  const b=row(id);binding(id);
  // A delayed/duplicate webhook cannot reopen a refunded or handed-over booking.
  if(b.payment_status==='paid')return {status:'paid',duplicate:true};
  validateLocal(id,'payment');const p=await proof(id);
  db.transaction(()=>{
   validateLocal(id,'payment');
   db.prepare(`UPDATE rental_bookings SET payment_status='paid',platform_fee_amount=?,supplier_amount=?
    WHERE booking_id=? AND stripe_payment_intent_id=?`).run(p.feeCents/100,p.supplierCents/100,id,p.paymentIntentId);
  }).immediate();return {status:'paid',bookingId:id};
 }
 async function transfer(id){
  validateLocal(id,'transfer');const p=await proof(id),b=binding(id),r=db.prepare('SELECT * FROM sct_test_recipients WHERE account_id=?').get(b.destination);
  if(!r)fail('SCT_RECIPIENT_MAPPING_MISSING');await recipient(b.destination,r.entity_type);
  const charge=await stripe.charges.retrieve(p.chargeId,{expand:['balance_transaction']});
  if(charge.id!==p.chargeId||charge.livemode!==false||idOf(charge.payment_intent)!==p.paymentIntentId)fail('SCT_CHARGE_READBACK_MISMATCH');
  const txn=typeof charge.balance_transaction==='object'?charge.balance_transaction:
   await stripe.balanceTransactions.retrieve(charge.balance_transaction);
  if(!txn||txn.currency!=='eur'||txn.amount!==p.amountCents||!Number.isSafeInteger(txn.fee)||txn.fee<0||
   txn.net!==txn.amount-txn.fee||txn.status!=='available')fail('SCT_AVAILABLE_BALANCE_PROOF_REQUIRED');
  // Never reinterpret an older enrollment with a different commercial model.
  if(enrollment(id).fee_payer!=='platform')fail('SCT_EXISTING_COST_POLICY_REQUIRES_REVIEW');
  const amount=p.supplierCents;
  if(amount<=0)fail('SCT_FEES_EXCEED_SUPPLIER_SHARE');
  const payload={amount,currency:'eur',destination:b.destination,source_transaction:p.chargeId,transfer_group:id,
   metadata:{bookingId:id,paymentIntentId:p.paymentIntentId,purpose:'sct_rental_supplier_transfer'}};
  const key=claim(id,'transfer',payload);
  db.prepare('UPDATE sct_test_enrollments SET processor_fee_cents=?,supplier_transfer_cents=? WHERE booking_id=?').run(txn.fee,amount,id);
  const created=await stripe.transfers.create(payload,{idempotencyKey:key});
  return finish(id,'transfer',await stripe.transfers.retrieve(created.id));
 }
 function finish(id,kind,object){
  const c=command(id,kind);if(!c)fail('SCT_COMMAND_MISSING');const wanted=JSON.parse(c.payload_json);
  if(c.status==='done')return {status:kind==='transfer'?'transferred':'refunded',duplicate:true};
  if((kind==='transfer'?object?.livemode!==false:object?.livemode===true)||!object.id||object.amount!==wanted.amount||object.currency!=='eur'||
   object.metadata?.bookingId!==id||object.metadata?.paymentIntentId!==wanted.metadata.paymentIntentId||
   object.metadata?.purpose!==wanted.metadata.purpose)fail('SCT_PROVIDER_READBACK_MISMATCH');
  if(kind==='transfer'&&(!/^tr_[A-Za-z0-9]+$/.test(object.id)||idOf(object.destination)!==wanted.destination||
   idOf(object.source_transaction)!==wanted.source_transaction||object.transfer_group!==id||object.reversed))fail('SCT_TRANSFER_READBACK_MISMATCH');
  if(kind==='refund'&&(!/^re_[A-Za-z0-9]+$/.test(object.id)||object.status!=='succeeded'||
   idOf(object.charge)!==wanted.charge||idOf(object.payment_intent)!==wanted.metadata.paymentIntentId))fail('SCT_REFUND_NOT_SETTLED');
  return db.transaction(()=>{
   const current=command(id,kind);if(current.status==='done')return {status:'already_reconciled'};
   if(current.status!=='uncertain'||current.payload_json!==c.payload_json)fail('SCT_COMMAND_CHANGED');
   // Record financial truth even if a dispute arrived after the provider accepted the transfer.
   // Such a dispute remains a hold; it must never cause another financial attempt.
   db.prepare("UPDATE sct_test_commands SET status='done',provider_id=? WHERE booking_id=? AND kind=?").run(object.id,id,kind);
   if(kind==='transfer')db.prepare("UPDATE rental_bookings SET payout_status='transferred',payout_amount=?,supplier_amount=?,payout_reference=? WHERE booking_id=?")
    .run(object.amount/100,object.amount/100,object.id,id);
   else db.prepare(`UPDATE rental_bookings SET status='cancelled',payment_status='refunded',refund_status='succeeded',
    stripe_refund_id=?,refund_amount=?,platform_fee_amount=0,supplier_amount=0,payout_status='cancelled',payout_amount=0 WHERE booking_id=?`)
    .run(object.id,object.amount/100,id);
   return {status:kind==='transfer'?'transferred':'refunded',providerId:object.id,amountCents:object.amount,bankPayoutVerified:false};
  }).immediate();
 }
 async function refund(id,amountCents){
  validateLocal(id,'refund');const b=binding(id);
  if(row(id).payment_status!=='paid'||amountCents!==b.amountCents)fail('SCT_FULL_REFUND_ONLY');
  const p=await proof(id),payload={charge:p.chargeId,amount:b.amountCents,reason:'requested_by_customer',
   metadata:{bookingId:id,paymentIntentId:b.paymentIntentId,purpose:'sct_rental_full_refund'}};
  const key=claim(id,'refund',payload);
  const created=await stripe.refunds.create(payload,{idempotencyKey:key});
  return finish(id,'refund',await stripe.refunds.retrieve(created.id));
 }
 // Close an unpaid booking only after the bound provider intent is proven canceled.
 // An uncertain payment creation must be reconciled before cancellation is possible.
 async function cancelUnpaid(id){
  const b=validateLocal(id,'cancel'),bound=binding(id);
  if(!['unpaid','requires_payment_method'].includes(b.payment_status))fail('SCT_UNPAID_CANCELLATION_ONLY');
  const payment=command(id,'payment');
  if(payment&&payment.status!=='done')fail('SCT_COMMAND_RECONCILIATION_REQUIRED');
  if(bound.paymentIntentId){
   const pi=await stripe.paymentIntents.retrieve(bound.paymentIntentId);
   if(verifyIsolatedSctPaymentIntent(snapshot(id),pi).blocked||
    !['requires_payment_method','requires_confirmation','requires_action','canceled'].includes(pi.status))fail('SCT_PAYMENT_MAY_HAVE_SUCCEEDED');
  }
  const payload={paymentIntentId:bound.paymentIntentId};
  const key=claim(id,'cancel',payload);
  if(bound.paymentIntentId){
   await stripe.paymentIntents.cancel(bound.paymentIntentId,{}, {idempotencyKey:key});
  }
  return finishCancel(id);
 }
 async function finishCancel(id){
  const c=command(id,'cancel');if(!c)fail('SCT_COMMAND_MISSING');
  const {paymentIntentId}=JSON.parse(c.payload_json);
  if(paymentIntentId){
   const pi=await stripe.paymentIntents.retrieve(paymentIntentId);
   if(verifyIsolatedSctPaymentIntent(snapshot(id),pi).blocked||pi.status!=='canceled'||Number(pi.amount_received||0)!==0)fail('SCT_CANCEL_NOT_CONFIRMED');
  }
  return db.transaction(()=>{
   db.prepare("UPDATE sct_test_commands SET status='done' WHERE booking_id=? AND kind='cancel'").run(id);
   db.prepare("UPDATE rental_bookings SET status='cancelled',payment_status='cancelled',payout_status='cancelled',payout_amount=0 WHERE booking_id=?").run(id);
   return {status:'cancelled',refundAmount:0};
  }).immediate();
 }
 async function recover(id,kind){
  binding(id);const c=command(id,kind);if(!c)fail('SCT_COMMAND_MISSING');
  if(c.status==='done')return {status:'already_reconciled',providerId:c.provider_id};
  if(kind==='cancel')return finishCancel(id);
  if(!['payment','refund','transfer'].includes(kind))fail('SCT_INVALID_COMMAND');
  const wanted=JSON.parse(c.payload_json);
  const found=await completeList(args=>stripe[kind==='payment'?'paymentIntents':kind==='refund'?'refunds':'transfers'].list(args));
  const matches=found.filter(x=>x.metadata?.bookingId===id&&x.metadata?.purpose===wanted.metadata.purpose);
  // No write/retry is authorized by absence from a provider list.
  if(matches.length!==1)fail('SCT_MANUAL_RECONCILIATION_REQUIRED');
  const obj=await stripe[kind==='payment'?'paymentIntents':kind==='refund'?'refunds':'transfers'].retrieve(matches[0].id);
  return kind==='payment'?savePayment(id,obj):finish(id,kind,obj);
 }
 function setHold(id,reason){binding(id);if(typeof reason!=='string'||reason.trim().length<3)fail('SCT_HOLD_REASON_REQUIRED');
  db.prepare('UPDATE sct_test_enrollments SET hold_reason=? WHERE booking_id=?').run(reason.slice(0,500),id);return {held:true};}
 db.exec('CREATE TABLE IF NOT EXISTS sct_worker_checks(booking_id TEXT NOT NULL,kind TEXT NOT NULL,checked_ms INTEGER NOT NULL,PRIMARY KEY(booking_id,kind))');
 const workerResult=r=>Object.fromEntries(['status','providerId','amountCents','bankPayoutVerified'].filter(k=>r[k]!==undefined).map(k=>[k,r[k]]));
 let sweeping=false;
 async function sweep(){
  if(sweeping)return {busy:true};sweeping=true;const results=[];
  try{
   // Recover existing provider truth first. Absence never authorizes a new create.
   for(const c of db.prepare("SELECT c.booking_id,c.kind FROM sct_test_commands c LEFT JOIN sct_worker_checks w ON w.booking_id=c.booking_id AND w.kind=c.kind WHERE c.status='uncertain' ORDER BY COALESCE(w.checked_ms,0),c.created_ms,c.booking_id LIMIT 10").all()){
    try{results.push({bookingId:c.booking_id,...workerResult(await recover(c.booking_id,c.kind))});}
    catch(e){results.push({bookingId:c.booking_id,blocked:e.code||'SCT_PROVIDER_UNAVAILABLE'});}
    finally{db.prepare('INSERT INTO sct_worker_checks VALUES(?,?,?) ON CONFLICT(booking_id,kind) DO UPDATE SET checked_ms=excluded.checked_ms').run(c.booking_id,c.kind,now());}
   }
   for(const b of db.prepare(`SELECT b.booking_id FROM rental_bookings b JOIN sct_test_enrollments e USING(booking_id) LEFT JOIN sct_worker_checks w ON w.booking_id=b.booking_id AND w.kind='eligible_transfer'
    WHERE b.status='returned' AND b.payment_status='paid' AND NOT EXISTS
     (SELECT 1 FROM sct_test_commands c WHERE c.booking_id=b.booking_id AND c.kind!='payment')
    ORDER BY COALESCE(w.checked_ms,0),b.returned_at,b.booking_id LIMIT 10`).all()){
    try{results.push({bookingId:b.booking_id,...workerResult(await transfer(b.booking_id))});}
    catch(e){results.push({bookingId:b.booking_id,blocked:e.code||'SCT_PROVIDER_UNAVAILABLE'});}
    finally{db.prepare("INSERT INTO sct_worker_checks VALUES(?,'eligible_transfer',?) ON CONFLICT(booking_id,kind) DO UPDATE SET checked_ms=excluded.checked_ms").run(b.booking_id,now());}
   }
   return {results};
  }finally{sweeping=false;}
 }
 return {owned,registerRecipient,newBookingRecipient,enrollNewBooking,createPayment,settle,transfer,refund,cancelUnpaid,recover,setHold,sweep};
}
