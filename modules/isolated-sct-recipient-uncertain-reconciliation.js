// Read-only examination of an uncertain synthetic TEST recipient creation.
// Matching fields do NOT prove the account belongs to the original request:
// Stripe request logs / idempotency evidence must be reviewed independently.
// Does not create, update, reconnect or activate Stripe accounts.
import {planIsolatedSctRecipientOnboarding} from './isolated-sct-recipient-onboarding-plan.js';
import {syntheticRecipientPlanDigest} from './isolated-sct-recipient-creation-journal.js';

export async function inspectUncertainIsolatedSctRecipientCreation({
  db,stripe,stripeMode,stripeSecretKey,supplierId,
  country,entityType,contactEmail,displayName,
  termsAccepted,platformLiabilityApproved,candidateAccountId,
}={}){
  const plan=planIsolatedSctRecipientOnboarding({
    stripeMode,country,entityType,contactEmail,displayName,
    termsAccepted,platformLiabilityApproved,
  });
  if(plan.blocked)return plan;
  if(!/^synthetic-supplier-[A-Za-z0-9-]+$/.test(supplierId||'')||
     !/^acct_[A-Za-z0-9]+$/.test(candidateAccountId||'')||
     !db?.prepare)return {blocked:'synthetic_creation_reference_required'};
  if(!/^sk_test_[A-Za-z0-9_-]{8,}$/.test(stripeSecretKey||'')||
     stripe?._apiKey!==stripeSecretKey||
     typeof stripe?.v2?.core?.accounts?.retrieve!=='function')
    return {blocked:'verifiable_test_accounts_v2_client_required'};
  const command=db.prepare(`SELECT status,legal_entity_type,idempotency_key,
    plan_digest,stripe_account_id FROM sct_test_recipient_creation_commands
    WHERE supplier_id=?`).get(supplierId);
  const expectedDigest=syntheticRecipientPlanDigest(plan.accountCreatePayload);
  if(!command||command.status!=='reconcile_required'||
     command.legal_entity_type!==entityType||
     command.stripe_account_id!=null||
     !/^[a-f0-9]{64}$/.test(command.plan_digest||'')||
     command.plan_digest!==expectedDigest||
     command.idempotency_key!==`sct-test-recipient:${supplierId}:v1`)
    return {blocked:'original_creation_proof_unavailable'};
  let account;
  try{
    account=await stripe.v2.core.accounts.retrieve(candidateAccountId,{
      include:['configuration.recipient','requirements','defaults'],
    });
  }catch{return {blocked:'account_readback_unavailable'}}
  const p=plan.accountCreatePayload;
  if(account?.id!==candidateAccountId||account?.livemode!==false||
     account?.contact_email!==p.contact_email||
     account?.display_name!==p.display_name||
     account?.identity?.country!=='LT'||
     account?.identity?.entity_type!==entityType||
     account?.dashboard!=='express'||
     account?.configuration?.recipient==null||
     account?.configuration?.merchant!=null||
     account?.defaults?.responsibilities?.fees_collector!=='application'||
     account?.defaults?.responsibilities?.losses_collector!=='application'||
     account?.configuration?.recipient?.capabilities?.stripe_balance
       ?.stripe_transfers?.requested!==true)
    return {blocked:'candidate_account_does_not_match_original_request'};
  return {
    status:'manual_stripe_request_evidence_required',
    supplierId,candidateAccountId,
    idempotencyKey:command.idempotency_key,
    candidateMatchesRequestFields:true,
    automaticAccountAssignment:false,
    recipientTransfersReady:false,
    bankPayoutsReady:false,
  };
}
