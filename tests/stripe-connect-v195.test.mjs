import assert from 'node:assert/strict';
import {
  STRIPE_CONNECT_MODEL_V195,
  directMerchantCapabilityStatus,
  connectedRequestOptions,
  normalizeCountry,
  normalizeEntityType
} from '../modules/stripe-connect-v195.js';

assert.equal(STRIPE_CONNECT_MODEL_V195.chargePattern,'direct');
assert.equal(STRIPE_CONNECT_MODEL_V195.dashboard,'express');
assert.equal(STRIPE_CONNECT_MODEL_V195.feesCollector,'stripe');
assert.equal(STRIPE_CONNECT_MODEL_V195.lossesCollector,'stripe');
assert.equal(normalizeCountry('lt'),'LT');
assert.equal(normalizeEntityType('company'),'company');
assert.deepEqual(connectedRequestOptions('acct_123',{idempotencyKey:'abc'}),{idempotencyKey:'abc',stripeAccount:'acct_123'});

const status=directMerchantCapabilityStatus({
  id:'acct_123',
  dashboard:'express',
  defaults:{responsibilities:{fees_collector:'stripe',losses_collector:'stripe'}},
  configuration:{merchant:{capabilities:{card_payments:{status:'active'}}}},
  requirements:{entries:[]}
});
assert.equal(status.state,'active');
assert.equal(status.merchantCapabilityStatus,'active');
assert.equal(status.feesCollector,'stripe');
assert.equal(status.lossesCollector,'stripe');
console.log('stripe-connect-v195 tests passed');
