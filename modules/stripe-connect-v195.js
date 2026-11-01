export const STRIPE_CONNECT_MODEL_V195=Object.freeze({
  accountsApi:'v2',
  dashboard:'express',
  feesCollector:'stripe',
  lossesCollector:'stripe',
  chargePattern:'direct',
  onboarding:'embedded',
  radarForPlatforms:true,
  publicPreview:true
});

export function requireConnectPreviewApiVersion(env=process.env){
  const version=String(env.STRIPE_CONNECT_PREVIEW_API_VERSION||'').trim();
  if(!version) throw new Error('STRIPE_CONNECT_PREVIEW_API_VERSION is required for Express + Stripe-managed negative balance liability');
  if(!/preview/i.test(version)) throw new Error('STRIPE_CONNECT_PREVIEW_API_VERSION must be a Stripe Connect preview API version');
  return version;
}

export function normalizeEntityType(value){
  const v=String(value||'').trim().toLowerCase();
  if(v==='individual'||v==='company') return v;
  throw new Error('legalEntityType must be individual or company');
}

export function normalizeCountry(value){
  const v=String(value||'').trim().toUpperCase();
  if(!/^[A-Z]{2}$/.test(v)) throw new Error('country must be a 2-letter ISO country code');
  return v;
}

export function directMerchantCapabilityStatus(account){
  const cap=account?.configuration?.merchant?.capabilities?.card_payments;
  const status=String(cap?.status||'unknown');
  const requirements=Array.isArray(account?.requirements?.entries)
    ? account.requirements.entries
    : Array.isArray(cap?.requirements)?cap.requirements:[];
  return Object.freeze({
    accountId:account?.id||null,
    state:status==='active'?'active':(status==='pending'?'pending':'needs_information'),
    connectApi:'v2_merchant_direct',
    merchantCapabilityStatus:status,
    dashboard:String(account?.dashboard||'express'),
    feesCollector:String(account?.defaults?.responsibilities?.fees_collector||'stripe'),
    lossesCollector:String(account?.defaults?.responsibilities?.losses_collector||'stripe'),
    requirements
  });
}

export async function createDirectMerchantAccountV2(stripe,{
  email,
  displayName,
  country,
  legalEntityType,
  currency='eur',
  env=process.env
}={}){
  if(!stripe?.v2?.core?.accounts?.create) throw new Error('Installed Stripe SDK does not expose stripe.v2.core.accounts.create; install a Stripe SDK version that supports Accounts v2 preview');
  const apiVersion=requireConnectPreviewApiVersion(env);
  const account=await stripe.v2.core.accounts.create({
    contact_email:String(email||'').trim().toLowerCase(),
    display_name:String(displayName||email||'RentInOrbit supplier').trim(),
    dashboard:'express',
    identity:{
      country:normalizeCountry(country),
      entity_type:normalizeEntityType(legalEntityType)
    },
    configuration:{
      merchant:{
        capabilities:{
          card_payments:{requested:true}
        }
      }
    },
    defaults:{
      currency:String(currency||'eur').toLowerCase(),
      responsibilities:{
        fees_collector:'stripe',
        losses_collector:'stripe'
      }
    }
  },{apiVersion});
  return account;
}

export async function retrieveDirectMerchantAccountV2(stripe,accountId,{env=process.env}={}){
  if(!stripe?.v2?.core?.accounts?.retrieve) throw new Error('Installed Stripe SDK does not expose stripe.v2.core.accounts.retrieve');
  const apiVersion=requireConnectPreviewApiVersion(env);
  return stripe.v2.core.accounts.retrieve(String(accountId),{
    include:['requirements','configuration.merchant','defaults']
  },{apiVersion});
}

export async function createEmbeddedOnboardingSession(stripe,accountId){
  if(!stripe?.accountSessions?.create) throw new Error('Stripe Account Sessions API is unavailable');
  return stripe.accountSessions.create({
    account:String(accountId),
    components:{
      account_onboarding:{enabled:true},
      notification_banner:{enabled:true},
      account_management:{enabled:true}
    }
  });
}

export async function createExpressLoginLink(stripe,accountId){
  if(!stripe?.accounts?.createLoginLink) throw new Error('Stripe Express login-link API is unavailable');
  return stripe.accounts.createLoginLink(String(accountId));
}

export function connectedRequestOptions(accountId,extra={}){
  const id=String(accountId||'').trim();
  if(!id) throw new Error('Connected account ID is required');
  return {...extra,stripeAccount:id};
}

export async function createDirectChargePaymentIntent(stripe,{
  accountId,
  amountCents,
  applicationFeeCents,
  currency='eur',
  metadata={},
  idempotencyKey
}={}){
  const amount=Number(amountCents);
  const fee=Number(applicationFeeCents);
  if(!Number.isInteger(amount)||amount<=0) throw new Error('amountCents must be a positive integer');
  if(!Number.isInteger(fee)||fee<0||fee>amount) throw new Error('applicationFeeCents must be an integer between 0 and amountCents');
  return stripe.paymentIntents.create({
    amount,
    currency:String(currency||'eur').toLowerCase(),
    automatic_payment_methods:{enabled:true},
    application_fee_amount:fee,
    metadata
  },connectedRequestOptions(accountId,{idempotencyKey}));
}

export async function retrieveDirectChargePaymentIntent(stripe,{accountId,paymentIntentId}={}){
  return stripe.paymentIntents.retrieve(
    String(paymentIntentId),
    {},
    connectedRequestOptions(accountId)
  );
}

export async function cancelDirectChargePaymentIntent(stripe,{accountId,paymentIntentId,idempotencyKey}={}){
  return stripe.paymentIntents.cancel(
    String(paymentIntentId),
    {},
    connectedRequestOptions(accountId,{idempotencyKey})
  );
}

export async function refundDirectCharge(stripe,{
  accountId,
  paymentIntentId,
  amountCents,
  bookingId,
  idempotencyKey,
  reason='requested_by_customer',
  metadataReason=null
}={}){
  const amount=Number(amountCents);
  if(!Number.isInteger(amount)||amount<=0) throw new Error('amountCents must be a positive integer');
  return stripe.refunds.create({
    payment_intent:String(paymentIntentId),
    amount,
    refund_application_fee:true,
    reason,
    metadata:{
      bookingId:String(bookingId||''),
      ...(metadataReason?{reason:String(metadataReason)}:{})
    }
  },connectedRequestOptions(accountId,{idempotencyKey}));
}

export async function createDirectSecurityDepositIntent(stripe,{
  accountId,
  amountCents,
  bookingId,
  listingId,
  idempotencyKey
}={}){
  const amount=Number(amountCents);
  if(!Number.isInteger(amount)||amount<=0) throw new Error('amountCents must be a positive integer');
  return stripe.paymentIntents.create({
    amount,
    currency:'eur',
    capture_method:'manual',
    automatic_payment_methods:{enabled:true},
    metadata:{
      bookingId:String(bookingId),
      listingId:String(listingId),
      purpose:'security_deposit'
    }
  },connectedRequestOptions(accountId,{idempotencyKey}));
}

export async function captureDirectSecurityDeposit(stripe,{
  accountId,
  paymentIntentId,
  amountCents,
  idempotencyKey
}={}){
  return stripe.paymentIntents.capture(
    String(paymentIntentId),
    {amount_to_capture:Number(amountCents)},
    connectedRequestOptions(accountId,{idempotencyKey})
  );
}
