import assert from 'node:assert/strict';
import {test} from 'node:test';
import Database from 'better-sqlite3';
import {installSupplierTransferCommands} from './modules/supplier-transfer-command-journal.js';
import {executeIsolatedTestSupplierTransfer} from './modules/isolated-test-supplier-transfer-executor.js';

const booking={
  id:'RB-isolated-executor',status:'returned',returnConfirmedAt:800,releaseDeadlineAt:1200,
  paymentFlow:'separate_charges_and_transfers',transferStatus:'unclaimed',
  amountCents:10000,feeCents:1500,paymentIntentId:'pi_fixture',chargeId:'ch_fixture',
  destination:'acct_fixture',livemode:false,
};
const payment={
  bookingId:booking.id,paymentIntentId:booking.paymentIntentId,chargeId:booking.chargeId,
  destination:booking.destination,capturedAmountCents:10000,currency:'eur',livemode:false,
  scope:'platform',status:'succeeded',refundState:'none',disputeState:'clear',
  financialHold:false,destinationTransferActive:true,dataCurrent:true,
};
function harness({create,verify}={}){
  const db=new Database(':memory:');installSupplierTransferCommands(db);
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
      'RB-isolated-executor','returned','2026-11-15T08:00:00Z',
      'paid','pi_fixture',NULL,NULL,'not_ready',100,15,85);
    INSERT INTO sct_booking_bindings VALUES(
      'RB-isolated-executor','pi_fixture','acct_fixture',10000,1500,'test');
    INSERT INTO sct_payment_settlements VALUES(
      'RB-isolated-executor','pi_fixture','ch_fixture',10000,1500,8500);
  `);
  let calls=0;
  const transfer={
    id:'tr_fixture',livemode:false,amount:8500,currency:'eur',
    destination:booking.destination,source_transaction:booking.chargeId,
    transfer_group:booking.id,metadata:{bookingId:booking.id,paymentIntentId:booking.paymentIntentId},
  };
  const createTransfer=async (args,options)=>{
    calls++;assert.equal(args.amount,8500);
    assert.equal(options.idempotencyKey,'booking:RB-isolated-executor:supplier-transfer:v1');
    return create?create(args,options):{id:'tr_fixture'};
  };
  const retrieveTransfer=async id=>verify?verify(id):transfer;
  const execute=(b=booking,p=payment)=>executeIsolatedTestSupplierTransfer({
    db,booking:b,payment:p,nowMs:1000,createTransfer,retrieveTransfer,
  });
  return {db,execute,calls:()=>calls,transfer};
}
test('one TEST Stripe transfer is verified and never replayed',async()=>{
  const h=harness();
  try{
    assert.deepEqual(await h.execute(),{status:'transferred',transferId:'tr_fixture'});
    assert.equal(h.calls(),1);
    assert.deepEqual(await h.execute(),{
      blocked:'existing_command_requires_reconciliation',status:'transferred',
    });
    assert.equal(h.calls(),1);
  }finally{h.db.close();}
});
test('LIVE booking cannot call the provider',async()=>{
  const h=harness();
  try{
    assert.equal((await h.execute({...booking,livemode:true})).blocked,'test_only');
    assert.equal(h.calls(),0);
  }finally{h.db.close();}
});
test('unreturned booking cannot call the provider',async()=>{
  const h=harness();
  try{
    assert.equal((await h.execute({...booking,status:'active'})).blocked,'return_unconfirmed');
    assert.equal(h.calls(),0);
  }finally{h.db.close();}
});
test('disputed payment cannot call the provider',async()=>{
  const h=harness();
  try{
    assert.equal((await h.execute(booking,{...payment,disputeState:'open'})).blocked,
      'financial_checks_pending');
    assert.equal(h.calls(),0);
  }finally{h.db.close();}
});
test('timeout leaves durable reconciliation state and forbids retry',async()=>{
  const h=harness({create:async()=>{throw Error('timeout')}});
  try{
    assert.equal((await h.execute()).blocked,'provider_result_unknown_reconcile_required');
    assert.equal(h.db.prepare('SELECT status FROM supplier_transfer_commands').get().status,
      'reconcile_required');
    assert.equal((await h.execute()).blocked,'existing_command_requires_reconciliation');
    assert.equal(h.calls(),1);
  }finally{h.db.close();}
});
test('mismatched Stripe readback blocks settlement',async()=>{
  const h=harness({verify:async()=>({...h.transfer,amount:8400})});
  try{
    assert.equal((await h.execute()).blocked,'stripe_transfer_verification_failed');
    assert.equal(h.db.prepare('SELECT status FROM supplier_transfer_commands').get().status,
      'reconcile_required');
    assert.equal(h.calls(),1);
  }finally{h.db.close();}
});
test('missing provider callbacks cannot claim transfer',async()=>{
  const db=new Database(':memory:');
  try{
    installSupplierTransferCommands(db);
    assert.equal((await executeIsolatedTestSupplierTransfer({db,booking,payment,nowMs:1000})).blocked,
      'provider_callbacks_required');
    assert.equal(db.prepare('SELECT count(*) AS n FROM supplier_transfer_commands').get().n,0);
  }finally{db.close();}
});

test('canonical paid state changed after policy snapshot prevents Stripe transfer',async()=>{
  const h=harness();
  try{
    h.db.exec("UPDATE rental_bookings SET payment_status='refunded'");
    assert.equal((await h.execute()).blocked,'canonical_return_or_payment_not_releasable');
    assert.equal(h.calls(),0);
  }finally{h.db.close()}
});
test('canonical returnedAt missing prevents Stripe transfer',async()=>{
  const h=harness();
  try{
    h.db.exec('UPDATE rental_bookings SET returned_at=NULL');
    assert.equal((await h.execute()).blocked,'canonical_return_or_payment_not_releasable');
    assert.equal(h.calls(),0);
  }finally{h.db.close()}
});
