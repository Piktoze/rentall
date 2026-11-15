import {createHash} from 'node:crypto';
// Isolated Stripe TEST Connect onboarding session coordinator.
// NOT imported by the public server. Never call from an unauthenticated route.
// Account-session client_secret is sensitive: return only to the trusted
// internal caller; never persist or log it. This module does not authorize
// payouts or change supplier/account ownership.
import {inspectIsolatedSctRecipientAccount}
  from './isolated-sct-recipient-account-gate.js';

const validSupplier=v=>/^synthetic-supplier-[A-Za-z0-9-]+$/.test(v||'');
const validAccount=v=>/^acct_[A-Za-z0-9]+$/.test(v||'');
const validTestKey=v=>/^sk_test_[A-Za-z0-9_-]{8,}$/.test(v||'');
function authenticatedOwner(db,sessionToken,ownerUserId){
  if(typeof sessionToken!=='string'||sessionToken.length<24||
     typeof ownerUserId!=='string'||!ownerUserId)return false;
  const hash=createHash('sha256').update(sessionToken).digest('hex');
  // Reuse the application's actual session + supplier role storage.
  // Trust neither an ID passed by a requester nor a session cookie without
  // independent DB verification. A legacy unowned SCT row never passes.
  try{
    const session=db.prepare(`SELECT u.user_id,u.role FROM app_sessions s
      JOIN app_users u ON u.user_id=s.user_id
      WHERE s.session_hash=? AND s.expires_at>?`)
      .get(hash,new Date().toISOString());
    return session?.user_id===ownerUserId&&session?.role==='supplier';
  }catch{return false}
}

export async function createIsolatedSctTestOnboardingSession({
  db,stripe,stripeMode,stripeSecretKey,supplierId,entityType,accountId,
  sessionToken,
}={}){
  if(stripeMode!=='test'||!validTestKey(stripeSecretKey)||
     stripe?._apiKey!==stripeSecretKey||
     typeof stripe?.v2?.core?.accounts?.retrieve!=='function'||
     typeof stripe?.accountSessions?.create!=='function')
    return {blocked:'trusted_stripe_test_client_required'};
  if(!db?.prepare||!validSupplier(supplierId)||!validAccount(accountId)||
     !['individual','company'].includes(entityType)||
     typeof sessionToken!=='string')
    return {blocked:'authenticated_synthetic_supplier_required'};
  let row;
  try{
    row=db.prepare(`SELECT supplier_id,legal_entity_type,status,
      stripe_account_id,plan_digest,owner_user_id
      FROM sct_test_recipient_creation_commands WHERE supplier_id=?`).get(supplierId);
  }catch{return {blocked:'recipient_creation_journal_unavailable'}}
  if(row?.legal_entity_type!==entityType||
     row?.status!=='created_pending_onboarding'||
     row?.stripe_account_id!==accountId||
     !/^[a-f0-9]{64}$/.test(row?.plan_digest||''))
    return {blocked:'recipient_account_not_bound_to_supplier'};
  if(!authenticatedOwner(db,sessionToken,row.owner_user_id))
    return {blocked:'verified_supplier_session_required'};
  let account;
  try{
    account=await stripe.v2.core.accounts.retrieve(accountId,{
      include:['configuration.recipient','requirements','defaults'],
    });
  }catch{return {blocked:'recipient_account_readback_unavailable'}}
  // Onboarding may be needed before transfers become active, but identity,
  // TEST mode and liabilities must already match the immutable creation row.
  if(account?.id!==accountId||account?.livemode!==false||
     account?.dashboard!=='express'||
     account?.identity?.country!=='LT'||
     account?.identity?.entity_type!==entityType||
     account?.configuration?.recipient==null||
     account?.configuration?.merchant!=null||
     account?.defaults?.responsibilities?.fees_collector!=='application'||
     account?.defaults?.responsibilities?.losses_collector!=='application'||
     account?.configuration?.recipient?.capabilities
       ?.stripe_balance?.stripe_transfers?.requested!==true)
    return {blocked:'recipient_onboarding_account_mismatch'};
  // A fully active capability is not necessary before opening onboarding.
  // Never infer bank payout readiness from creation or session responses.
  let session;
  try{
    session=await stripe.accountSessions.create({
      account:accountId,
      components:{
        account_onboarding:{enabled:true},
        notification_banner:{enabled:true},
      },
    });
  }catch{return {blocked:'recipient_onboarding_session_unavailable'}}
  if(session?.account!==accountId||
     typeof session?.client_secret!=='string'||
     !session.client_secret.startsWith('acs_'))
    return {blocked:'recipient_onboarding_session_invalid'};
  return {
    status:'test_onboarding_session_created',
    accountId,clientSecret:session.client_secret,
    recipientTransfersReady:false,bankPayoutsReady:false,
  };
}

export async function inspectIsolatedSctTestRecipientAfterOnboarding({
  db,stripe,stripeMode,stripeSecretKey,supplierId,entityType,accountId,sessionToken,
}={}){
  if(stripeMode!=='test'||!validTestKey(stripeSecretKey)||
     stripe?._apiKey!==stripeSecretKey||
     typeof stripe?.v2?.core?.accounts?.retrieve!=='function')
    return {blocked:'trusted_stripe_test_client_required'};
  if(!db?.prepare||!validSupplier(supplierId)||!validAccount(accountId)||
     typeof sessionToken!=='string'||
     !['individual','company'].includes(entityType))
    return {blocked:'synthetic_recipient_identity_required'};
  let row;
  try{
    row=db.prepare(`SELECT status,stripe_account_id,legal_entity_type,plan_digest
      ,owner_user_id FROM sct_test_recipient_creation_commands WHERE supplier_id=?`).get(supplierId);
  }catch{return {blocked:'recipient_creation_journal_unavailable'}}
  if(row?.status!=='created_pending_onboarding'||
     row?.stripe_account_id!==accountId||
     row?.legal_entity_type!==entityType||
     !/^[a-f0-9]{64}$/.test(row?.plan_digest||''))
    return {blocked:'recipient_account_not_bound_to_supplier'};
  if(!authenticatedOwner(db,sessionToken,row.owner_user_id))
    return {blocked:'verified_supplier_session_required'};
  let account;
  try{
    account=await stripe.v2.core.accounts.retrieve(accountId,{
      include:['configuration.recipient','requirements','defaults'],
    });
  }catch{return {blocked:'recipient_account_readback_unavailable'}}
  // This is a capability assessment, not proof that a bank payout is enabled.
  return inspectIsolatedSctRecipientAccount(account,{
    expectedAccountId:accountId,expectedCountry:'LT',expectedEntityType:entityType,
  });
}
