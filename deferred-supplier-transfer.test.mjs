import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planDeferredSupplierTransfer } from './modules/deferred-supplier-transfer.js';

const now = 1000;
const booking = {
  id: 'RB-isolated-test', status: 'returned', returnConfirmedAt: 800, releaseDeadlineAt: 1200,
  paymentFlow: 'separate_charges_and_transfers', transferStatus: 'unclaimed', amountCents: 10000,
  feeCents: 1500, paymentIntentId: 'pi_fixture', chargeId: 'ch_fixture', destination: 'acct_fixture',
  livemode: false,
};
const payment = {
  bookingId: booking.id, paymentIntentId: booking.paymentIntentId, chargeId: booking.chargeId,
  destination: booking.destination, capturedAmountCents: 10000, currency: 'eur', livemode: false,
  scope: 'platform', status: 'succeeded', refundState: 'none', disputeState: 'clear',
  financialHold: false, destinationTransferActive: true, dataCurrent: true,
};

test('confirmed return and clear finances generate a stable EUR 85 transfer request', () => {
  const result = planDeferredSupplierTransfer(booking, payment, now);
  assert.deepEqual(result, {
    idempotencyKey: 'booking:RB-isolated-test:supplier-transfer:v1',
    transfer: {
      amount: 8500, currency: 'eur', destination: booking.destination, source_transaction: booking.chargeId,
      transfer_group: booking.id, metadata: { bookingId: booking.id, paymentIntentId: booking.paymentIntentId },
    },
  });
  assert.deepEqual(planDeferredSupplierTransfer(booking, payment, now + 1), result);
});

for (const [name, patch, reason] of [
  ['legacy Direct Charge', { paymentFlow: 'direct_charge' }, 'unsupported_payment_flow'],
  ['paid', { status: 'paid' }, 'return_unconfirmed'],
  ['handed over', { status: 'active' }, 'return_unconfirmed'],
  ['renter submitted return', { returnConfirmedAt: null }, 'return_unconfirmed'],
  ['future confirmation', { returnConfirmedAt: now + 1 }, 'return_unconfirmed'],
  ['holding deadline reached', { releaseDeadlineAt: now }, 'holding_deadline_requires_review'],
  ['no approved holding deadline', { releaseDeadlineAt: null }, 'holding_deadline_requires_review'],
  ['duplicate after claim', { transferStatus: 'claimed' }, 'transfer_already_claimed'],
  ['duplicate after uncertain response', { transferStatus: 'reconcile_required' }, 'transfer_already_claimed'],
  ['duplicate after completion', { transferStatus: 'transferred' }, 'transfer_already_claimed'],
]) {
  test(name, () => assert.deepEqual(planDeferredSupplierTransfer({ ...booking, ...patch }, payment, now), { blocked: reason }));
}

for (const [field, value] of [
  ['bookingId', 'RB-another'], ['paymentIntentId', 'pi_other'], ['chargeId', 'ch_other'],
  ['destination', 'acct_other'], ['capturedAmountCents', 9500], ['currency', 'usd'],
  ['livemode', true], ['scope', 'connected_account'],
]) {
  test(`binding rejects ${field} mismatch`, () => {
    assert.deepEqual(planDeferredSupplierTransfer(booking, { ...payment, [field]: value }, now),
      { blocked: 'payment_binding_mismatch' });
  });
}

for (const [field, value] of [
  ['status', 'processing'], ['refundState', 'pending'], ['refundState', 'partial'],
  ['refundState', 'refunded'], ['disputeState', 'open'], ['disputeState', 'lost'],
  ['disputeState', undefined], ['financialHold', true], ['dataCurrent', false],
  ['destinationTransferActive', false],
]) {
  test(`financial checks reject ${field}=${value}`, () => {
    assert.deepEqual(planDeferredSupplierTransfer(booking, { ...payment, [field]: value }, now),
      { blocked: 'financial_checks_pending' });
  });
}
