// SCT platform-payment intent policy for isolated TEST validation.
// Not connected to checkout: caller must supply an authenticated, authoritative
// booking snapshot and platform Stripe client in a separate integration step.
export function planIsolatedSctPaymentIntent(booking) {
  if (booking?.livemode !== false) return {blocked:'test_only'};
  if (booking?.paymentFlow !== 'separate_charges_and_transfers')
    return {blocked:'unsupported_payment_flow'};
  if (booking.status !== 'confirmed' || booking.paymentStatus !== 'unpaid' ||
      booking.paymentIntentId) return {blocked:'booking_not_payable'};
  if (booking.financialHold !== false || booking.listingApproved !== true ||
      booking.supplierEligible !== true) return {blocked:'eligibility_or_financial_hold'};
  const {id,amountCents,feeCents,destination,listingId}=booking;
  if (!/^RB-[A-Za-z0-9-]+$/.test(id||'') ||
      !/^acct_[A-Za-z0-9]+$/.test(destination||'') ||
      !/^[A-Za-z0-9-]+$/.test(listingId||'') ||
      !Number.isSafeInteger(amountCents) || amountCents<50 ||
      !Number.isSafeInteger(feeCents) || feeCents<0 || feeCents>=amountCents)
    return {blocked:'invalid_payment_binding'};
  return {
    idempotencyKey:`booking:${id}:sct-platform-payment:v1`,
    paymentIntent:{
      amount:amountCents,
      currency:'eur',
      capture_method:'automatic',
      // Intentionally NO transfer_data, application_fee_amount or on_behalf_of.
      // Those fields require separate explicit legal/Stripe approval.
      metadata:{
        bookingId:id,listingId,purpose:'rental_payment',
        paymentFlow:'separate_charges_and_transfers',
        supplierStripeAccountId:destination,
        commissionCents:String(feeCents),
      },
    },
  };
}

export function verifyIsolatedSctPaymentIntent(booking, intent) {
  const plan=planIsolatedSctPaymentIntent(booking);
  if(plan.blocked)return plan;
  const wanted=plan.paymentIntent;
  if(!/^pi_[A-Za-z0-9]+$/.test(intent?.id||'') ||
      intent.livemode!==false ||
      intent.amount!==wanted.amount || intent.currency!=='eur' ||
      intent.capture_method!=='automatic' ||
      intent.metadata?.bookingId!==booking.id ||
      intent.metadata?.listingId!==booking.listingId ||
      intent.metadata?.purpose!=='rental_payment' ||
      intent.metadata?.paymentFlow!=='separate_charges_and_transfers' ||
      intent.metadata?.supplierStripeAccountId!==booking.destination ||
      intent.metadata?.commissionCents!==String(booking.feeCents) ||
      intent.transfer_data!=null || intent.application_fee_amount!=null ||
      intent.on_behalf_of!=null)
    return {blocked:'provider_payment_binding_mismatch'};
  return {ok:true,paymentIntentId:intent.id};
}
