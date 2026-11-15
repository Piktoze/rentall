import assert from 'node:assert/strict';
import {test} from 'node:test';
import Database from 'better-sqlite3';
import {installSctBookingBindings,reserveSctBookingBinding,bindSctPaymentIntent}
  from './modules/sct-booking-binding.js';
import {installSctPaymentSettlements} from './modules/sct-test-payment-settlement.js';
import {installIsolatedSctRefundCommands} from './modules/isolated-sct-test-refund-journal.js';
import {installSupplierTransferCommands} from './modules/supplier-transfer-command-journal.js';
import {inspectIsolatedSctTestSupplierTransfer}
  from './modules/isolated-sct-test-supplier-transfer-readiness.js';

const bookingId='RB-transfer-readiness';
const nowMs=Date.parse('2026-11-15T12:00:00Z');
const intent={id:'pi_fixture',livemode:false,status:'succeeded',currency:'eur',
  amount:10000,amount_received:10000,latest_charge:'ch_fixture',
  metadata:{bookingId,listingId:'listing-1',purpose:'rental_payment',
    paymentFlow:'separate_charges_and_transfers',
    supplierStripeAccountId:'acct_fixture',commissionCents:'1500'}};
const charge={id:'ch_fixture',livemode:false,payment_intent:'pi_fixture',
  status:'succeeded',paid:true,captured:true,currency:'eur',
  amount:10000,amount_captured:10000,amount_refunded:0,refunded:false,disputed:false};
const empty={data:[],has_more:false};
function fixture(patch={}){
  const db=new Database(':memory:');
  db.exec(`CREATE TABLE rental_bookings(
    booking_id TEXT PRIMARY KEY,listing_id TEXT,status TEXT,returned_at TEXT,
    payment_status TEXT,stripe_payment_intent_id TEXT,stripe_refund_id TEXT,
    refund_status TEXT,payout_status TEXT,order_value REAL,
    platform_fee_amount REAL,supplier_amount REAL);
    INSERT INTO rental_bookings VALUES(
      'RB-transfer-readiness','listing-1','returned','2026-11-15T11:00:00Z',
      'paid','pi_fixture',NULL,NULL,'not_ready',100,15,85);`);
  installSctBookingBindings(db);installSctPaymentSettlements(db);
  installIsolatedSctRefundCommands(db);installSupplierTransferCommands(db);
  reserveSctBookingBinding(db,{id:bookingId,listingId:'listing-1',amountCents:10000,
    feeCents:1500,destination:'acct_fixture',livemode:false});
  bindSctPaymentIntent(db,bookingId,'pi_fixture');
  db.prepare(`INSERT INTO sct_payment_settlements
    (booking_id,event_id,payment_intent_id,charge_id,amount_cents,fee_cents,supplier_cents)
    VALUES(?,?,?,?,?,?,?)`).run(bookingId,'evt_fixture','pi_fixture','ch_fixture',10000,1500,8500);
  let stripeReads=0;
  const stripe={
    _apiKey:'sk_test_fixture0123456789',
    paymentIntents:{retrieve:async()=>{stripeReads++;return patch.intent||intent}},
    charges:{retrieve:async()=>patch.charge||charge},
    refunds:{list:async()=>patch.refunds||empty},
    disputes:{list:async()=>patch.disputes||empty},
    transfers:{list:async()=>patch.transfers||empty},
  };
  const inspect=(changes={})=>inspectIsolatedSctTestSupplierTransfer({
    db,stripe,stripeMode:'test',stripeSecretKey:'sk_test_fixture0123456789',
    bookingId,nowMs,releaseDeadlineAt:nowMs+86400000,...changes});
  return {db,stripe,inspect,reads:()=>stripeReads};
}
test('read-only TEST readiness confirms 100/15/85 and never books supplier transfer',async()=>{
  const x=fixture();
  try{
    const report=await x.inspect();
    assert.equal(report.status,'test_evidence_ready_for_manual_review');
    assert.equal(report.supplierCents,8500);
    assert.equal(report.platformFeeCents,1500);
    assert.equal(report.destination,'acct_fixture');
    assert.equal(report.transferExecuted,false);
    assert.equal(report.deadlineCheck,'caller_supplied_not_authoritative');
    assert.equal(x.reads(),1);
    assert.equal(x.db.prepare('SELECT COUNT(*) n FROM sct_payment_settlements').get().n,1);
    assert.equal(x.db.prepare('SELECT status FROM rental_bookings').get().status,'returned');
  }finally{x.db.close()}
});
test('refunded, unreturned or altered canonical booking never invokes Stripe',async()=>{
  for(const sql of [
    "UPDATE rental_bookings SET status='active'",
    "UPDATE rental_bookings SET returned_at=NULL",
    "UPDATE rental_bookings SET payment_status='refunded'",
    "UPDATE rental_bookings SET stripe_refund_id='re_fixture'",
    "UPDATE rental_bookings SET supplier_amount=86",
    "UPDATE rental_bookings SET payout_status='transferred'",
  ]){
    const x=fixture();
    try{
      x.db.exec(sql);
      assert.equal((await x.inspect()).blocked,'canonical_payment_or_return_not_ready');
      assert.equal(x.reads(),0);
    }finally{x.db.close()}
  }
});
test('tampered local Charge identity is rejected against fresh Stripe proof',async()=>{
  const x=fixture();
  try{
    x.db.exec("UPDATE sct_payment_settlements SET charge_id='ch_other'");
    assert.equal((await x.inspect()).blocked,'stripe_proof_settlement_mismatch');
    assert.equal(x.reads(),1);
  }finally{x.db.close()}
});
test('any refund, transfer or dispute command blocks readiness before Stripe',async()=>{
  for(const table of ['sct_test_refund_commands','supplier_transfer_commands',
                      'stripe_rental_disputes','rental_disputes']){
    const x=fixture();
    try{
      if(!['sct_test_refund_commands','supplier_transfer_commands'].includes(table))
        x.db.exec(`CREATE TABLE ${table}(booking_id TEXT PRIMARY KEY)`);
      if(table==='sct_test_refund_commands'){
        x.db.exec(`INSERT INTO sct_test_refund_commands
          (booking_id,payment_intent_id,charge_id,amount_cents,idempotency_key,status)
          VALUES('RB-transfer-readiness','pi_fixture','ch_fixture',10000,
            'booking:RB-transfer-readiness:sct-full-refund:v1','reserved')`);
      }else if(table==='supplier_transfer_commands'){
        x.db.exec(`INSERT INTO supplier_transfer_commands
          (booking_id,payment_intent_id,charge_id,destination,amount_cents,currency,
           idempotency_key,payload_json,status)
          VALUES('RB-transfer-readiness','pi_fixture','ch_fixture','acct_fixture',8500,'eur',
            'booking:RB-transfer-readiness:supplier-transfer:v1','{}','reserved')`);
      }else{
        x.db.prepare(`INSERT INTO ${table}(booking_id) VALUES(?)`).run(bookingId);
      }
      assert.equal((await x.inspect()).blocked,'existing_financial_command_or_dispute');
      assert.equal(x.reads(),0);
    }finally{x.db.close()}
  }
});
test('missing refund or transfer command journal refuses financial readiness without Stripe calls',async()=>{
  for(const missing of ['sct_test_refund_commands','supplier_transfer_commands']){
    const x=fixture();
    try{
      x.db.exec(`DROP TABLE ${missing}`);
      assert.equal((await x.inspect()).blocked,'financial_command_journals_unavailable');
      assert.equal(x.reads(),0);
    }finally{x.db.close()}
  }
});
test('Stripe refund, dispute, previous transfer or wrong charge blocks readiness',async()=>{
  for(const patch of [
    {refunds:{has_more:false,data:[{id:'re_fixture'}]}},
    {disputes:{has_more:false,data:[{id:'dp_fixture'}]}},
    {transfers:{has_more:false,data:[{id:'tr_fixture'}]}},
    {charge:{...charge,amount_refunded:1}},
    {intent:{...intent,metadata:{...intent.metadata,commissionCents:'1600'}}},
  ]){
    const x=fixture(patch);
    try{
      assert.ok((await x.inspect()).blocked);
      assert.equal(x.reads(),1);
    }finally{x.db.close()}
  }
});
test('LIVE key, no inspectable TEST key, expired deadline block all provider calls',async()=>{
  const x=fixture();
  try{
    assert.equal((await x.inspect({stripeMode:'live'})).blocked,'trusted_platform_test_client_required');
    assert.equal((await x.inspect({stripeSecretKey:'sk_live_notreal'})).blocked,'trusted_platform_test_client_required');
    assert.equal((await x.inspect({stripe:{...x.stripe,_apiKey:undefined}})).blocked,
      'trusted_platform_test_client_required');
    assert.equal((await x.inspect({releaseDeadlineAt:nowMs})).blocked,
      'verified_release_deadline_required');
    assert.equal(x.reads(),0);
  }finally{x.db.close()}
});
