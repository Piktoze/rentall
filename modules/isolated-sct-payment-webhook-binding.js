// Authoritative binding policy for platform-level SCT payment webhooks.
// The caller is responsible for Stripe signature verification, event deduplication,
// and obtaining the immutable booking/payment snapshot from its own database.
export function validateIsolatedSctPaymentWebhook(event, booking) {
  if (event?.type !== 'payment_intent.succeeded') return {blocked:'unsupported_event'};
  const pi=event.data?.object;
  if (event.livemode!==false || pi?.livemode!==false || booking?.livemode!==false)
    return {blocked:'test_only'};
  // For a platform payment Stripe does not attach a connected account to the event.
  if (event.account != null) return {blocked:'unexpected_connected_account'};
  if (booking.paymentFlow!=='separate_charges_and_transfers')
    return {blocked:'unsupported_payment_flow'};
  if (!['confirmed','active','returned'].includes(booking.status) ||
      ['paid','refunded','partially_refunded'].includes(booking.paymentStatus) ||
      booking.financialHold!==false || booking.stripeRefundId)
    return {blocked:'booking_not_payable'};
  if (!/^RB-[A-Za-z0-9-]+$/.test(booking.id||'') ||
      !/^pi_[A-Za-z0-9]+$/.test(pi?.id||'') ||
      booking.paymentIntentId!==pi.id ||
      pi.status!=='succeeded' ||
      pi.metadata?.bookingId!==booking.id ||
      pi.metadata?.listingId!==booking.listingId ||
      pi.metadata?.purpose!=='rental_payment' ||
      pi.metadata?.paymentFlow!=='separate_charges_and_transfers' ||
      pi.metadata?.supplierStripeAccountId!==booking.destination ||
      pi.metadata?.commissionCents!==String(booking.feeCents) ||
      pi.currency!=='eur' ||
      pi.amount!==booking.amountCents ||
      pi.amount_received!==booking.amountCents ||
      !Number.isSafeInteger(booking.feeCents) ||
      booking.feeCents<0 || booking.feeCents>=booking.amountCents ||
      pi.application_fee_amount!=null || pi.transfer_data!=null ||
      pi.on_behalf_of!=null)
    return {blocked:'payment_binding_mismatch'};
  return {
    ok:true,bookingId:booking.id,paymentIntentId:pi.id,
    amountCents:booking.amountCents,commissionCents:booking.feeCents,
    supplierCents:booking.amountCents-booking.feeCents,
  };
}
