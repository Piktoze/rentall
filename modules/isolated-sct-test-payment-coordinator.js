// Isolated SCT TEST payment initiation coordinator.
// NOT imported by server.js. No existing Direct Charge booking is migrated.
// The authoritative booking snapshot and Stripe TEST adapter must be injected
// by a future authenticated internal worker. Never expose this on a public route.
import {
  reserveSctBookingBinding,bindSctPaymentIntent,
} from './sct-booking-binding.js';
import {planIsolatedSctPaymentIntent} from './isolated-sct-platform-payment.js';

export async function initiateIsolatedSctTestPayment({db,booking,adapter}={}) {
  const plan=planIsolatedSctPaymentIntent(booking);
  if(plan.blocked)return plan;
  if(typeof adapter?.createPlatformPayment!=='function')
    return {blocked:'test_provider_adapter_required'};
  // Claim the booking in SQLite before the first Stripe request. One successful
  // claim authorizes one network attempt; duplicate callers MUST NOT retry.
  const claimed=reserveSctBookingBinding(db,booking);
  if(claimed.blocked)return claimed;
  if(claimed.alreadyExists)return {
    blocked: claimed.paymentIntentId
      ? 'payment_intent_already_bound'
      : 'payment_creation_requires_manual_reconciliation',
    paymentIntentId:claimed.paymentIntentId||null,
  };
  let result;
  try {
    result=await adapter.createPlatformPayment(booking);
  }catch {
    // The provider may have created the intent before losing the response.
    // Retrying even with an idempotency key is unsafe after its retention window.
    return {blocked:'payment_creation_requires_manual_reconciliation'};
  }
  if(result?.blocked || !/^pi_[A-Za-z0-9]+$/.test(result?.paymentIntentId||'')){
    return {blocked:'payment_creation_requires_manual_reconciliation'};
  }
  const bound=bindSctPaymentIntent(db,booking.id,result.paymentIntentId);
  if(bound.blocked)return {blocked:'payment_binding_requires_manual_reconciliation'};
  return {status:'requires_customer_payment',
    paymentIntentId:result.paymentIntentId,clientSecret:result.clientSecret,
    providerStatus:result.status,bookingId:booking.id};
}
