import Stripe from 'stripe';

const testClients = new WeakMap();

// Stripe stores credentials inside its authenticator. Track only clients built
// here from a validated TEST key, without inspecting private SDK fields.
export function createIsolatedStripeTestClient(key) {
  if (typeof key !== 'string' || !/^[sr]k_test_[A-Za-z0-9_-]{8,}$/.test(key)) {
    throw new TypeError('A Stripe TEST key is required');
  }
  const stripe = new Stripe(key, {maxNetworkRetries: 0});
  testClients.set(stripe, key);
  return stripe;
}

export function isIsolatedStripeTestClient(stripe, key) {
  const configuredKey = testClients.get(stripe);
  return configuredKey !== undefined && (key === undefined || configuredKey === key);
}
