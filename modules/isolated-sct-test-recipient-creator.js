import {isIsolatedStripeTestClient} from './isolated-stripe-test-client.js';
// One-shot synthetic Accounts v2 recipient creator. NOT imported by server,
// never enabled via HTTP, scheduler or production. Caller supplies an authenticated
// platform TEST SDK client; this module never reads real supplier records.
import {planIsolatedSctRecipientOnboarding} from './isolated-sct-recipient-onboarding-plan.js';
import {
  reserveIsolatedSctRecipientCreation,markIsolatedSctRecipientCreationUncertain,
  recordIsolatedSctRecipientCreated,syntheticRecipientPlanDigest,
} from './isolated-sct-recipient-creation-journal.js';

const accountId=v=>typeof v==='string'&&/^acct_[A-Za-z0-9]+$/.test(v);
function validateCreatedAccount(account,entityType,id){
  return account?.id===id&&account?.livemode===false&&
    account?.dashboard==='express'&&
    account?.identity?.country==='LT'&&
    account?.identity?.entity_type===entityType&&
    account?.configuration?.recipient!=null&&
    account?.configuration?.merchant==null&&
    account?.defaults?.responsibilities?.fees_collector==='application'&&
    account?.defaults?.responsibilities?.losses_collector==='application'&&
    account?.configuration?.recipient?.capabilities?.stripe_balance
      ?.stripe_transfers?.requested===true;
}
export async function createIsolatedSctTestRecipient({
  db,stripe,stripeMode,stripeSecretKey,supplierId,
  country,entityType,contactEmail,displayName,
  termsAccepted,platformLiabilityApproved,
}={}){
  const plan=planIsolatedSctRecipientOnboarding({
    stripeMode,country,entityType,contactEmail,displayName,
    termsAccepted,platformLiabilityApproved,
  });
  if(plan.blocked)return plan;
  if(!/^synthetic-supplier-[A-Za-z0-9-]+$/.test(supplierId||''))
    return {blocked:'synthetic_supplier_required'};
  if(!/^sk_test_[A-Za-z0-9_-]{8,}$/.test(stripeSecretKey||'')||
     !isIsolatedStripeTestClient(stripe,stripeSecretKey)||
     typeof stripe?.v2?.core?.accounts?.create!=='function'||
     typeof stripe?.v2?.core?.accounts?.retrieve!=='function')
    return {blocked:'verifiable_test_accounts_v2_client_required'};
  const planDigest=syntheticRecipientPlanDigest(plan.accountCreatePayload);
  if(!planDigest)return {blocked:'invalid_recipient_plan_digest'};
  const claim=reserveIsolatedSctRecipientCreation(db,{supplierId,entityType,planDigest});
  if(claim.blocked)return claim;
  // Persist external-call uncertainty BEFORE invoking Stripe.
  if(!markIsolatedSctRecipientCreationUncertain(db,supplierId))
    return {blocked:'unable_to_record_account_creation_uncertainty'};
  let result;
  try{
    result=await stripe.v2.core.accounts.create(plan.accountCreatePayload,{
      idempotencyKey:claim.idempotencyKey,
    });
  }catch{return {blocked:'account_creation_requires_reconciliation'}}
  if(!accountId(result?.id))
    return {blocked:'account_creation_requires_reconciliation'};
  let authoritative;
  try{
    authoritative=await stripe.v2.core.accounts.retrieve(result.id,{
      include:['identity','configuration.recipient','configuration.merchant','requirements','defaults'],
    });
  }catch{return {blocked:'account_creation_requires_reconciliation'}}
  if(!validateCreatedAccount(authoritative,entityType,result.id))
    return {blocked:'account_creation_provider_identity_requires_review'};
  return recordIsolatedSctRecipientCreated(db,{
    supplierId,entityType,accountId:result.id,
  });
}
