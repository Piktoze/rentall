// Isolated TEST-only prototype. Not wired into server routes or scheduled workers.
// LIVE is prohibited. No Stripe key or direct Stripe client is imported here.
import { planDeferredSupplierTransfer } from './deferred-supplier-transfer.js';
import {
  reserveSupplierTransferCommand,
  markSupplierTransferReconciliationRequired,
  recordReconciledSupplierTransfer,
} from './supplier-transfer-command-journal.js';

export async function executeIsolatedTestSupplierTransfer({
  db, booking, payment, nowMs, createTransfer, retrieveTransfer,
} = {}) {
  // Never infer test mode from credentials; require both authoritative snapshots to be TEST.
  if (booking?.livemode !== false || payment?.livemode !== false)
    return { blocked: 'test_only' };
  if (typeof createTransfer !== 'function' || typeof retrieveTransfer !== 'function')
    return { blocked: 'provider_callbacks_required' };

  const plan = planDeferredSupplierTransfer(booking, payment, nowMs);
  if (plan.blocked) return plan;
  const command = reserveSupplierTransferCommand(db, plan);
  if (command.blocked) return command;
  if (command.alreadyExists) {
    // Never replay a network call for an existing command, even with an idempotency key.
    return { blocked: 'existing_command_requires_reconciliation', status: command.status };
  }

  // Write uncertainty BEFORE the external request: a crash or timeout cannot create
  // a second locally-authorized attempt. A separate reconciler must query Stripe.
  if (!markSupplierTransferReconciliationRequired(db, booking.id))
    return { blocked: 'unable_to_mark_reconciliation' };
  let transfer;
  try {
    transfer = await createTransfer(plan.transfer, { idempotencyKey: plan.idempotencyKey });
  } catch {
    // Deliberately leave reconcile_required. Never retry without checking Stripe.
    return { blocked: 'provider_result_unknown_reconcile_required' };
  }

  if (!/^tr_[A-Za-z0-9]+$/.test(transfer?.id || ''))
    return { blocked: 'provider_result_unknown_reconcile_required' };

  let verified;
  try { verified = await retrieveTransfer(transfer.id); } catch {
    return { blocked: 'provider_result_unknown_reconcile_required' };
  }
  const requested = plan.transfer;
  if (verified?.id !== transfer.id || verified?.livemode !== false ||
      verified?.amount !== requested.amount || verified?.currency !== requested.currency ||
      verified?.destination !== requested.destination ||
      verified?.source_transaction !== requested.source_transaction ||
      verified?.transfer_group !== requested.transfer_group ||
      verified?.metadata?.bookingId !== booking.id ||
      verified?.metadata?.paymentIntentId !== booking.paymentIntentId) {
    return { blocked: 'stripe_transfer_verification_failed' };
  }

  const saved = recordReconciledSupplierTransfer(db, booking.id, verified.id);
  return saved.blocked ? saved : { status: 'transferred', transferId: verified.id };
}
