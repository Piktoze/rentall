import assert from 'node:assert/strict';
import {test} from 'node:test';
import Database from 'better-sqlite3';
import {assessLegacyDirectChargeOperation} from './modules/sct-legacy-direct-charge-guard.js';
import {installSctBookingBindings,reserveSctBookingBinding} from './modules/sct-booking-binding.js';

test('legacy Direct Charges can process unbound bookings but reject SCT bookings',()=>{
  const db=new Database(':memory:');
  try{
    installSctBookingBindings(db);
    assert.deepEqual(assessLegacyDirectChargeOperation(db,'RB-legacy-1'),{ok:true});
    assert.deepEqual(reserveSctBookingBinding(db,{
      id:'RB-sct-1',listingId:'listing-1',amountCents:10000,feeCents:1500,
      destination:'acct_fixture',livemode:false,
    }),{status:'reserved',paymentIntentId:null,alreadyExists:false});
    assert.deepEqual(assessLegacyDirectChargeOperation(db,'RB-sct-1'),
      {blocked:'SCT_REQUIRES_SEPARATE_FINANCIAL_FLOW'});
    assert.deepEqual(assessLegacyDirectChargeOperation(db,'RB-legacy-1'),{ok:true});
  }finally{db.close()}
});
test('guard works with pre-SCT schema and rejects malformed request',()=>{
  const db=new Database(':memory:');
  try{
    assert.deepEqual(assessLegacyDirectChargeOperation(db,'RB-existing'),{ok:true});
    assert.deepEqual(assessLegacyDirectChargeOperation(db,'legacy-booking-id'),{ok:true});
    assert.equal(assessLegacyDirectChargeOperation(db,'').blocked,'invalid_booking_id');
    assert.equal(assessLegacyDirectChargeOperation(null,'RB-existing').blocked,'database_required');
  }finally{db.close()}
});
