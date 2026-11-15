import assert from 'node:assert/strict';
import {test} from 'node:test';
import Database from 'better-sqlite3';
import {planIsolatedSctTestFullRefund} from './modules/isolated-sct-test-full-refund-policy.js';
import {installIsolatedSctRefundCommands,reserveIsolatedSctRefundCommand,
  markIsolatedSctRefundReconciliationRequired,recordVerifiedIsolatedSctRefund}
  from './modules/isolated-sct-test-refund-journal.js';

const booking={id:'RB-test-refund',status:'confirmed',paymentStatus:'paid',
  livemode:false,paymentFlow:'separate_charges_and_transfers',
  handedOverAt:null,returnedAt:null,financialHold:false,disputeHold:false,
  stripeRefundId:null,refundStatus:null,transferCommandExists:false};
const binding={id:booking.id,livemode:false,paymentIntentId:'pi_fixture',
  amountCents:10000,feeCents:1500};
const settlement={bookingId:booking.id,paymentIntentId:'pi_fixture',
  chargeId:'ch_fixture',amountCents:10000,feeCents:1500,supplierCents:8500};
const provider={livemode:false,paymentIntentId:'pi_fixture',chargeId:'ch_fixture',
  amountCents:10000,currency:'eur',paymentStatus:'succeeded',
  chargeCaptured:true,chargeDisputed:false,amountRefundedCents:0,
  refundsComplete:true,refundCount:0,disputesComplete:true,disputeCount:0,
  transfersComplete:true,transferCount:0,stripeTransfersComplete:true,
  stripeTransferCount:0};
const plan=()=>planIsolatedSctTestFullRefund(booking,binding,settlement,provider);
function fixture(){
  const db=new Database(':memory:');
  db.exec(`CREATE TABLE sct_payment_settlements
    (booking_id TEXT PRIMARY KEY,payment_intent_id TEXT,charge_id TEXT,
     amount_cents INTEGER);
    INSERT INTO sct_payment_settlements VALUES
    ('RB-test-refund','pi_fixture','ch_fixture',10000);`);
  installIsolatedSctRefundCommands(db);
  return db;
}
test('full €100 TEST refund planned only before handover with zero transfers',()=>{
  assert.deepEqual(plan(),{
    idempotencyKey:'booking:RB-test-refund:sct-full-refund:v1',
    refund:{charge:'ch_fixture',amount:10000,reason:'requested_by_customer',
      metadata:{bookingId:'RB-test-refund',paymentIntentId:'pi_fixture',
        purpose:'sct_rental_full_refund'}},
  });
});
test('reject LIVE, wrong payment, partial amount and refund/dispute/transfer signals',()=>{
  const variations=[
    [{...booking,livemode:true},binding,settlement,provider],
    [booking,{...binding,paymentIntentId:'pi_other'},settlement,provider],
    [booking,binding,{...settlement,amountCents:9900},provider],
    [booking,binding,settlement,{...provider,chargeDisputed:true}],
    [booking,binding,settlement,{...provider,amountRefundedCents:100}],
    [booking,binding,settlement,{...provider,refundsComplete:false}],
    [booking,binding,settlement,{...provider,refundCount:1}],
    [booking,binding,settlement,{...provider,stripeTransferCount:1}],
    [booking,binding,settlement,{...provider,transfersComplete:false}],
    [{...booking,handedOverAt:'2026-11-15'},binding,settlement,provider],
    [{...booking,transferCommandExists:true},binding,settlement,provider],
    [{...booking,disputeHold:true},binding,settlement,provider],
  ];
  for(const args of variations)assert.ok(planIsolatedSctTestFullRefund(...args).blocked);
});
test('journal reserves once, never retries, then requires verified Stripe result',()=>{
  const db=fixture();
  try{
    assert.deepEqual(reserveIsolatedSctRefundCommand(db,plan()),{
      status:'reserved',bookingId:booking.id});
    assert.equal(reserveIsolatedSctRefundCommand(db,plan()).blocked,
      'existing_refund_command_requires_reconciliation');
    assert.equal(markIsolatedSctRefundReconciliationRequired(db,booking.id),true);
    assert.equal(markIsolatedSctRefundReconciliationRequired(db,booking.id),false);
    assert.equal(recordVerifiedIsolatedSctRefund(db,booking.id,{
      id:'re_fixture',livemode:false,status:'pending',
      charge:'ch_fixture',payment_intent:'pi_fixture',amount:10000,currency:'eur',
    }).blocked,'invalid_provider_refund');
    assert.deepEqual(recordVerifiedIsolatedSctRefund(db,booking.id,{
      id:'re_fixture',livemode:false,status:'succeeded',
      charge:'ch_fixture',payment_intent:'pi_fixture',amount:10000,currency:'eur',
    }),{status:'refunded',refundId:'re_fixture'});
    assert.equal(reserveIsolatedSctRefundCommand(db,plan()).blocked,
      'existing_refund_command_requires_reconciliation');
    assert.equal(db.prepare('SELECT count(*) n FROM sct_test_refund_commands').get().n,1);
  }finally{db.close()}
});
test('transfer journal, charge mismatch, and fabricated refund block',()=>{
  const db=fixture();
  try{
    db.exec(`CREATE TABLE supplier_transfer_commands(booking_id TEXT);
      INSERT INTO supplier_transfer_commands VALUES('RB-test-refund');`);
    assert.equal(reserveIsolatedSctRefundCommand(db,plan()).blocked,
      'transfer_command_requires_review');
    db.exec('DELETE FROM supplier_transfer_commands');
    const invalid={...plan(),refund:{...plan().refund,amount:9000}};
    assert.equal(reserveIsolatedSctRefundCommand(db,invalid).blocked,'settled_payment_mismatch');
    assert.equal(recordVerifiedIsolatedSctRefund(db,booking.id,{
      id:'re_fixture',livemode:false,status:'succeeded',
      charge:'ch_fixture',payment_intent:'pi_fixture',amount:10000,currency:'eur',
    }).blocked,'refund_verification_mismatch');
  }finally{db.close()}
});
