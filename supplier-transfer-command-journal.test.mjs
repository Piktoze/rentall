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
    reserveSupplierTransferCommand(db,next);
    assert.equal(recordReconciledSupplierTransfer(db,booking.id,'tr_fixture').status,'transferred');
    assert.equal(recordReconciledSupplierTransfer(db,second.id,'tr_fixture').blocked,'transfer_id_already_used');
  } finally {db.close();}
});
