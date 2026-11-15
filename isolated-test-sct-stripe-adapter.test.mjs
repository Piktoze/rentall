import {createIsolatedStripeTestClient} from './modules/isolated-stripe-test-client.js';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {makeIsolatedTestSctStripeAdapter} from './modules/isolated-test-sct-stripe-adapter.js';
const booking={
  id:'RB-adapter',listingId:'listing-1',status:'confirmed',paymentStatus:'unpaid',
  paymentIntentId:null,paymentFlow:'separate_charges_and_transfers',livemode:false,
  amountCents:10000,feeCents:1500,destination:'acct_fixture',
  financialHold:false,listingApproved:true,supplierEligible:true,
};
function mockStripe({paymentPatch={},transferPatch={}}={}) {
  const calls=[];
  const intent={
    id:'pi_fixture',livemode:false,amount:10000,currency:'eur',capture_method:'automatic',
    status:'requires_payment_method',
    metadata:{bookingId:booking.id,listingId:booking.listingId,purpose:'rental_payment',
      paymentFlow:'separate_charges_and_transfers',supplierStripeAccountId:booking.destination,
      commissionCents:'1500'},
  };
  const stripe=Object.assign(createIsolatedStripeTestClient('sk_test_fixture0123456789'),{
    paymentIntents:{
      create:async (...args)=>{calls.push(['pi_create',...args]);return {...intent,client_secret:'test_secret'};},
      retrieve:async (...args)=>{calls.push(['pi_retrieve',...args]);return {...intent,...paymentPatch};},
    },
    transfers:{
      create:async (...args)=>{calls.push(['tr_create',...args]);return {id:'tr_fixture',...transferPatch};},
      retrieve:async (...args)=>{calls.push(['tr_retrieve',...args]);return {id:'tr_fixture',...transferPatch};},
    }
  });
  return {stripe,calls};
}
test('TEST only and complete injected platform client required',()=>{
  assert.equal(makeIsolatedTestSctStripeAdapter({stripeMode:'live',stripe:mockStripe().stripe}).blocked,
    'platform_test_stripe_client_required');
  assert.equal(makeIsolatedTestSctStripeAdapter({stripeMode:'test',stripe:{}}).blocked,
    'platform_test_stripe_client_required');
});
test('PaymentIntent on platform never uses connected-account Stripe context',async()=>{
  const m=mockStripe();const a=makeIsolatedTestSctStripeAdapter({stripeMode:'test',stripe:m.stripe});
  assert.deepEqual(await a.createPlatformPayment(booking),{
    paymentIntentId:'pi_fixture',clientSecret:'test_secret',status:'requires_payment_method'});
  const [type,params,opts]=m.calls[0];
  assert.equal(type,'pi_create');
  assert.equal(params.amount,10000);
  assert.equal(opts.idempotencyKey,'booking:RB-adapter:sct-platform-payment:v1');
  assert.equal(Object.hasOwn(opts,'stripeAccount'),false);
  for(const attr of ['transfer_data','application_fee_amount','on_behalf_of'])
    assert.equal(Object.hasOwn(params,attr),false);
});
test('provider payment mismatch fails closed',async()=>{
  const m=mockStripe({paymentPatch:{amount:9900}});
  const a=makeIsolatedTestSctStripeAdapter({stripeMode:'test',stripe:m.stripe});
  assert.equal((await a.createPlatformPayment(booking)).blocked,'provider_payment_binding_mismatch');
});
test('TRANSFER prototype enforces immutable booking idempotency',async()=>{
  const m=mockStripe();const a=makeIsolatedTestSctStripeAdapter({stripeMode:'test',stripe:m.stripe});
  const payload={amount:8500,currency:'eur',destination:'acct_fixture',
    source_transaction:'ch_fixture',transfer_group:'RB-adapter'};
  const idempotencyKey='booking:RB-adapter:supplier-transfer:v1';
  assert.equal((await a.createSupplierTransfer(payload,{idempotencyKey})).id,'tr_fixture');
  assert.deepEqual(m.calls[0],['tr_create',payload,{idempotencyKey}]);
  await assert.rejects(()=>a.createSupplierTransfer({...payload,transfer_group:'RB-other'},
    {idempotencyKey}),/Invalid isolated TEST/);
  assert.equal(m.calls.length,1);
});
