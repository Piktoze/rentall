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
