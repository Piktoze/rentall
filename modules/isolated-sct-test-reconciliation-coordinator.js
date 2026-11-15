// Isolated internal TEST-only SCT reconciliation coordinator.
// Not imported by public server routes, not a scheduled worker, and never
// creates PaymentIntents, refunds, transfers, payouts, or invoices.
import {getSctBookingBinding} from './sct-booking-binding.js';
import {reconcileIsolatedSctTestPayment} from './isolated-sct-test-payment-reconciler.js';
import {applyVerifiedSctTestPayment} from './sct-test-payment-settlement.js';

export async function reconcileAndSettleIsolatedSctTestPayment({
  db,stripe,stripeMode,bookingId,eventId,
}={}){
  if(stripeMode!=='test')return {blocked:'test_only'};
  if(!/^RB-[A-Za-z0-9-]+$/.test(bookingId||'')||
     !/^evt_[A-Za-z0-9]+$/.test(eventId||''))
    return {blocked:'invalid_reconciliation_request'};
  if(!db?.prepare || !db?.transaction)
    return {blocked:'database_required'};

  // Read the immutable booking/payment association directly from DB.
  const binding=getSctBookingBinding(db,bookingId);
  if(!binding?.paymentIntentId||binding.livemode!==false)
    return {blocked:'immutable_test_payment_binding_missing'};

  const booking=db.prepare(`SELECT booking_id, listing_id, status, payment_status,
    stripe_payment_intent_id, stripe_refund_id, refund_status, order_value
    FROM rental_bookings WHERE booking_id=?`).get(bookingId);
  const inbox=db.prepare(`SELECT booking_id,payment_intent_id,amount_cents,status
    FROM sct_payment_reconciliation_inbox WHERE event_id=?`).get(eventId);
  if(!booking||!inbox||booking.booking_id!==bookingId||
     booking.listing_id!==binding.listingId||
     booking.status!=='confirmed' ||
     !['unpaid','requires_payment_method','processing'].includes(booking.payment_status)||
     booking.stripe_payment_intent_id!==binding.paymentIntentId||
     booking.stripe_refund_id||
     (booking.refund_status&&!['none','not_required'].includes(booking.refund_status))||
     Math.round(Number(booking.order_value||0)*100)!==binding.amountCents||
     inbox.booking_id!==bookingId||inbox.payment_intent_id!==binding.paymentIntentId||
     inbox.amount_cents!==binding.amountCents||
     inbox.status!=='reconciliation_required')
    return {blocked:'booking_not_ready_for_test_reconciliation'};

  // The Stripe call is read-only and always scoped to the PLATFORM TEST key.
  // No caller-provided reconciliation object is trusted.
  const verification=await reconcileIsolatedSctTestPayment({
    stripe,stripeMode,binding,
  });
  if(verification.blocked)return verification;

  // The settlement function re-reads booking, binding, inbox and disputes in
  // one SQLite IMMEDIATE transaction to guard changes while Stripe was read.
  return applyVerifiedSctTestPayment(db,{bookingId,eventId,verification});
}
