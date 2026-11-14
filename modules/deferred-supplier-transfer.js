// Pure policy for the proposed Separate Charges and Transfers flow.
// The caller must supply a fresh, authoritative Stripe reconciliation.
export function planDeferredSupplierTransfer(booking, payment, nowMs) {
  if (booking.paymentFlow !== 'separate_charges_and_transfers') {
    return { blocked: 'unsupported_payment_flow' };
  }
  if (booking.transferStatus !== 'unclaimed') return { blocked: 'transfer_already_claimed' };
  if (booking.status !== 'returned' || !Number.isSafeInteger(booking.returnConfirmedAt) ||
      booking.returnConfirmedAt <= 0 || booking.returnConfirmedAt > nowMs) {
    return { blocked: 'return_unconfirmed' };
  }
  if (!Number.isSafeInteger(booking.releaseDeadlineAt) || !Number.isSafeInteger(nowMs) ||
      nowMs >= booking.releaseDeadlineAt) {
    return { blocked: 'holding_deadline_requires_review' };
  }
  const { id, paymentIntentId, chargeId, destination, amountCents, feeCents } = booking;
  if (!/^RB-[a-zA-Z0-9-]+$/.test(id ?? '') || !/^pi_[a-zA-Z0-9]+$/.test(paymentIntentId ?? '') ||
      !/^ch_[a-zA-Z0-9]+$/.test(chargeId ?? '') || !/^acct_[a-zA-Z0-9]+$/.test(destination ?? '') ||
      payment?.bookingId !== id || payment.paymentIntentId !== paymentIntentId ||
      payment.chargeId !== chargeId || payment.destination !== destination ||
      payment.scope !== 'platform' || typeof booking.livemode !== 'boolean' ||
      payment.livemode !== booking.livemode || payment.currency !== 'eur' ||
      !Number.isSafeInteger(amountCents) || amountCents <= 0 ||
      !Number.isSafeInteger(feeCents) || feeCents < 0 || feeCents >= amountCents ||
      payment.capturedAmountCents !== amountCents) {
    return { blocked: 'payment_binding_mismatch' };
  }
  if (payment.status !== 'succeeded' || payment.refundState !== 'none' ||
      payment.disputeState !== 'clear' || payment.financialHold !== false ||
      payment.destinationTransferActive !== true || payment.dataCurrent !== true) {
    return { blocked: 'financial_checks_pending' };
  }

  return {
    idempotencyKey: `booking:${id}:supplier-transfer:v1`,
    transfer: {
      amount: amountCents - feeCents,
      currency: 'eur',
      destination,
      source_transaction: chargeId,
      transfer_group: id,
      metadata: { bookingId: id, paymentIntentId },
    },
  };
}
