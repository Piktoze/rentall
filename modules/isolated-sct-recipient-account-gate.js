// Isolated Accounts v2 recipient suitability gate for the future SCT flow.
// Read-only: never creates an account, grants access, releases money or checks
// bank payout readiness. Never import into legacy direct-charge checkout.
const id=v=>typeof v==='string'&&/^acct_[A-Za-z0-9]+$/.test(v);
const blocked=reason=>Object.freeze({blocked:reason});

export function inspectIsolatedSctRecipientAccount(account,{
  expectedAccountId,
  expectedCountry='LT',
  expectedEntityType,
}={}){
  if(!id(expectedAccountId)||!id(account?.id)||account.id!==expectedAccountId)
    return blocked('connected_account_identity_mismatch');
  if(!['individual','company'].includes(expectedEntityType))
    return blocked('verified_supplier_entity_type_required');
  const country=account?.identity?.country;
  const entityType=account?.identity?.entity_type;
  if(country!==expectedCountry||expectedCountry!=='LT'||
     entityType!==expectedEntityType)
    return blocked('recipient_country_or_entity_mismatch');
  // SCT is the PLATFORM's charge. A merchant card_payments capability on
  // the supplier is not sufficient. Supplier must be a recipient with transfers.
  if(account?.configuration?.recipient==null ||
     account?.configuration?.merchant!=null)
    return blocked('recipient_only_account_required');
  const responsibilities=account?.defaults?.responsibilities;
  if(account.dashboard!=='express'||
     responsibilities?.fees_collector!=='application'||
     responsibilities?.losses_collector!=='application')
    return blocked('sct_dashboard_or_liability_mismatch');
  const capability=account.configuration.recipient.capabilities
    ?.stripe_balance?.stripe_transfers;
  if(capability?.status!=='active')
    return blocked('recipient_stripe_transfers_not_active');
  const requirements=account?.requirements;
  // Accounts v2 requirements can remain pending after onboarding and
  // change over time. Treat any unknown/restricted state as non-clear.
  if(!requirements || requirements?.disabled_reason ||
     (Array.isArray(requirements?.currently_due)&&requirements.currently_due.length>0)||
     (Array.isArray(requirements?.past_due)&&requirements.past_due.length>0))
    return blocked('recipient_requirements_unresolved');
  return Object.freeze({
    status:'test_recipient_transfer_capability_verified',
    accountId:account.id,country,entityType,
    transferCapability:'active',
    bankPayoutReadiness:'not_verified',
    accountOwnership:'not_verified',
    testTransferExecuted:false,
  });
}
