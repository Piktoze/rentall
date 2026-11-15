// Pure Accounts v2 recipient onboarding plan for Lithuania-only SCT rentals.
// It does not create an account, call Stripe, change onboarding state or
// authorize transfers. Caller must obtain supplier consent and verified
// operator/Stripe terms before invoking any future TEST-only account creator.
export function planIsolatedSctRecipientOnboarding({
  stripeMode,country,entityType,contactEmail,displayName,
  termsAccepted,platformLiabilityApproved,
}={}){
  if(stripeMode!=='test')return {blocked:'test_only'};
  if(country!=='LT'||!['individual','company'].includes(entityType))
    return {blocked:'lithuanian_recipient_type_required'};
  if(typeof contactEmail!=='string'||contactEmail.length>254||
     !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(contactEmail))
    return {blocked:'validated_recipient_email_required'};
  if(typeof displayName!=='string'||!displayName.trim()||
     displayName.length>120||/[\r\n<>]/.test(displayName))
    return {blocked:'validated_supplier_display_name_required'};
  if(termsAccepted!==true||platformLiabilityApproved!==true)
    return {blocked:'onboarding_consent_and_liability_approval_required'};
  return Object.freeze({
    stripeMode:'test',
    operation:'accounts_v2_recipient_plan_only',
    accountCreatePayload:{
      contact_email:contactEmail.toLowerCase(),
      display_name:displayName.trim(),
      dashboard:'express',
      identity:{country:'LT',entity_type:entityType},
      configuration:{recipient:{capabilities:{
        stripe_balance:{stripe_transfers:{requested:true}},
      }}},
      defaults:{currency:'eur',responsibilities:{
        fees_collector:'application',losses_collector:'application',
      }},
      include:['configuration.recipient','requirements','defaults'],
    },
    networkCallAuthorized:false,
    stripeAccountCreated:false,
    bankPayoutReady:false,
  });
}
