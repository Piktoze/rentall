// TEST-only Stripe Connect SCT adapter. Not imported by the running server.
// Actual integration requires a platform TEST Stripe SDK client and a separate
// authenticated workflow; never expose these operations on a public route.
import {
  planIsolatedSctPaymentIntent,
  verifyIsolatedSctPaymentIntent,
} from './isolated-sct-platform-payment.js';

export function makeIsolatedTestSctStripeAdapter({ stripe, stripeMode } = {}) {
  if (stripeMode !== 'test' ||
      typeof stripe?.paymentIntents?.create !== 'function' ||
      typeof stripe?.paymentIntents?.retrieve !== 'function' ||
      typeof stripe?.transfers?.create !== 'function' ||
      typeof stripe?.transfers?.retrieve !== 'function') {
    return { blocked: 'platform_test_stripe_client_required' };
  }
  return {
    async createPlatformPayment(booking) {
      const plan = planIsolatedSctPaymentIntent(booking);
      if (plan.blocked) return plan;
      // Deliberately no stripeAccount option: platform receives the charge.
      const intent = await stripe.paymentIntents.create(plan.paymentIntent,
        { idempotencyKey:plan.idempotencyKey });
      const authoritative = await stripe.paymentIntents.retrieve(intent.id);
      const bound = verifyIsolatedSctPaymentIntent(booking, authoritative);
      return bound.blocked ? bound : {
        paymentIntentId:bound.paymentIntentId,
        clientSecret:intent.client_secret,
        status:authoritative.status,
      };
    },
    async createSupplierTransfer(payload, { idempotencyKey } = {}) {
      if (!/^booking:RB-[A-Za-z0-9-]+:supplier-transfer:v1$/.test(idempotencyKey || '') ||
          payload?.transfer_group !== idempotencyKey.slice(8,-21) ||
          !/^ch_[A-Za-z0-9]+$/.test(payload?.source_transaction||'') ||
          !/^acct_[A-Za-z0-9]+$/.test(payload?.destination||'') ||
          !Number.isSafeInteger(payload?.amount) || payload.amount<=0 ||
          payload?.currency !== 'eur') throw new Error('Invalid isolated TEST transfer binding');
      // This adapter remains unreachable from the running app.
      return stripe.transfers.create(payload,{idempotencyKey});
    },
    async retrieveSupplierTransfer(id) {
      if(!/^tr_[A-Za-z0-9]+$/.test(id||''))throw new Error('Invalid transfer ID');
      return stripe.transfers.retrieve(id);
    },
  };
}
