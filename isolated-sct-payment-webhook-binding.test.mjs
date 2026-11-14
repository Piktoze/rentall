import assert from 'node:assert/strict';
import {test} from 'node:test';
import {validateIsolatedSctPaymentWebhook} from './modules/isolated-sct-payment-webhook-binding.js';
const booking={
  id:'RB-sct-webhook',listingId:'listing-1',status:'confirmed',paymentStatus:'unpaid',
  paymentFlow:'separate_charges_and_transfers',livemode:false,paymentIntentId:'pi_fixture',
  destination:'acct_fixture',amountCents:10000,feeCents:1500,financialHold:false,
  stripeRefundId:null,
};
const pi={
  id:'pi_fixture',livemode:false,status:'succeeded',amount:10000,amount_received:10000,
  currency:'eur',metadata:{bookingId:booking.id,listingId:booking.listingId,
    purpose:'rental_payment',paymentFlow:'separate_charges_and_transfers',
    supplierStripeAccountId:booking.destination,commissionCents:'1500'},
};
const event={type:'payment_intent.succeeded',livemode:false,data:{object:pi}};
test('accepts only platform TEST succeeded SCT payment with immutable 100/15/85 split',()=>{
  assert.deepEqual(validateIsolatedSctPaymentWebhook(event,booking),{
    ok:true,bookingId:booking.id,paymentIntentId:pi.id,
    amountCents:10000,commissionCents:1500,supplierCents:8500,
  });
});
test('rejects connected-account and LIVE events',()=>{
  assert.equal(validateIsolatedSctPaymentWebhook({...event,account:'acct_fixture'},booking).blocked,
    'unexpected_connected_account');
  assert.equal(validateIsolatedSctPaymentWebhook({...event,livemode:true},booking).blocked,'test_only');
  assert.equal(validateIsolatedSctPaymentWebhook(event,{...booking,livemode:true}).blocked,'test_only');
});
test('rejects stale, refunded or held bookings',()=>{
  for(const patch of [
    {status:'cancelled'},{paymentStatus:'paid'},{paymentStatus:'refunded'},
    {financialHold:true},{stripeRefundId:'re_old'},{paymentFlow:'direct_charge'}
  ]) assert.ok(validateIsolatedSctPaymentWebhook(event,{...booking,...patch}).blocked);
});
test('rejects altered amount, recipient, fee, and automatic transfer',()=>{
  for(const patch of [
    {amount:9000},{amount_received:9000},{currency:'usd'},
    {application_fee_amount:1500},
    {transfer_data:{destination:'acct_fixture'}},
    {on_behalf_of:'acct_fixture'},
    {metadata:{...pi.metadata,bookingId:'RB-another'}},
    {metadata:{...pi.metadata,commissionCents:'0'}},
    {metadata:{...pi.metadata,supplierStripeAccountId:'acct_other'}},
  ]) assert.equal(validateIsolatedSctPaymentWebhook({...event,data:{object:{...pi,...patch}}},booking).blocked,
    'payment_binding_mismatch');
});
test('rejects wrong event type',()=>{
  assert.equal(validateIsolatedSctPaymentWebhook({...event,type:'payment_intent.processing'},booking).blocked,
    'unsupported_event');
});
