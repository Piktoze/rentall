import assert from 'node:assert/strict';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import {
  installSupplierTransferCommands, reserveSupplierTransferCommand,
  markSupplierTransferReconciliationRequired, recordReconciledSupplierTransfer,
} from './modules/supplier-transfer-command-journal.js';
import { planDeferredSupplierTransfer } from './modules/deferred-supplier-transfer.js';

function setup() {
  const db = new Database(':memory:');
  installSupplierTransferCommands(db);
  db.exec(`
    CREATE TABLE rental_bookings(
      booking_id TEXT PRIMARY KEY,status TEXT,returned_at TEXT,
      payment_status TEXT,stripe_payment_intent_id TEXT,stripe_refund_id TEXT,
      refund_status TEXT,payout_status TEXT,order_value REAL,
      platform_fee_amount REAL,supplier_amount REAL);
    CREATE TABLE sct_booking_bindings(
      booking_id TEXT PRIMARY KEY,payment_intent_id TEXT,destination TEXT,
      amount_cents INTEGER,fee_cents INTEGER,stripe_mode TEXT);
    CREATE TABLE sct_payment_settlements(
      booking_id TEXT PRIMARY KEY,payment_intent_id TEXT,charge_id TEXT,
      amount_cents INTEGER,fee_cents INTEGER,supplier_cents INTEGER);
    INSERT INTO rental_bookings VALUES(
      'RB-isolated-journal','returned','2026-11-15T08:00:00Z',
      'paid','pi_fixture',NULL,NULL,'not_ready',100,15,85);
    INSERT INTO sct_booking_bindings VALUES(
      'RB-isolated-journal','pi_fixture','acct_fixture',10000,1500,'test');
    INSERT INTO sct_payment_settlements VALUES(
      'RB-isolated-journal','pi_fixture','ch_fixture',10000,1500,8500);
  `);
  return db;
}
const booking = {
  id:'RB-isolated-journal',status:'returned',returnConfirmedAt:800,releaseDeadlineAt:1200,
  paymentFlow:'separate_charges_and_transfers',transferStatus:'unclaimed',
  amountCents:10000,feeCents:1500,paymentIntentId:'pi_fixture',
  chargeId:'ch_fixture',destination:'acct_fixture',livemode:false,
};
const payment = {
  bookingId:booking.id,paymentIntentId:booking.paymentIntentId,chargeId:booking.chargeId,
  destination:booking.destination,capturedAmountCents:10000,currency:'eur',livemode:false,
  scope:'platform',status:'succeeded',refundState:'none',disputeState:'clear',
  financialHold:false,destinationTransferActive:true,dataCurrent:true,
};
const plan = planDeferredSupplierTransfer(booking,payment,1000);
test('one immutable 85 EUR transfer command per booking', () => {
  const db=setup();
  try {
    assert.deepEqual(reserveSupplierTransferCommand(db,plan),
      {status:'reserved',idempotencyKey:plan.idempotencyKey,alreadyExists:false});
    assert.equal(reserveSupplierTransferCommand(db,plan).alreadyExists,true);
    assert.equal(db.prepare('SELECT count(*) AS n FROM supplier_transfer_commands').get().n,1);
    assert.equal(db.prepare('SELECT amount_cents AS n FROM supplier_transfer_commands').get().n,8500);
    assert.equal(reserveSupplierTransferCommand(db,{...plan,transfer:{...plan.transfer,amount:8501}}).blocked,
      'transfer_command_conflict');
  } finally {db.close();}
});
test('network uncertainty cannot create a second transfer command',()=>{
  const db=setup();
  try {
    reserveSupplierTransferCommand(db,plan);
    assert.equal(markSupplierTransferReconciliationRequired(db,booking.id),true);
    assert.equal(markSupplierTransferReconciliationRequired(db,booking.id),false);
    assert.equal(reserveSupplierTransferCommand(db,plan).status,'reconcile_required');
    assert.equal(db.prepare('SELECT count(*) AS n FROM supplier_transfer_commands').get().n,1);
  } finally {db.close();}
});
test('recording a reconciled Stripe Transfer is idempotent and identity-locked',()=>{
  const db=setup();
  try {
    reserveSupplierTransferCommand(db,plan);
    markSupplierTransferReconciliationRequired(db,booking.id);
    assert.deepEqual(recordReconciledSupplierTransfer(db,booking.id,'tr_fixture'),
      {status:'transferred',alreadyExists:false});
    assert.deepEqual(recordReconciledSupplierTransfer(db,booking.id,'tr_fixture'),
      {status:'transferred',alreadyExists:true});
    assert.equal(recordReconciledSupplierTransfer(db,booking.id,'tr_other').blocked,
      'transfer_identity_conflict');
    assert.equal(reserveSupplierTransferCommand(db,plan).status,'transferred');
  } finally {db.close();}
});
test('unrecognized commands and IDs are rejected without side effects',()=>{
  const db=setup();
  try {
    assert.equal(reserveSupplierTransferCommand(db,{blocked:'financial_checks_pending'}).blocked,
      'invalid_transfer_plan');
    assert.equal(recordReconciledSupplierTransfer(db,booking.id,'not_a_transfer').blocked,
      'invalid_transfer_id');
    assert.equal(recordReconciledSupplierTransfer(db,booking.id,'tr_fixture').blocked,
      'unknown_transfer_command');
    assert.equal(db.prepare('SELECT count(*) AS n FROM supplier_transfer_commands').get().n,0);
  } finally {db.close();}
});
test('the same Stripe transfer ID cannot attach to two bookings',()=>{
  const db=setup();
  try {
    reserveSupplierTransferCommand(db,plan);
    const second = {
      id:'RB-other-journal',paymentIntentId:'pi_other',chargeId:'ch_other',
    };
    const next=planDeferredSupplierTransfer({...booking,...second},
      {...payment,bookingId:second.id,paymentIntentId:second.paymentIntentId,chargeId:second.chargeId},1000);
    db.exec(`
      INSERT INTO rental_bookings VALUES(
        'RB-other-journal','returned','2026-11-15T08:00:00Z',
        'paid','pi_other',NULL,NULL,'not_ready',100,15,85);
      INSERT INTO sct_booking_bindings VALUES(
        'RB-other-journal','pi_other','acct_fixture',10000,1500,'test');
      INSERT INTO sct_payment_settlements VALUES(
        'RB-other-journal','pi_other','ch_other',10000,1500,8500);
    `);
    assert.equal(reserveSupplierTransferCommand(db,next).status,'reserved');
    assert.equal(recordReconciledSupplierTransfer(db,booking.id,'tr_fixture').status,'transferred');
    assert.equal(recordReconciledSupplierTransfer(db,second.id,'tr_fixture').blocked,'transfer_id_already_used');
  } finally {db.close();}
});

test('SCT refund command blocks later supplier transfer, even when refund result is unknown',()=>{
  for(const status of ['reserved','reconcile_required','refunded']){
    const db=setup();
    try{
      db.exec(`CREATE TABLE sct_test_refund_commands(
        booking_id TEXT PRIMARY KEY,status TEXT NOT NULL);
        INSERT INTO sct_test_refund_commands VALUES ('RB-isolated-journal','${status}');`);
      assert.equal(reserveSupplierTransferCommand(db,plan).blocked,
        'sct_refund_command_requires_review');
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM supplier_transfer_commands').get().n,0);
    }finally{db.close()}
  }
});
test('refund command appearing after transfer reservation blocks transfer replay',()=>{
  const db=setup();
  try{
    assert.equal(reserveSupplierTransferCommand(db,plan).status,'reserved');
    db.exec(`CREATE TABLE sct_test_refund_commands(booking_id TEXT PRIMARY KEY);
      INSERT INTO sct_test_refund_commands VALUES ('RB-isolated-journal');`);
    assert.equal(reserveSupplierTransferCommand(db,plan).blocked,
      'sct_refund_command_requires_review');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM supplier_transfer_commands').get().n,1);
  }finally{db.close()}
});

test('canonical refund, unconfirmed return, paid status and altered fee block transfer reservation',()=>{
  for(const [sql,expected] of [
    ["UPDATE rental_bookings SET status='active'","canonical_return_or_payment_not_releasable"],
    ["UPDATE rental_bookings SET returned_at=NULL","canonical_return_or_payment_not_releasable"],
    ["UPDATE rental_bookings SET payment_status='refunded'","canonical_return_or_payment_not_releasable"],
    ["UPDATE rental_bookings SET stripe_refund_id='re_fixture'","canonical_return_or_payment_not_releasable"],
    ["UPDATE rental_bookings SET supplier_amount=86","canonical_return_or_payment_not_releasable"],
    ["UPDATE sct_booking_bindings SET fee_cents=1600","canonical_return_or_payment_not_releasable"],
    ["UPDATE sct_booking_bindings SET destination='acct_other'","canonical_return_or_payment_not_releasable"],
  ]){
    const db=setup();
    try{
      db.exec(sql);
      assert.equal(reserveSupplierTransferCommand(db,plan).blocked,expected);
      assert.equal(db.prepare('SELECT COUNT(*) n FROM supplier_transfer_commands').get().n,0);
    }finally{db.close()}
  }
});
test('historical dispute blocks 85 EUR supplier transfer even if marked closed',()=>{
  const db=setup();
  try{
    db.exec(`CREATE TABLE stripe_rental_disputes(booking_id TEXT,closed INTEGER);
      INSERT INTO stripe_rental_disputes VALUES('RB-isolated-journal',1);`);
    assert.equal(reserveSupplierTransferCommand(db,plan).blocked,'financial_dispute_requires_review');
  }finally{db.close()}
});
test('missing authoritative settlement table refuses transfer reservation',()=>{
  const db=setup();
  try{
    db.exec('DROP TABLE sct_payment_settlements');
    assert.equal(reserveSupplierTransferCommand(db,plan).blocked,'canonical_transfer_evidence_unavailable');
  }finally{db.close()}
});
