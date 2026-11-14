import assert from 'node:assert/strict';
import {test} from 'node:test';
import {planIsolatedSctPaymentIntent,verifyIsolatedSctPaymentIntent}
  from './modules/isolated-sct-platform-payment.js';

const booking={
  id:'RB-isolated-payment',listingId:'listing-1',
  status:'confirmed',paymentStatus:'unpaid',paymentIntentId:null,
  paymentFlow:'separate_charges_and_transfers',livemode:false,
  amountCents:10000,feeCents:1500,destination:'acct_fixture',
  financialHold:false,listingApproved:true,supplierEligible:true,
};
test('EUR 100 TEST platform payment has no automatic supplier transfer',()=>{
  const p=planIsolatedSctPaymentIntent(booking);
  assert.equal(p.idempotencyKey,'booking:RB-isolated-payment:sct-platform-payment:v1');
  assert.equal(p.paymentIntent.amount,10000);
  assert.equal(p.paymentIntent.metadata.commissionCents,'1500');
  for(const field of ['transfer_data','on_behalf_of','application_fee_amount'])
    assert.equal(Object.hasOwn(p.paymentIntent,field),false);
  assert.deepEqual(planIsolatedSctPaymentIntent(booking),p);
});
test('LIVE, direct charges and unconfirmed rentals are rejected',()=>{
  for(const [patch,blocked] of [
    [{livemode:true},'test_only'],
    [{paymentFlow:'direct_charge'},'unsupported_payment_flow'],
    [{status:'pending'},'booking_not_payable'],
    [{paymentStatus:'paid'},'booking_not_payable'],
    [{paymentIntentId:'pi_existing'},'booking_not_payable'],
    [{listingApproved:false},'eligibility_or_financial_hold'],
    [{supplierEligible:false},'eligibility_or_financial_hold'],
    [{financialHold:true},'eligibility_or_financial_hold'],
    [{amountCents:1},'invalid_payment_binding'],
    [{feeCents:10000},'invalid_payment_binding'],
    [{destination:'invalid'},'invalid_payment_binding'],
  ])assert.equal(planIsolatedSctPaymentIntent({...booking,...patch}).blocked,blocked);
});
test('read-back must match charge, tenant and platform-only payment attributes',()=>{
  const p=planIsolatedSctPaymentIntent(booking);
  const valid={id:'pi_fixture',livemode:false,...p.paymentIntent};
  assert.deepEqual(verifyIsolatedSctPaymentIntent(booking,valid),{ok:true,paymentIntentId:'pi_fixture'});
  for(const patch of [
    {livemode:true},{amount:9999},{currency:'usd'},
    {transfer_data:{destination:booking.destination}},
    {application_fee_amount:1500},{on_behalf_of:booking.destination},
    {metadata:{...valid.metadata,bookingId:'RB-other'}},
    {metadata:{...valid.metadata,commissionCents:'0'}},
  ])assert.equal(verifyIsolatedSctPaymentIntent(booking,{...valid,...patch}).blocked,
    'provider_payment_binding_mismatch');
});
