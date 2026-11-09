import express from 'express';
import Stripe from 'stripe';
import crypto from 'crypto';
import {
  beginWebhookEvent,
  markWebhookProcessed,
  markWebhookFailed,
  listWebhookEvents,
  insertSimulatedWebhook,
  upsertRentalListing,
  getAvailability,
  createRentalBookingAtomic,
  updateRentalBookingStatus,
  getAvailabilityCalendar,
  listRentalBookings,
  cancelRentalBookingWithRefund,
  markRentalReturned,
  resolveRentalSecurityDeposit,
  setRentalSecurityDepositProviderState,
  createRentalReview,
  listRentalReviews,
  createRentalDispute,
  listRentalDisputes,
  resolveRentalDispute,
  setListingModerationStatus,
  getAdminDashboardData,
  listCustomerRentalBookings,
  createAppUser,
  enableSupplierForUser,
  authenticateAppUser,
  createAppSession,
  getAppUserBySessionToken,
  deleteAppSession,
  seedDefaultUsers,
  saveFullRentalListing,
  listPublicRentalListings,
  listOwnerRentalListings,
  archiveOwnerRentalListing,
  deleteOwnerRentalListing,
  saveStripeConnection,
  updateStripeConnectionCapability,
  getStripeConnectionByUserId,
  getStripeConnectionByEmail,
  verifyBookingPaymentToken,
  revokeBookingGuestAccess,
  setBookingPaymentDetails,
  setBookingPayoutDetails,
  getRentalBookingById,
  getRentalListing,
  getFullRentalListing,
  getCustomerBookingByAccessToken,
  expireStalePendingBookings,
  setStripeRefundDetails,
  calculateRefundAmount,
  setRentalBookingStatusAfterRefund,
  claimWebhookRetry,
  db,
  createRentalNotification,
  listSupplierNotifications,
  listCustomerNotifications,
  markCustomerNotificationRead,
  listBookingNotifications,
  markSupplierNotificationRead,
  saveRentalSearch,
  listSavedSearches,
  deleteRentalSavedSearch,
  enqueueTransactionalEmail,
  listEmailOutbox,
  claimTransactionalEmails,
  completeTransactionalEmail,
  failTransactionalEmail,
  recoverInterruptedTransactionalEmails,
  beginBookingIdempotency,
  completeBookingIdempotency,
  releaseBookingIdempotency,
  createRentalAgreement,
  getRentalAgreement,
  getRentalAgreementAcceptanceAudit,
  rentalTransferStatus,
  issueRentalTransferCode,
  verifyAndConsumeRentalTransferCode,
  rentalIdentityVerificationStatus,
  acceptRentalAgreement,
  createOrGetRentalConversation,
  getRentalConversation,
  listRentalConversationsForUser,
  listRentalMessages,
  addRentalMessage,
  createRenterReview,
  getRenterReputation,
  getSupplierReputation,
  upsertPrelaunchSupplier,
  ensureSupplierOnboarding,
  listSupplierOnboarding,
  createSupplierActivationInvite,
  activateSupplierInvite,
  confirmSupplierListings,
  markStaleSupplierListings,
  listSuppliersNeedingFreshnessReminder,
  markSupplierFreshnessReminder,
  listSupplierResponseMaintenance,
  setSupplierReminderStage,
  markSupplierResponded,
  markSupplierAutoDeclined,
  recordSupplierMissedResponse,
  resetSupplierMissedResponses
  ,databaseRuntime
  ,checkDatabase
  ,closeDatabase
  ,REQUIRED_SCHEMA_VERSION
} from './db.js';
import {assertProductionConfig,productionConfigReport,productionStorageReport,runtimeConfig} from './config.js';
import {HELP_CENTER_COPY,getPolicyPage} from './modules/help-center-content-v177.js';
import {supplierResponseSchedule,supplierTimezoneForListing} from './modules/supplier-response-clock-v187.js';
import {resolveRentalStart} from './modules/cancellation-policy-v197.js';
import {DEFAULT_COMMISSION_BPS} from './modules/pricing-v194.js';
import {
  calculateBookingPricingForSupplier,
  getBookingPricingSnapshot,
  saveBookingPricingSnapshot
} from './modules/pricing-store-v194.js';
import {
  createDirectMerchantAccountV2,
  retrieveDirectMerchantAccountV2,
  directMerchantCapabilityStatus,
  createEmbeddedOnboardingSession,
  createHostedOnboardingLink,
  createExpressLoginLink,
  createDirectChargePaymentIntent,
  retrieveDirectChargePaymentIntent,
  captureDirectChargePaymentIntent,
  cancelDirectChargePaymentIntent,
  refundDirectCharge,
  createDirectSecurityDepositIntent,
  captureDirectSecurityDeposit
} from './modules/stripe-connect-v195.js';
import {
  saveDirectMerchantMetadata,
  getDirectMerchantConnectionByUserId,
  getDirectMerchantConnectionByEmail,
  directMerchantReady
} from './modules/stripe-connect-store-v195.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

assertProductionConfig();

const app = express();

function safeOperationalError(error){
  let message=String(error?.message||error||'Operational error');
  for(const name of ['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','RESEND_API_KEY','SESSION_SECRET','EMAIL_WORKER_TOKEN']){
    const secret=String(process.env[name]||'');
    if(secret.length>=8)message=message.split(secret).join('[redacted]');
  }
  message=message.replace(/(?:[sr]k_(?:live|test)|whsec_|re_)[A-Za-z0-9_\-]{8,}/g,'[redacted]');
  return {name:String(error?.name||'Error'),code:String(error?.code||'UNKNOWN'),message:message.slice(0,300)};
}

const trustProxyHops=Number(process.env.TRUST_PROXY_HOPS||0);
if(Number.isInteger(trustProxyHops) && trustProxyHops>0){
  app.set('trust proxy',trustProxyHops);
}


// ---- V36 security hardening ----
app.disable('x-powered-by');

app.use((req,res,next)=>{
  const incoming=String(req.get('x-request-id')||'').replace(/[^a-zA-Z0-9._:-]/g,'').slice(0,80);
  req.requestId=incoming || `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;
  res.setHeader('X-Request-Id',req.requestId);
  const started=Date.now();
  res.on('finish',()=>console.log(JSON.stringify({type:'http',requestId:req.requestId,method:req.method,path:req.path,status:res.statusCode,durationMs:Date.now()-started})));
  next();
});

app.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(self)');
  res.setHeader('X-Frame-Options','SAMEORIGIN');
  if(process.env.NODE_ENV==='production') res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' https://js.stripe.com https://connect-js.stripe.com https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://unpkg.com",
      "img-src 'self' data: blob: https://*.stripe.com https://tile.openstreetmap.org",
      "font-src 'self' data:",
      "connect-src 'self' https://api.stripe.com https://connect-js.stripe.com https://*.stripe.com https://tile.openstreetmap.org",
      "frame-src https://js.stripe.com https://connect-js.stripe.com https://hooks.stripe.com",
      "object-src 'none'",
      "worker-src 'self'",
      "manifest-src 'self'",
      "base-uri 'self'",
      "form-action 'self' https://hooks.stripe.com"
    ].join('; ')
  );
  next();
});

const rateBuckets=new Map();
function simpleRateLimit({windowMs=60000,max=60,keyPrefix='global'}={}){
  return (req,res,next)=>{
    const now=Date.now();
    const ip=req.ip || req.socket?.remoteAddress || 'unknown';
    const key=`${keyPrefix}:${ip}`;
    let bucket=rateBuckets.get(key);
    if(!bucket || bucket.resetAt<=now){
      bucket={count:0,resetAt:now+windowMs};
      rateBuckets.set(key,bucket);
    }
    bucket.count++;
    if(bucket.count>max){
      res.setHeader('Retry-After',String(Math.max(1,Math.ceil((bucket.resetAt-now)/1000))));
      return res.status(429).json({error:'Too many requests. Try again later.'});
    }
    next();
  };
}

function sameOriginWriteGuard(req,res,next){
  if(!['POST','PUT','PATCH','DELETE'].includes(req.method)) return next();
  if(req.path==='/api/stripe/webhook') return next();

  const origin=req.headers.origin;
  if(!origin) return next(); // native clients / same-origin non-browser tools
  try{
    const expected=new URL(appUrl).origin;
    if(new URL(origin).origin!==expected){
      return res.status(403).json({error:'Invalid request origin'});
    }
  }catch{
    return res.status(403).json({error:'Invalid request origin'});
  }
  next();
}

app.use('/api',sameOriginWriteGuard);

app.use('/api',(req,res,next)=>{
  if(req.path.startsWith('/auth/') || req.path.startsWith('/customer/') || req.path.startsWith('/supplier/') || req.path.startsWith('/admin/') || req.path.startsWith('/payments/') || req.path.startsWith('/stripe/')){
    res.setHeader('Cache-Control','no-store, private');
    res.setHeader('Pragma','no-cache');
  }
  next();
});


const port = runtimeConfig.port;
const appUrl = runtimeConfig.appUrl;
const stripeKey = process.env.STRIPE_SECRET_KEY || '';
const stripe = stripeKey ? new Stripe(stripeKey,{apiVersion:'2026-08-26.dahlia',appInfo:{name:'RentInOrbit',version:runtimeConfig.appVersion}}) : null;
const demoPaymentsEnabled=String(process.env.RENTINORBIT_DEMO_PAYMENTS ?? (process.env.RENTINORBIT_STAGING==='true'?'true':'false')).trim()==='true' && process.env.RENTINORBIT_STAGING==='true';
const paymentProvider=demoPaymentsEnabled?'demo':(stripe?'stripe':'none');
// Authorization/capture experiment is isolated to staging and a Stripe TEST secret.
// Product rule: supplier confirms the request BEFORE any payment/authorization.
// Keep the legacy preauth branch inert during migration; no environment flag can enable it.
const rentalPreauthEnabled=false;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



seedDefaultUsers();

function parseCookies(req){
  const out={};
  const raw=req.headers.cookie||'';
  for(const pair of raw.split(';')){
    const idx=pair.indexOf('=');
    if(idx<0) continue;
    const key=pair.slice(0,idx).trim();
    const val=pair.slice(idx+1).trim();
    if(key) out[key]=decodeURIComponent(val);
  }
  return out;
}

const legacySessionCookie=['rent','all_','session'].join('');
function sessionUser(req){
  const cookies=parseCookies(req);
  return getAppUserBySessionToken(cookies.rentinorbit_session||cookies[legacySessionCookie]);
}

function requireAuth(req,res,next){
  const user=sessionUser(req);
  if(!user) return res.status(401).json({error:'Authentication required'});
  req.appUser=user;
  next();
}

function requireRole(...roles){
  return (req,res,next)=>{
    const user=sessionUser(req);
    if(!user) return res.status(401).json({error:'Authentication required'});
    if(!roles.includes(user.role)) return res.status(403).json({error:'Forbidden'});
    req.appUser=user;
    next();
  };
}


function canSupplierManageBooking(user, bookingId){
  if(!user) return false;
  if(user.role==='admin') return true;
  if(user.role!=='supplier') return false;
  const booking=getRentalBookingById(bookingId);
  if(!booking) return false;
  const listing=getRentalListing(booking.listingId);
  return !!listing && String(listing.ownerEmail||'').toLowerCase()===String(user.email||'').toLowerCase();
}


async function handleStripeCancellationForBooking(booking, refundAmount){
  if(booking?.paymentProvider==='demo' || String(booking?.stripePaymentIntentId||'').startsWith('demo_pi_')){
    const safeRefund=Math.min(Math.max(0,Number(refundAmount||0)),Math.max(0,Number(booking.orderValue||0)));
    if(safeRefund>0 && ['paid','partially_refunded'].includes(String(booking.paymentStatus||''))){
      setStripeRefundDetails(booking.bookingId,{refundId:`demo_re_${crypto.randomUUID()}`,refundStatus:'succeeded',refundAmount:safeRefund});
    }
    if(booking.securityDepositStatus==='authorized'){
      setRentalSecurityDepositProviderState(booking.bookingId,{paymentIntentId:booking.securityDepositPaymentIntentId||`demo_dep_${crypto.randomUUID()}`,providerStatus:'canceled',depositStatus:'released'});
      try{resolveRentalSecurityDeposit(booking.bookingId,{status:'released',resolution:'Demo deposit authorization released after cancellation.'})}catch{}
    }
    setBookingPayoutDetails(booking.bookingId,{status:'cancelled',amount:0,reference:`demo_po_${booking.bookingId}`});
    return {id:`demo_re_${booking.bookingId}`,status:'succeeded',amount:Math.round(safeRefund*100)};
  }
  // An unpaid booking without provider objects has nothing to cancel or refund.
  // Do not require Stripe Connect merely to release its inventory.
  const hasStripePayment=!!booking?.stripePaymentIntentId;
  const hasStripeDeposit=!!booking?.securityDepositPaymentIntentId;
  if(!hasStripePayment && !hasStripeDeposit) return null;
  if(!stripe) return null;
  const listing=getRentalListing(booking?.listingId);
  const connection=getDirectMerchantConnectionByEmail(db,listing?.ownerEmail);
  if(!connection?.stripeAccountId) throw new Error('Supplier Stripe account not found for booking');
  if(String(connection.connectApi||'')!=='v2_merchant_direct') throw new Error('Supplier Stripe account is not configured for Direct Charges');

  let refund=null;
  if(booking?.stripePaymentIntentId){
    const intent=await retrieveDirectChargePaymentIntent(stripe,{accountId:connection.stripeAccountId,paymentIntentId:booking.stripePaymentIntentId});
    if(intent.status==='succeeded'){
      if(!booking.stripeRefundId){
        const alreadyRefunded=Math.max(0,Number(booking.refundAmount||0));
        const orderValue=Math.max(0,Number(booking.orderValue||0));
        const remaining=Math.max(0,orderValue-alreadyRefunded);
        const requested=Math.max(0,Number(refundAmount||0));
        const cents=Math.round(Math.min(requested,remaining)*100);
        if(cents>0){
          refund=await refundDirectCharge(stripe,{accountId:connection.stripeAccountId,paymentIntentId:intent.id,amountCents:cents,bookingId:booking.bookingId,idempotencyKey:`booking:${booking.bookingId}:cancellation-refund:${cents}`});
          setStripeRefundDetails(booking.bookingId,{refundId:refund.id,refundStatus:refund.status,refundAmount:cents/100});
        }
      }
    }else if(new Set(['requires_payment_method','requires_confirmation','requires_action','requires_capture']).has(intent.status)){
      await cancelDirectChargePaymentIntent(stripe,{accountId:connection.stripeAccountId,paymentIntentId:intent.id,idempotencyKey:`booking:${booking.bookingId}:cancel-payment`});
    }
  }

  if(booking?.securityDepositPaymentIntentId && !['released','captured'].includes(String(booking.securityDepositStatus||''))){
    const deposit=await retrieveDirectChargePaymentIntent(stripe,{accountId:connection.stripeAccountId,paymentIntentId:booking.securityDepositPaymentIntentId});
    if(deposit.status==='requires_capture'){
      await cancelDirectChargePaymentIntent(stripe,{accountId:connection.stripeAccountId,paymentIntentId:deposit.id,idempotencyKey:`booking:${booking.bookingId}:cancel-deposit`});
      setRentalSecurityDepositProviderState(booking.bookingId,{paymentIntentId:deposit.id,providerStatus:'canceled',depositStatus:'released'});
      try{resolveRentalSecurityDeposit(booking.bookingId,{status:'released',resolution:'Security deposit authorization released after cancellation.'})}catch{}
    }
  }
  return refund;
}

async function cancelBookingWithPaymentHandling(bookingId,reason,{forceFullRefund=false}={}){
  const booking=getRentalBookingById(bookingId);
  if(!booking) return null;
  // Check before calling Stripe: a terminal or handed-over rental must
  // never trigger an automatic cancellation/refund, even through other routes.
  if(!['pending','confirmed'].includes(String(booking.status||''))){
    const err=new Error('Cancellation unavailable after handover or completion. Open a dispute instead.');
    err.code='INVALID_TRANSITION';
    throw err;
  }
  const startDate=String(booking.startDate||'');
  const startInstant=new Date(booking.rentalStartAt || startDate+'T00:00:00Z');
  // Legacy bookings record a date but not a time; conservatively prevent
  // cancellation after that calendar date starts in UTC.
  if(!Number.isNaN(startInstant.getTime()) && Date.now()>=startInstant.getTime()){
    const err=new Error('Rental start date has passed; automatic cancellation is unavailable. Open a dispute instead.');
    err.code='INVALID_TRANSITION';
    throw err;
  }
  const listing=getRentalListing(booking.listingId);
  let collectedPayment=new Set(['paid','partially_refunded','refunded'])
    .has(String(booking.paymentStatus||'unpaid').toLowerCase());
  // A succeeded Stripe Direct Charge may reach us before its webhook updates
  // the booking. Never silently treat that charged booking as unpaid when
  // calculating the customer's cancellation refund.
  if(!collectedPayment && booking.stripePaymentIntentId &&
     booking.paymentProvider!=='demo' && !String(booking.stripePaymentIntentId).startsWith('demo_pi_')){
    if(!stripe) throw new Error('Cannot verify Stripe payment before cancellation');
    const connection=getDirectMerchantConnectionByEmail(db,listing?.ownerEmail);
    if(!connection?.stripeAccountId || String(connection.connectApi||'')!=='v2_merchant_direct'){
      throw new Error('Supplier Stripe connection unavailable for cancellation payment verification');
    }
    const stripeIntent=await retrieveDirectChargePaymentIntent(stripe,{
      accountId:connection.stripeAccountId,paymentIntentId:booking.stripePaymentIntentId
    });
    if(stripeIntent.status==='processing'){
      const error=new Error('Payment is still processing; try cancellation again after Stripe settles the charge');
      error.code='PAYMENT_STILL_PROCESSING';
      throw error;
    }
    if(stripeIntent.status==='succeeded'){
      if(String(stripeIntent.metadata?.bookingId||'')!==String(booking.bookingId) ||
         Number(stripeIntent.amount)!==Math.round(Number(booking.orderValue||0)*100) ||
         String(stripeIntent.currency||'').toLowerCase()!=='eur'){
        throw new Error('Stripe charge does not match this booking; cancellation requires review');
      }
      collectedPayment=true;
    }
  }
  const refundAmount=collectedPayment
    ? (forceFullRefund
      ? Number(booking.orderValue||0)
      : calculateRefundAmount(booking,booking.cancellationPolicySnapshot||listing?.cancellationPolicy||'moderate'))
    : 0;

  await handleStripeCancellationForBooking(booking,refundAmount);

  const result=cancelRentalBookingWithRefund(bookingId,reason,new Date(),{
    forceFullRefund,
    refundAmountOverride:refundAmount
  });
  return {...result,refundAmount};
}

function bookingAccessAllowed(req, bookingId){
  const user=sessionUser(req);
  if(canSupplierManageBooking(user,bookingId)) return true;
  const booking=getRentalBookingById(bookingId);
  if(
    booking &&
    user?.email &&
    String(booking.customerEmail||'').toLowerCase()===String(user.email).toLowerCase()
  ) return true;
  // Guest booking links must not override an authenticated account identity.
  // Signed-in users can access a booking only through actual ownership.
  if(user) return false;
  const token=req.body?.accessToken || req.query?.accessToken || '';
  return !!verifyBookingPaymentToken(bookingId,token);
}

function setSessionCookie(res,token,maxAgeSeconds=14*86400){
  const secure = String(appUrl).startsWith('https://') ? '; Secure' : '';
  res.setHeader('Set-Cookie',
    `rentinorbit_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`
  );
}

function requireStripe(req, res, next) {
  if (!stripe) {
    return res.status(503).json({
      error: 'Stripe is not configured. Add STRIPE_SECRET_KEY to .env.'
    });
  }
  next();
}

function statusFromLegacyAccountDuringV2Migration(account) {
  const requirements=account?.requirements||{};
  const currentlyDue=Array.isArray(requirements.currently_due)?requirements.currently_due:[];
  const eventuallyDue=Array.isArray(requirements.eventually_due)?requirements.eventually_due:[];
  return {
    accountId:account?.id||null,
    state:'migration_required',
    connectApi:'legacy_read_only',
    transferCapabilityStatus:'unknown_until_v2_retrieval',
    currentlyDue,
    eventuallyDue,
    disabledReason:requirements.disabled_reason||null
  };
}



function requireSupplierDirectChargeCapability(connection,res){
  if(!connection?.stripeAccountId){
    res.status(409).json({error:'Supplier has not connected Stripe yet.',code:'SUPPLIER_STRIPE_NOT_CONNECTED'});
    return false;
  }
  if(!directMerchantReady(connection)){
    res.status(409).json({error:'Supplier Stripe account is not ready to accept direct card payments yet.',code:'SUPPLIER_DIRECT_CHARGES_INACTIVE'});
    return false;
  }
  return true;
}

// Stripe webhook must receive RAW body.
function expectedStripeAccountForBooking(booking){
  const listing=booking?getRentalListing(booking.listingId):null;
  const connection=getDirectMerchantConnectionByEmail(db,listing?.ownerEmail);
  return connection?.stripeAccountId||null;
}

function validateDirectEventAccount(eventAccount,booking){
  const expected=expectedStripeAccountForBooking(booking);
  if(!expected) return {ok:false,reason:'supplier_stripe_account_not_found'};
  if(!eventAccount) return {ok:false,reason:'connected_account_missing'};
  if(String(eventAccount)!==String(expected)) return {ok:false,reason:'connected_account_mismatch'};
  return {ok:true};
}

function validateRentalPaymentIntentBinding(pi,booking,eventAccount=null){
  if(!pi||!booking) return {ok:false,reason:'missing_payment_or_booking'};
  const accountBinding=validateDirectEventAccount(eventAccount,booking);
  if(!accountBinding.ok) return accountBinding;
  if(String(pi.id||'')!==String(booking.stripePaymentIntentId||'')) return {ok:false,reason:'payment_intent_id_mismatch'};
  if(String(pi.metadata?.bookingId||'')!==String(booking.bookingId||'')) return {ok:false,reason:'booking_metadata_mismatch'};
  if(String(pi.metadata?.purpose||'rental_payment')!=='rental_payment') return {ok:false,reason:'payment_purpose_mismatch'};
  const expectedAmount=Math.round(Math.max(0,Number(booking.orderValue||0))*100);
  if(Number(pi.amount)!==expectedAmount) return {ok:false,reason:'payment_amount_mismatch'};
  if(String(pi.currency||'').toLowerCase()!=='eur') return {ok:false,reason:'payment_currency_mismatch'};
  return {ok:true};
}

function validateSecurityDepositIntentBinding(pi,booking,eventAccount=null){
  if(!pi||!booking) return {ok:false,reason:'missing_payment_or_booking'};
  const accountBinding=validateDirectEventAccount(eventAccount,booking);
  if(!accountBinding.ok) return accountBinding;
  if(String(pi.id||'')!==String(booking.securityDepositPaymentIntentId||'')) return {ok:false,reason:'deposit_intent_id_mismatch'};
  if(String(pi.metadata?.bookingId||'')!==String(booking.bookingId||'')) return {ok:false,reason:'deposit_booking_metadata_mismatch'};
  if(String(pi.metadata?.purpose||'')!=='security_deposit') return {ok:false,reason:'deposit_purpose_mismatch'};
  const expectedAmount=Math.round(Math.max(0,Number(booking.securityDepositAmount||0))*100);
  if(Number(pi.amount)!==expectedAmount) return {ok:false,reason:'deposit_amount_mismatch'};
  if(String(pi.currency||'').toLowerCase()!=='eur') return {ok:false,reason:'deposit_currency_mismatch'};
  return {ok:true};
}


app.post('/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    if (!stripe) {
      return res.status(503).send('Stripe not configured');
    }

    const sig = req.headers['stripe-signature'];
    let event;

    try {
      // Platform events and Connect direct-charge events may arrive through
      // separate Stripe endpoints with distinct signing secrets.
      // Never accept unsigned JSON in any environment.
      const signingSecrets=[
        process.env.STRIPE_WEBHOOK_SECRET,
        process.env.STRIPE_CONNECT_WEBHOOK_SECRET
      ].filter(Boolean);
      if (!signingSecrets.length) {
        return res.status(503).send('Stripe webhook secret is not configured');
      }
      let signatureError=null;
      for(const signingSecret of new Set(signingSecrets)){
        try{
          event=stripe.webhooks.constructEvent(req.body,sig,signingSecret);
          break;
        }catch(error){signatureError=error;}
      }
      if(!event) throw signatureError||new Error('Invalid Stripe webhook signature');
    } catch (err) {
      // Signature / parse failures do not have a trustworthy Stripe event_id.
      const syntheticId = `evt_invalid_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      const result = beginWebhookEvent({
        eventId: syntheticId,
        type: 'webhook.parse_error',
        account: null,
        source: 'stripe',
        payload: null
      });
      if (!result.duplicate) {
        markWebhookFailed(syntheticId, err.message);
      }
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Idempotency gate:
    // INSERT succeeds only once because event_id has a UNIQUE constraint.
    const started = beginWebhookEvent({
      eventId: event.id,
      type: event.type,
      account: event.account || event.data?.object?.account || null,
      source: 'stripe',
      payload: event
    });

    if (started.duplicate) {
      // Already-processed events are idempotent no-ops.
      // Failed or stale-processing events are explicitly reclaimed so Stripe
      // retries can actually execute the side effects again.
      const retry=claimWebhookRetry(event.id,{staleMinutes:5});
      if(!retry.claimed){
        return res.json({
          received:true,
          duplicate:true,
          eventId:event.id,
          status:started.event?.status || 'processed'
        });
      }
    }

    try {
      switch (event.type) {
        case 'account.updated':
          console.log('Connected account updated:', event.data.object.id);
          break;
        case 'account.external_account.updated':
          console.log('External bank/card updated:', event.data.object.id);
          break;
        case 'payout.paid':
        case 'payout.failed':
          console.log('Payout event:', event.type, event.data.object.id);
          break;
        case 'payment_intent.amount_capturable_updated': {
          const pi=event.data.object;
          const bookingId=pi.metadata?.bookingId;
          if(String(pi.metadata?.purpose||'')!=='security_deposit') break;
          const booking=bookingId?getRentalBookingById(bookingId):null;
          const binding=booking?validateSecurityDepositIntentBinding(pi,booking,event.account):{ok:false,reason:'booking_not_found'};
          if(!booking||!binding.ok){console.warn('Ignoring unbound security deposit authorization',pi.id,bookingId,binding.reason);break;}
          if(pi.status!=='requires_capture'){console.warn('Ignoring non-capturable deposit update',pi.id,pi.status);break;}
          setRentalSecurityDepositProviderState(bookingId,{paymentIntentId:pi.id,providerStatus:pi.status,depositStatus:'authorized'});
          if(booking.customerEmail)createRentalNotification({uniqueKey:`deposit:${pi.id}:authorized:customer`,audience:'customer',userEmail:booking.customerEmail,bookingId,type:'deposit.authorized',title:'Security deposit authorized',message:`Your €${Number(booking.securityDepositAmount||0).toFixed(2)} security deposit is authorized, not charged, and will be released after a satisfactory return.`});
          break;
        }
        case 'payment_intent.canceled': {
          const pi=event.data.object;
          const bookingId=pi.metadata?.bookingId;
          if(String(pi.metadata?.purpose||'')!=='security_deposit') break;
          const booking=bookingId?getRentalBookingById(bookingId):null;
          const binding=booking?validateSecurityDepositIntentBinding(pi,booking,event.account):{ok:false,reason:'booking_not_found'};
          if(!booking||!binding.ok){console.warn('Ignoring unbound security deposit cancellation',pi.id,bookingId,binding.reason);break;}
          setRentalSecurityDepositProviderState(bookingId,{paymentIntentId:pi.id,providerStatus:'canceled',depositStatus:'released'});
          break;
        }
        case 'payment_intent.succeeded': {
          const pi=event.data.object;
          const bookingId=pi.metadata?.bookingId;
          let lateTerminalRefunded=false;
          if(bookingId){
            const booking=getRentalBookingById(bookingId);
            if(booking){
              const binding=validateRentalPaymentIntentBinding(pi,booking,event.account);
              if(!binding.ok){
                console.warn('Ignoring unbound payment_intent.succeeded',pi.id,bookingId,binding.reason);
                break;
              }
              if(!booking.stripeRefundId){
                setBookingPaymentDetails({
                  bookingId,
                  paymentIntentId:pi.id,
                  paymentStatus:'paid',
                platformFeeAmount:Number(booking.platformFeeAmount||0),
                  supplierAmount:Number(booking.supplierAmount||0)
                });
              }

              // A legacy pending payment must never count as supplier approval.
              const terminalNonPayable=new Set(['pending','expired','cancelled','declined']);
              if(terminalNonPayable.has(booking.status) && !booking.stripeRefundId){
                const refund=await refundDirectCharge(stripe,{
                  accountId:String(event.account),
                  paymentIntentId:pi.id,
                  amountCents:Math.round(Math.max(0,Number(booking.orderValue||0))*100),
                  bookingId,
                  idempotencyKey:`booking:${bookingId}:late-terminal-refund`
                });
                setStripeRefundDetails(bookingId,{
                  refundId:refund.id,
                  refundStatus:refund.status,
                  refundAmount:Number(booking.orderValue||0)
                });
                lateTerminalRefunded=true;
              }
            }
          }
          if(bookingId){
            let paidBooking=getRentalBookingById(bookingId);
            const paidListing=paidBooking ? getRentalListing(paidBooking.listingId) : null;
            // Never auto-confirm a pending reservation from a payment webhook.
            // Supplier approval is the only action that unlocks payment.
            if(paidBooking?.customerEmail){
              createRentalNotification({
                uniqueKey:`payment:${pi.id}:customer`,
                audience:'customer',userEmail:paidBooking.customerEmail,bookingId,
                type:lateTerminalRefunded?'payment.refunded':'payment.paid',
                title:lateTerminalRefunded?'Payment automatically refunded':'Payment received',
                message:lateTerminalRefunded
                  ? `Payment for booking ${bookingId} arrived after the booking closed and was automatically refunded.`
                  : `Payment for booking ${bookingId} was received.`
              });
            }
            /* STAGING_POSTPAYMENT_EMAIL_V1 */
            if(!lateTerminalRefunded && paidBooking?.customerEmail && isEmail(paidBooking.customerEmail)){
              enqueueTransactionalEmail({
                recipient:paidBooking.customerEmail,
                templateKey:'booking_paid',
                subject:`RentInOrbit · Payment received · ${bookingId}`,
                dedupeKey:`booking:${bookingId}:payment:${pi.id}:customer-email`,
                payload:{
                  templateVersion:1,
                  bookingId,
                  listingTitle:paidListing?.title||'Rental item',
                  status:'paid',
                  message:'Your payment was received successfully. The booking remains confirmed until the rental is handed over.',
                  bookingUrl:null,
                  accountBookingPath:`/?view=my-bookings&booking=${encodeURIComponent(bookingId)}`
                }
              });
            }
            if(paidListing?.ownerEmail){
              createRentalNotification({
                uniqueKey:`payment:${pi.id}:supplier`,
                audience:'supplier',userEmail:paidListing.ownerEmail,bookingId,
                type:lateTerminalRefunded?'payment.refunded':'payment.paid',
                title:lateTerminalRefunded?'Late payment refunded':'Booking payment received',
                message:lateTerminalRefunded
                  ? `A late payment for ${paidListing.title} booking ${bookingId} was automatically refunded.`
                  : `Payment for ${paidListing.title} booking ${bookingId} was received.`
              });
            }
            if(!lateTerminalRefunded && paidListing?.ownerEmail && isEmail(paidListing.ownerEmail)){
              enqueueTransactionalEmail({
                recipient:paidListing.ownerEmail,
                templateKey:'booking_paid_supplier',
                subject:`RentInOrbit · Booking payment received · ${bookingId}`,
                dedupeKey:`booking:${bookingId}:payment:${pi.id}:supplier-email`,
                payload:{
                  templateVersion:1,
                  bookingId,
                  listingTitle:paidListing.title||'Rental item',
                  status:'paid',
                  message:`The customer payment was received. Supplier share: €${Number(paidBooking?.supplierAmount||0).toFixed(2)} before Stripe processing fees.`,
                  bookingUrl:null,
                  accountBookingPath:`/?view=supplier-bookings&booking=${encodeURIComponent(bookingId)}`
                }
              });
            }
          }
          console.log('Payment succeeded:', pi.id);
          break;
        }
        case 'payment_intent.payment_failed': {
          const pi=event.data.object;
          const bookingId=pi.metadata?.bookingId;
          if(bookingId){
            const booking=getRentalBookingById(bookingId);
            const binding=booking?validateRentalPaymentIntentBinding(pi,booking,event.account):{ok:false,reason:'booking_not_found'};
            if(booking && binding.ok && booking.paymentStatus!=='paid' && !booking.stripeRefundId){
              setBookingPaymentDetails({
                bookingId,
                paymentIntentId:pi.id,
                paymentStatus:'failed',
                platformFeeAmount:Number(booking.platformFeeAmount||0),
                supplierAmount:Number(booking.supplierAmount||0)
              });
              if(booking.customerEmail){
                createRentalNotification({
                  uniqueKey:`payment:${pi.id}:failed:customer`,
                  audience:'customer',userEmail:booking.customerEmail,bookingId,
                  type:'payment.failed',title:'Payment failed',
                  message:`Payment for booking ${bookingId} was not completed. You can retry while the reservation is still open.`
                });
              }
            }
          }
          break;
        }
        case 'charge.dispute.created':
        case 'charge.dispute.updated':
        case 'charge.dispute.closed': {
          const dispute=event.data.object;
          if(!event.account){
            console.warn('Ignoring dispute without connected account context',event.id);
            break;
          }
          console.warn('Connected-account dispute event',event.type,dispute.id,'account',event.account);
          // Direct charges belong to the supplier account. Do not reverse any destination transfer here.
          break;
        }
        default:
          break;
      }

      markWebhookProcessed(event.id);

      return res.json({
        received: true,
        duplicate: false,
        eventId: event.id,
        status: 'processed'
      });
    } catch (err) {
      markWebhookFailed(event.id, err.message);

      // Return 500 so Stripe can retry.
      return res.status(500).json({
        received: true,
        eventId: event.id,
        status: 'failed',
        error: err.message
      });
    }
  }
);


function publicOrigin(req){
  const configured=String(process.env.PUBLIC_BASE_URL||'').trim().replace(/\/+$/,'');
  if(configured) return configured;
  const proto=req.get('x-forwarded-proto')?.split(',')[0]?.trim() || req.protocol;
  return `${proto}://${req.get('host')}`;
}

app.get('/robots.txt',(req,res)=>{
  const origin=publicOrigin(req);
  res.type('text/plain').send(
`User-agent: *
Allow: /
Disallow: /api/
Sitemap: ${origin}/sitemap.xml
`
  );
});

app.get('/sitemap.xml',(req,res)=>{
  const origin=publicOrigin(req);
  const updated=new Date().toISOString().slice(0,10);
  const fixed=['/','/help','/terms','/privacy','/cookies','/fees'];
  const listingUrls=listPublicRentalListings().map(l=>`/listing/${encodeURIComponent(l.id)}/${seoSlug(l.title)}`);
  const urls=[...fixed,...listingUrls].map((url,i)=>`  <url><loc>${escapeXml(origin+url)}</loc><lastmod>${updated}</lastmod><changefreq>${i===0?'daily':'weekly'}</changefreq><priority>${i===0?'1.0':url.startsWith('/listing/')?'0.8':'0.5'}</priority></url>`).join('\n');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
});

function escapeXml(value){return String(value??'').replace(/[<>&"']/g,ch=>({"<":'&lt;',">":'&gt;',"&":'&amp;',"\"":'&quot;',"'":'&apos;'}[ch]||ch));}
function seoSlug(value){return String(value||'rental').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'rental';}
function absoluteAsset(origin,url){const v=String(url||'');if(!v)return null;if(/^https?:\/\//i.test(v))return v;if(v.startsWith('/'))return origin+v;return origin+'/'+v.replace(/^\/+/, '');}
function pageLanguage(req){
  const supported=['lt','en','es','de','ru'];
  const q=String(req.query.lang||'').toLowerCase();if(supported.includes(q))return q;
  const accept=String(req.get('accept-language')||'').toLowerCase();const found=supported.find(x=>accept.startsWith(x)||accept.includes(','+x));
  return found||'lt';
}
const PAGE_SHELL_COPY={
  lt:{marketplace:'Nuomos platforma',help:'Pagalba',tagline:'Nuomokis protingiau. Pirk rečiau.',terms:'Taisyklės',privacy:'Privatumas',cookies:'Slapukai',fees:'Kainos ir mokesčiai'},
  en:{marketplace:'Marketplace',help:'Help',tagline:'Rent smarter. Buy less.',terms:'Terms',privacy:'Privacy',cookies:'Cookies',fees:'Fees'},
  es:{marketplace:'Marketplace',help:'Ayuda',tagline:'Alquila de forma más inteligente. Compra menos.',terms:'Condiciones',privacy:'Privacidad',cookies:'Cookies',fees:'Comisiones'},
  de:{marketplace:'Marktplatz',help:'Hilfe',tagline:'Cleverer mieten. Weniger kaufen.',terms:'Bedingungen',privacy:'Datenschutz',cookies:'Cookies',fees:'Gebühren'},
  ru:{marketplace:'Маркетплейс',help:'Помощь',tagline:'Арендуй разумнее. Покупай реже.',terms:'Условия',privacy:'Конфиденциальность',cookies:'Cookies',fees:'Комиссии'}
};
const LISTING_SEO_COPY={
  lt:{eyebrow:'RentInOrbit nuomos platforma',fallbackDescription:'Nuomojamas daiktas per RentInOrbit.',location:'Vieta',seeListing:'Žiūrėti skelbimą',dailyPrice:'Kaina dienai',available:'Kiekis',fulfilment:'Atsiėmimas / pristatymas',delivery:'Galimas pristatymas',pickup:'Atsiėmimas',cta:'Peržiūrėti prieinamumą ir rezervuoti'},
  en:{eyebrow:'RentInOrbit marketplace',fallbackDescription:'Rental item available through RentInOrbit.',location:'Location',seeListing:'See listing',dailyPrice:'Daily price',available:'Available',fulfilment:'Pickup / delivery',delivery:'Delivery available',pickup:'Pickup',cta:'View availability & book'},
  es:{eyebrow:'Marketplace RentInOrbit',fallbackDescription:'Artículo disponible para alquilar en RentInOrbit.',location:'Ubicación',seeListing:'Ver anuncio',dailyPrice:'Precio por día',available:'Disponibles',fulfilment:'Recogida / entrega',delivery:'Entrega disponible',pickup:'Recogida',cta:'Ver disponibilidad y reservar'},
  de:{eyebrow:'RentInOrbit Marktplatz',fallbackDescription:'Mietartikel über RentInOrbit verfügbar.',location:'Ort',seeListing:'Anzeige ansehen',dailyPrice:'Preis pro Tag',available:'Verfügbar',fulfilment:'Abholung / Lieferung',delivery:'Lieferung verfügbar',pickup:'Abholung',cta:'Verfügbarkeit prüfen & buchen'},
  ru:{eyebrow:'Маркетплейс RentInOrbit',fallbackDescription:'Вещь доступна для аренды через RentInOrbit.',location:'Место',seeListing:'Открыть объявление',dailyPrice:'Цена за день',available:'Доступно',fulfilment:'Самовывоз / доставка',delivery:'Доставка доступна',pickup:'Самовывоз',cta:'Проверить доступность и забронировать'}
};
function pageShell({req,title,description,body,canonicalPath}){
  const origin=publicOrigin(req),canonical=origin+canonicalPath,lang=pageLanguage(req),c=PAGE_SHELL_COPY[lang]||PAGE_SHELL_COPY.en;
  const langNames={lt:'LT',en:'EN',es:'ES',de:'DE',ru:'RU'};
  const langLinks=Object.entries(langNames).map(([code,label])=>`<a class="legal-lang${code===lang?' active':''}" href="${canonicalPath}?lang=${code}" lang="${code}">${label}</a>`).join('');
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeEmailHtml(title)}</title><meta name="description" content="${escapeEmailHtml(description)}"><link rel="canonical" href="${escapeEmailHtml(canonical)}"><meta property="og:title" content="${escapeEmailHtml(title)}"><meta property="og:description" content="${escapeEmailHtml(description)}"><meta property="og:url" content="${escapeEmailHtml(canonical)}"><meta property="og:type" content="website"><link rel="stylesheet" href="/styles.css?v=225"><link rel="stylesheet" href="/light-premium-v161.css?v=225"><link rel="stylesheet" href="/brand-v193.css?v=225"></head><body class="theme-aurora legal-shell"><header class="topbar legal-topbar"><div class="container nav"><a class="brand legal-brand brand-logo" href="/" aria-label="RentInOrbit"><img src="/assets/brand/rentinorbit-logo-horizontal-dark-web.png?v=203" alt="RentInOrbit" width="248" height="66"></a><nav class="navlinks"><a href="/">${c.marketplace}</a><a href="/help?lang=${lang}">${c.help}</a><div class="legal-lang-switch" aria-label="Language">${langLinks}</div></nav></div></header><main class="section legal-main"><div class="container">${body}</div></main><footer><div class="container footer-grid"><div><b>RentInOrbit</b><p>${c.tagline}</p></div><div><a href="/help?lang=${lang}">${c.help}</a><a href="/fees?lang=${lang}">${c.fees}</a><a href="/terms?lang=${lang}">${c.terms}</a></div><div><a href="/privacy?lang=${lang}">${c.privacy}</a><a href="/cookies?lang=${lang}">${c.cookies}</a><small>RentInOrbit · ${c.marketplace}</small></div></div></footer></body></html>`;
}

app.get('/listing/:listingId/:slug?',(req,res)=>{
  const listing=getFullRentalListing(req.params.listingId);
  if(!listing||listing.moderationStatus==='blocked'||listing.moderationStatus==='paused')return res.status(404).send('Listing not found');
  const origin=publicOrigin(req),canonicalPath=`/listing/${encodeURIComponent(listing.id)}/${seoSlug(listing.title)}`;
  const lang=pageLanguage(req),seoCopy=LISTING_SEO_COPY[lang]||LISTING_SEO_COPY.en;
  const location=[listing.city,listing.country].filter(Boolean).join(', '),description=String(listing.description||seoCopy.fallbackDescription).slice(0,160);
  const image=absoluteAsset(origin,listing.coverPhoto||listing.photos?.[0]);
  const title=`${listing.title}${location?' · '+location:''} | RentInOrbit`;
  const body=`<article class="seo-listing-page"><div class="eyebrow">${seoCopy.eyebrow}</div><h1>${escapeEmailHtml(listing.title)}</h1><p class="hero-copy">${escapeEmailHtml(listing.description||seoCopy.fallbackDescription)}</p>${image?`<img src="${escapeEmailHtml(image)}" alt="${escapeEmailHtml(listing.title)}" style="width:min(720px,100%);max-height:480px;object-fit:cover;border-radius:22px;border:1px solid #dde4de">`:''}<div class="v92-facts" style="margin:24px 0"><div><span>${seoCopy.location}</span><b>${escapeEmailHtml(location||seoCopy.seeListing)}</b></div><div><span>${seoCopy.dailyPrice}</span><b>€${Number(listing.priceDay||0).toFixed(2)}</b></div><div><span>${seoCopy.available}</span><b>${Number(listing.quantity||1)}</b></div><div><span>${seoCopy.fulfilment}</span><b>${listing.deliveryEnabled?seoCopy.delivery:seoCopy.pickup}</b></div></div><p><a class="primary" href="/?listing=${encodeURIComponent(listing.id)}">${seoCopy.cta}</a></p></article>`;
  let html=pageShell({req,title,description,body,canonicalPath});
  if(image)html=html.replace('</head>',`<meta property="og:image" content="${escapeEmailHtml(image)}"></head>`);
  res.type('html').send(html);
});

function renderFaqGroup(title,items){
  return `<section class="help-group"><h2>${escapeEmailHtml(title)}</h2><div class="faq-list">${items.map(([q,a])=>`<details class="faq-item"><summary>${escapeEmailHtml(q)}</summary><div class="faq-answer"><p>${escapeEmailHtml(a)}</p></div></details>`).join('')}</div></section>`;
}
function renderHelpPage(lang){
  const c=HELP_CENTER_COPY[lang]||HELP_CENTER_COPY.en;
  return `<article class="legal-page help-center"><div class="eyebrow">${escapeEmailHtml(c.eyebrow)}</div><h1>${escapeEmailHtml(c.pageTitle)}</h1><p class="legal-lead">${escapeEmailHtml(c.intro)}</p><nav class="help-jump" aria-label="Help topics"><a href="#renters">${escapeEmailHtml(c.renterTitle)}</a><a href="#suppliers">${escapeEmailHtml(c.supplierTitle)}</a><a href="#safety">${escapeEmailHtml(c.safetyTitle)}</a></nav><div id="renters">${renderFaqGroup(c.renterTitle,c.renter)}</div><div id="suppliers">${renderFaqGroup(c.supplierTitle,c.supplier)}</div><div id="safety">${renderFaqGroup(c.safetyTitle,c.safety)}</div><section class="help-contact"><h2>${escapeEmailHtml(c.contactTitle)}</h2><p>${escapeEmailHtml(c.contactText)}</p></section><p><a class="secondary" href="/">← RentInOrbit</a></p></article>`;
}
function renderPolicyPage(lang,key){
  const page=getPolicyPage(lang,key);
  const sections=(page.sections||[]).map(([title,paras])=>`<section class="policy-section"><h2>${escapeEmailHtml(title)}</h2>${paras.map(p=>`<p>${escapeEmailHtml(p)}</p>`).join('')}</section>`).join('');
  const stagingSource={
    lt:['Staging versija','Šis tekstas yra informacinis produkto juodraštis. Prieš viešą komercinį paleidimą jį turi peržiūrėti teisės ir apskaitos specialistai.'],
    en:['Staging draft','This is a product-information draft. It must receive appropriate legal and accounting review before public commercial launch.'],
    es:['Borrador de staging','Este texto es un borrador informativo y debe ser revisado por profesionales jurídicos y contables antes del lanzamiento comercial.'],
    de:['Staging-Entwurf','Dieser Text ist ein Informationsentwurf und muss vor dem kommerziellen Start rechtlich und steuerlich geprüft werden.'],
    ru:['Черновик staging','Это информационный черновик, который до коммерческого запуска должен пройти юридическую и бухгалтерскую проверку.']
  }[lang]||['Staging draft','Professional legal review required before public launch.'];
  const stageNote=process.env.RENTINORBIT_STAGING==='true'?`<aside class="staging-note"><b>${escapeEmailHtml(stagingSource[0])}</b><p>${escapeEmailHtml(stagingSource[1])}</p></aside>`:'';
  return `<article class="legal-page policy-page"><div class="eyebrow">RENTINORBIT</div><h1>${escapeEmailHtml(page.title)}</h1><p class="legal-lead">${escapeEmailHtml(page.intro)}</p>${sections}${stageNote}<p><a class="secondary" href="/">← RentInOrbit</a></p></article>`;
}

app.get('/help',(req,res)=>{
  const lang=pageLanguage(req),c=HELP_CENTER_COPY[lang]||HELP_CENTER_COPY.en;
  res.type('html').send(pageShell({req,title:`${c.pageTitle} | RentInOrbit`,description:c.intro,body:renderHelpPage(lang),canonicalPath:'/help'}));
});
for(const [pathName,key] of [['/terms','terms'],['/privacy','privacy'],['/cookies','cookies'],['/fees','fees']]){
  app.get(pathName,(req,res)=>{
    const lang=pageLanguage(req),page=getPolicyPage(lang,key);
    res.type('html').send(pageShell({req,title:`${page.title} | RentInOrbit`,description:page.intro,body:renderPolicyPage(lang,key),canonicalPath:pathName}));
  });
}


function bookingRequestHash(body){
 const stable={listingId:Number(body?.listingId||0),startDate:String(body?.startDate||''),endDate:String(body?.endDate||''),quantity:Number(body?.quantity||1),customerEmail:String(body?.customerEmail||'').trim().toLowerCase(),fulfillment:String(body?.fulfillment||body?.deliveryMethod||'')};
 return crypto.createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}
function bookingIdempotency(req,res,next){
 const key=String(req.get('idempotency-key')||'').trim();
 if(!key)return next();
 if(key.length<12||key.length>160)return res.status(400).json({error:'Invalid idempotency key'});
 const hash=bookingRequestHash(req.body), state=beginBookingIdempotency(key,hash);
 if(state.state==='conflict')return res.status(409).json({error:'Idempotency key was already used for a different booking'});
 if(state.state==='replay')return res.status(200).json({...state.response,idempotentReplay:true});
 if(state.state==='in_progress'){res.setHeader('Retry-After','2');return res.status(409).json({error:'Booking request is already processing',retryable:true});}
 const original=res.json.bind(res);
 res.json=(payload)=>{
   try{
     if(res.statusCode>=200&&res.statusCode<300) completeBookingIdempotency(key,hash,payload);
     else releaseBookingIdempotency(key,hash);
   }catch(e){ console.warn('Booking idempotency finalization failed',e.message); }
   return original(payload);
 };
 res.on('close',()=>{
   if(!res.writableEnded){
     try{ releaseBookingIdempotency(key,hash); }catch(e){ console.warn('Booking idempotency disconnect cleanup failed',e.message); }
   }
 });
 next();
}

// JSON routes after webhook raw parser.
app.use(express.json({ limit: '15mb' }));




const APP_VERSION=runtimeConfig.appVersion;

function platformDiagnostics(){
  const databaseCheck=checkDatabase();
  return {
    ok:databaseCheck.ok,
    service:'rentinorbit-marketplace',
    version:APP_VERSION,
    database:databaseCheck.ok?'ok':'error',
    migrationVersion:databaseCheck.migrationVersion,
    stripe:stripe ? 'configured' : 'not_configured',
    environment:process.env.NODE_ENV || 'development',
    timestamp:new Date().toISOString()
  };
}


function databaseBackupStatus(){
  const required=Boolean(runtimeConfig.deployment&&String(process.env.RENTINORBIT_STAGING||'').trim()!=='true');
  const enabled=String(process.env.DB_BACKUP_ENABLED||'').trim().toLowerCase()==='true';
  const maxAgeHours=Math.max(1,Math.min(168,Number(process.env.DB_BACKUP_MAX_AGE_HOURS)||30));
  const defaultEvidence=path.join(path.dirname(runtimeConfig.database.path),'backups','last-verified-backup.json');
  const evidencePath=String(process.env.DB_BACKUP_EVIDENCE_PATH||defaultEvidence);
  let verifiedAt=null,integrity=null,ageHours=null,evidenceValid=false,restoreVerified=false,restoreVerifiedAt=null;
  try{
    const evidence=JSON.parse(fs.readFileSync(evidencePath,'utf8'));
    verifiedAt=String(evidence.verifiedAt||'');integrity=String(evidence.integrity||'');
    const ts=new Date(verifiedAt).getTime();
    if(Number.isFinite(ts)){ageHours=(Date.now()-ts)/3600000;evidenceValid=evidence.ok===true&&integrity==='ok'&&ageHours>=0&&ageHours<=maxAgeHours;}
    // Proof is published only after the downloaded backup passes an isolated
    // SQLite restore. It must match this exact backup, not an older one.
    const proofPath=path.join(path.dirname(path.resolve(evidencePath)),'last-restored-backup.json');
    const proof=JSON.parse(fs.readFileSync(proofPath,'utf8'));
    restoreVerifiedAt=String(proof.restoreVerifiedAt||'');
    const restoreTs=new Date(restoreVerifiedAt).getTime();
    restoreVerified=proof.ok===true&&proof.integrity==='ok'&&
      proof.backupKey===evidence.backupKey&&proof.backupFile===evidence.backupFile&&
      proof.storage===evidence.storage&&Number(proof.bytes)===Number(evidence.bytes)&&
      /^[a-f0-9]{64}$/.test(String(evidence.sha256||''))&&proof.sha256===evidence.sha256&&
      Number.isFinite(restoreTs)&&restoreTs>=ts&&restoreTs<=Date.now()&&
      Number(proof.tableCount)>=1&&Number(proof.migrationVersion)>=1;
  }catch{}
  return {required,enabled,evidenceValid,restoreVerified,restoreVerifiedAt:restoreVerifiedAt||null,verifiedAt:verifiedAt||null,ageHours:ageHours==null?null:Number(ageHours.toFixed(2)),maxAgeHours};
}

function launchGate(){
  const report=productionConfigReport();
  const storage=productionStorageReport();
  const database=checkDatabase();
  const backup=databaseBackupStatus();
  const checks=[...report.checks.map(({id,required,ready})=>({id,required,ready})),...storage.checks.map(({id,required,ready})=>({id,required,ready})),{id:'database_connection',required:true,ready:database.ok},{id:'database_migration',required:true,ready:database.migrationVersion>=REQUIRED_SCHEMA_VERSION},{id:'database_backup_enabled',required:backup.required,ready:backup.enabled},{id:'database_backup_recent_verified',required:backup.required,ready:backup.enabled&&backup.evidenceValid},{id:'database_backup_restore_verified',required:backup.required,ready:backup.enabled&&backup.evidenceValid&&backup.restoreVerified},{id:'accepting_traffic',required:true,ready:!shuttingDown}];
  const blocking=checks.filter(x=>x.required&&!x.ready).map(x=>x.id);
  return {ready:blocking.length===0,production:report.production,deployment:report.deployment,checks,blocking,database:{driver:database.driver,source:database.source,persistent:database.persistent,volumeConfigured:storage.database.volumeConfigured,migrationVersion:database.migrationVersion,backup},stripe:report.stripe,email:report.email,maps:report.maps,notifications:report.notifications};
}

app.get('/api/launch-readiness',(req,res)=>{
  const gate=launchGate();
  res.setHeader('Cache-Control','no-store, private');
  res.status(gate.ready?200:503).json(gate);
});

app.get('/api/runtime-config',(req,res)=>{
  res.setHeader('Cache-Control','public, max-age=300');
  res.json({
    version:APP_VERSION,
    paymentsConfigured:Boolean(stripe),
    transactionalEmailConfigured:Boolean(process.env.EMAIL_PROVIDER && process.env.EMAIL_FROM),
    supportEmail:process.env.SUPPORT_EMAIL || null
  });
});

app.get('/api/health', (req,res)=>{
  const diagnostics=platformDiagnostics();
  res.setHeader('Cache-Control','no-store');
  const gate=launchGate();
  res.status(diagnostics.ok?200:503).json({
    ok:diagnostics.ok,
    ready:gate.ready,
    service:diagnostics.service,
    version:diagnostics.version
  });
});



function requireEmailWorker(req,res,next){
  const expected=String(process.env.EMAIL_WORKER_TOKEN||'');
  const supplied=String(req.get('authorization')||'').replace(/^Bearer\s+/i,'');
  if(!expected || !supplied || supplied.length!==expected.length ||
     !crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected))){
    return res.status(401).json({error:'Unauthorized'});
  }
  next();
}

app.post('/api/internal/email-outbox/claim', requireEmailWorker, (req,res)=>{
  const limit=Math.max(1,Math.min(100,Number(req.body?.limit)||20));
  const maxAttempts=Math.max(1,Math.min(20,Number(process.env.EMAIL_MAX_ATTEMPTS)||5));
  res.setHeader('Cache-Control','no-store, private');
  res.json({items:claimTransactionalEmails({limit,maxAttempts})});
});
app.post('/api/internal/email-outbox/:id/sent', requireEmailWorker, (req,res)=>{
  res.setHeader('Cache-Control','no-store, private');
  if(!completeTransactionalEmail(req.params.id)) return res.status(404).json({error:'Message not found'});
  res.json({ok:true});
});
app.post('/api/internal/email-outbox/:id/failed', requireEmailWorker, (req,res)=>{
  const maxAttempts=Math.max(1,Math.min(20,Number(process.env.EMAIL_MAX_ATTEMPTS)||5));
  res.setHeader('Cache-Control','no-store, private');
  if(!failTransactionalEmail(req.params.id,req.body?.error,{maxAttempts})) return res.status(404).json({error:'Message not found'});
  res.json({ok:true});
});

app.get('/api/admin/email-preview/:id', requireRole('admin'), (req,res)=>{
  const id=Number(req.params.id);
  const item=listEmailOutbox(200).find(row=>Number(row.id)===id);
  if(!item) return res.status(404).send('Email not found');
  const key=item.templateKey||item.type||'';
  if(!key.startsWith('booking_') && !['supplier_booking_received','supplier_activation','supplier_freshness','supplier_response_reminder'].includes(key)) return res.status(400).send('Preview unavailable');
  let payload={}; try{payload=typeof item.payload==='string'?JSON.parse(item.payload):item.payload||{};}catch{}
  res.setHeader('Cache-Control','no-store, private');
  res.type('html').send(
    key==='supplier_booking_received' ? renderSupplierBookingReceivedEmail(payload) :
    key==='supplier_activation' ? renderSupplierActivationEmail(payload) :
    key==='supplier_freshness' ? renderSupplierFreshnessEmail(payload) :
    key==='supplier_response_reminder' ? renderSupplierResponseReminderEmail(payload) :
    key==='booking_received' ? renderBookingReceivedEmail(payload) :
    renderBookingStatusEmail(payload)
  );
});

app.get('/api/admin/email-outbox', requireRole('admin'), (req,res)=>{
  const limit=Math.max(1,Math.min(200,Number(req.query.limit)||100));
  res.setHeader('Cache-Control','no-store, private');
  res.json({deliveryMode:process.env.EMAIL_DELIVERY_MODE||'outbox',items:listEmailOutbox(limit)});
});

app.get('/api/admin/diagnostics', requireRole('admin'), (req,res)=>{
  res.setHeader('Cache-Control','no-store, private');
  res.status(platformDiagnostics().ok?200:503).json(platformDiagnostics());
});

app.get('/api/config', (req,res)=>{
  res.json({
    stripePublishableKey:process.env.STRIPE_PUBLISHABLE_KEY || '',
    stripeConfigured:!!stripe,
    demoPaymentsEnabled,
    rentalPreauthEnabled,
    paymentProvider,
    platformFeePercent:DEFAULT_COMMISSION_BPS/100
  });
});

app.post('/api/auth/register', simpleRateLimit({windowMs:15*60*1000,max:12,keyPrefix:'auth-register'}), (req,res)=>{
  try{
    const {email,password,displayName=null,businessName=null,country=null,city=null,role='supplier'}=req.body||{};
    if(req.body?.termsAccepted!==true){
      return res.status(400).json({error:'Platform terms must be accepted before registration',code:'TERMS_ACCEPTANCE_REQUIRED'});
    }
    if(String(password||'').length<8){
      return res.status(400).json({error:'Password must contain at least 8 characters'});
    }
    const safeRole=role==='customer'?'customer':'supplier';
    const user=createAppUser({email,password,role:safeRole,displayName,businessName,country,city});
    if(safeRole==='supplier') ensureSupplierOnboarding(user.email,{active:true});
    const session=createAppSession(user.userId);
    setSessionCookie(res,session.token);
    res.json({user});
  }catch(err){
    res.status(err.code==='EMAIL_EXISTS'?409:400).json({error:err.message,code:err.code||null});
  }
});

app.post('/api/auth/login', simpleRateLimit({windowMs:15*60*1000,max:12,keyPrefix:'auth-login'}), (req,res)=>{
  const {email,password}=req.body||{};
  const user=authenticateAppUser(email,password);
  if(!user) return res.status(401).json({error:'Invalid email or password'});
  const session=createAppSession(user.userId);
  setSessionCookie(res,session.token);
  res.json({user});
});

app.post('/api/auth/logout', (req,res)=>{
  const cookies=parseCookies(req);
  const token=cookies.rentinorbit_session||cookies[legacySessionCookie];
  if(token) deleteAppSession(token);
  res.setHeader('Set-Cookie',[
    'rentinorbit_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
    `${legacySessionCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  ]);
  res.json({ok:true});
});

app.get('/api/auth/me', (req,res)=>{
  res.json({user:sessionUser(req)});
});

app.post('/api/auth/enable-supplier', requireRole('customer','supplier','admin'), (req,res)=>{
  try{
    const user=enableSupplierForUser(req.appUser.userId);
    res.json({user});
  }catch(err){res.status(400).json({error:err.message});}
});



app.get('/api/customer/saved-searches', requireRole('customer','supplier','admin'), (req,res)=>{
  res.json({savedSearches:listSavedSearches(req.appUser.email)});
});
app.post('/api/customer/saved-searches', requireRole('customer','supplier','admin'), (req,res)=>{
  try{
    const savedSearch=saveRentalSearch(req.appUser.email,{
      savedSearchId:req.body?.savedSearchId||null,
      name:req.body?.name||'Saved search',
      query:req.body?.query||{}
    });
    res.json({savedSearch});
  }catch(err){res.status(400).json({error:err.message});}
});
app.delete('/api/customer/saved-searches/:savedSearchId', requireRole('customer','supplier','admin'), (req,res)=>{
  const deleted=deleteRentalSavedSearch(req.appUser.email,req.params.savedSearchId);
  res.status(deleted?200:404).json({deleted});
});

app.get('/api/customer/notifications', requireRole('customer','supplier','admin'), (req,res)=>{try{res.setHeader('Cache-Control','no-store, private');res.json({notifications:listCustomerNotifications(req.appUser.email,{limit:Number(req.query.limit||100)})});}catch(err){res.status(400).json({error:err.message});}});
app.post('/api/customer/notifications/:notificationId/read', requireRole('customer','supplier','admin'), (req,res)=>{try{markCustomerNotificationRead(req.params.notificationId,req.appUser.email);res.json({ok:true});}catch(err){res.status(400).json({error:err.message});}});

app.get('/api/supplier/notifications', requireRole('supplier','admin'), (req,res)=>{
  try{
    res.json({
      notifications:listSupplierNotifications(req.appUser.email,{
        limit:Number(req.query.limit||100)
      })
    });
  }catch(err){res.status(400).json({error:err.message});}
});

app.post('/api/supplier/notifications/:notificationId/read', requireRole('supplier','admin'), (req,res)=>{
  try{
    markSupplierNotificationRead(req.params.notificationId,req.appUser.email);
    res.json({ok:true});
  }catch(err){res.status(400).json({error:err.message});}
});




function escapeEmailHtml(value){
  return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function renderSupplierBookingReceivedEmail(payload={}){
  const e=v=>escapeEmailHtml(String(v??''));
  const total=Number(payload.total||0).toFixed(2);
  const dashboardUrl=String(payload.supplierDashboardUrl||`${PUBLIC_BASE_URL}/?view=supplier-bookings${payload.bookingId?`&booking=${encodeURIComponent(payload.bookingId)}`:''}`);
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#17221b">
    <h2>New booking request</h2>
    <p><strong>${e(payload.listingTitle||'Rental item')}</strong></p>
    <p>Booking ${e(payload.bookingId||'')}</p>
    <p>${e(payload.startDate||'')} → ${e(payload.endDate||'')} · Qty ${Number(payload.quantity||1)}</p>
    <p>Customer: ${e(payload.customerName||'Customer')}</p>
    <p>Total: <strong>€${e(total)}</strong></p>
    <p><a href="${e(dashboardUrl)}">Open supplier dashboard</a></p>
  </body></html>`;
}

function renderSupplierActivationEmail(payload={}){
  const url=String(payload.activationUrl||PUBLIC_BASE_URL);
  return `<!doctype html><html><body style="margin:0;background:#f4f7f4;font-family:Arial,sans-serif;color:#172019"><table role="presentation" width="100%"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" style="max-width:620px;background:#fff;border-radius:18px;padding:28px"><tr><td><div style="font-size:22px;font-weight:800">RentInOrbit</div><h1>Your supplier profile is ready</h1><p>We prepared your RentInOrbit supplier profile and ${Number(payload.listingCount||0)} rental listing(s).</p><p>Activate your account, review the listings and confirm that they are still available. Nothing becomes public until you confirm it.</p><p><a href="${escapeEmailHtml(url)}" style="display:inline-block;padding:13px 18px;border-radius:10px;background:#173f2a;color:#fff;text-decoration:none;font-weight:700">Activate supplier account</a></p><p style="font-size:12px;color:#66706a">This secure activation link expires on ${escapeEmailHtml(payload.expiresAt||'the stated date')}.</p></td></tr></table></td></tr></table></body></html>`;
}
function renderSupplierFreshnessEmail(payload={}){
  const url=String(payload.dashboardUrl||`${PUBLIC_BASE_URL}/?view=supplier-listings`);
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#172019"><h2>Are your RentInOrbit listings still available?</h2><p>Confirm your listings so customers only see current availability.</p><p><a href="${escapeEmailHtml(url)}">Review and confirm listings</a></p><p>If they are not confirmed, stale listings are automatically hidden after 30 days.</p></body></html>`;
}
function renderSupplierResponseReminderEmail(payload={}){
  const url=String(payload.dashboardUrl||`${PUBLIC_BASE_URL}/?view=supplier-bookings`);
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#172019"><h2>Customer is waiting for your response</h2><p><strong>${escapeEmailHtml(payload.listingTitle||'Rental item')}</strong> · booking ${escapeEmailHtml(payload.bookingId||'')}</p><p>Please accept or decline the request before ${escapeEmailHtml(payload.dueAt||'the response deadline')}.</p><p><a href="${escapeEmailHtml(url)}">Open booking request</a></p><p>Repeated unanswered requests can automatically pause your listings to protect customers.</p></body></html>`;
}

function renderBookingReceivedEmail(payload={}){
  const fmt=v=>new Intl.NumberFormat('en',{style:'currency',currency:payload.currency||'EUR'}).format(Number(v||0));
  const url=payload.bookingUrl||(payload.accountBookingPath?`${PUBLIC_BASE_URL}${payload.accountBookingPath}`:PUBLIC_BASE_URL);
  return `<!doctype html><html><body style="margin:0;background:#f4f7f4;font-family:Arial,sans-serif;color:#172019"><table role="presentation" width="100%"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" style="max-width:620px;background:#fff;border-radius:18px;padding:28px"><tr><td>
  <div style="font-size:22px;font-weight:800">RentInOrbit</div><h1>Booking request received</h1>
  <p>Reference <strong>${escapeEmailHtml(payload.bookingId)}</strong></p>
  <p>Hi ${escapeEmailHtml(payload.customerName||'there')}, your request for <strong>${escapeEmailHtml(payload.listingTitle||'rental item')}</strong> has been received.</p>
  <table role="presentation" width="100%"><tr><td>Dates</td><td align="right"><strong>${escapeEmailHtml(payload.startDate)} → ${escapeEmailHtml(payload.endDate)}</strong></td></tr><tr><td>Quantity</td><td align="right"><strong>${escapeEmailHtml(payload.quantity)}</strong></td></tr><tr><td>Rental</td><td align="right"><strong>${fmt(payload.rentalSubtotal)}</strong></td></tr>${Number(payload.deliveryFee||0)>0?`<tr><td>Delivery</td><td align="right"><strong>${fmt(payload.deliveryFee)}</strong></td></tr>`:''}<tr><td>Total</td><td align="right"><strong>${fmt(payload.total)}</strong></td></tr></table>
  <p><strong>Next:</strong> ${escapeEmailHtml(payload.nextStep||'Supplier review pending')}</p><p><a href="${escapeEmailHtml(url)}" style="display:inline-block;padding:13px 18px;border-radius:10px;background:#173f2a;color:#fff;text-decoration:none;font-weight:700">View booking</a></p>
  <p style="font-size:12px;color:#66706a">For your security, do not forward a guest booking link.</p></td></tr></table></td></tr></table></body></html>`;
}


function renderBookingStatusEmail(payload={}){
  const url=payload.bookingUrl||(payload.accountBookingPath?`${PUBLIC_BASE_URL}${payload.accountBookingPath}`:PUBLIC_BASE_URL);
  const status=String(payload.status||'updated');
  const heading=status==='confirmed'?'Booking confirmed':status==='paid'?'Payment received':status==='declined'?'Booking declined':status==='cancelled'?'Booking cancelled':'Booking updated';
  return `<!doctype html><html><body style="margin:0;background:#f4f7f4;font-family:Arial,sans-serif;color:#172019"><table role="presentation" width="100%"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" style="max-width:620px;background:#fff;border-radius:18px;padding:28px"><tr><td><div style="font-size:22px;font-weight:800">RentInOrbit</div><h1>${escapeEmailHtml(heading)}</h1><p>Reference <strong>${escapeEmailHtml(payload.bookingId)}</strong></p><p>Your booking for <strong>${escapeEmailHtml(payload.listingTitle||'rental item')}</strong> is now <strong>${escapeEmailHtml(status)}</strong>.</p><p>${escapeEmailHtml(payload.message||'Open your booking for the latest details.')}</p><p><a href="${escapeEmailHtml(url)}" style="display:inline-block;padding:13px 18px;border-radius:10px;background:#173f2a;color:#fff;text-decoration:none;font-weight:700">${escapeEmailHtml(payload.ctaText||'Open RentInOrbit')}</a></p>${payload.paymentDueAt?`<p><strong>Payment deadline:</strong> ${escapeEmailHtml(payload.paymentDueAt)}</p>`:''}<p style="font-size:12px;color:#66706a">If you booked as a guest, use the secure View booking link in your original booking receipt.</p></td></tr></table></td></tr></table></body></html>`;
}
function queueBookingStatusEmail(booking,status,{message=''}={}){
  if(!booking?.customerEmail || !isEmail(booking.customerEmail)) return false;
  const listing=getFullRentalListing(booking.listingId);
  enqueueTransactionalEmail({
    recipient:booking.customerEmail,
    templateKey:`booking_${status}`,
    subject:`RentInOrbit · ${status==='confirmed'?'Booking confirmed — complete payment':status==='declined'?'Booking declined':status==='cancelled'?'Booking cancelled':'Booking updated'} · ${booking.bookingId}`,
    dedupeKey:`booking:${booking.bookingId}:status:${status}`,
    payload:{templateVersion:2,bookingId:booking.bookingId,listingTitle:listing?.title||'Rental item',status,message:status==='confirmed'?(message||'The supplier confirmed your rental. Complete payment before the payment window expires.'):message,bookingUrl:null,accountBookingPath:status==='confirmed'?`/?view=my-bookings&booking=${encodeURIComponent(booking.bookingId)}&pay=1`:'/?view=my-bookings',ctaText:status==='confirmed'?'Pay now':'Open RentInOrbit',paymentDueAt:status==='confirmed'?(booking.expiresAt||booking.expires_at||null):null} /* STAGING_CONFIRMED_EMAIL_CTA_V2 */
  });
  return true;
}


// V139 production transactional email worker. Explicitly disabled unless enabled by deployment config.
function renderTransactionalEmail(item){
  const key=String(item?.templateKey||''), payload=item?.payload||{};
  if(key==='supplier_booking_received') return renderSupplierBookingReceivedEmail(payload);
  if(key==='supplier_activation') return renderSupplierActivationEmail(payload);
  if(key==='supplier_freshness') return renderSupplierFreshnessEmail(payload);
  if(key==='supplier_response_reminder') return renderSupplierResponseReminderEmail(payload);
  if(key==='booking_received') return renderBookingReceivedEmail(payload);
  if(key.startsWith('booking_')) return renderBookingStatusEmail(payload);
  throw new Error(`Unsupported email template: ${key}`);
}
async function deliverTransactionalEmail(item){
  const provider=String(process.env.EMAIL_PROVIDER||'console').toLowerCase();
  const from=String(process.env.EMAIL_FROM||'').trim();
  if(provider==='console'){
    if(process.env.NODE_ENV==='production') throw new Error('Console email provider is forbidden in production worker mode');
    console.log(JSON.stringify({type:'email.preview',id:item.id,to:item.recipient,template:item.templateKey}));
    return {provider:'console',id:`console-${item.id}`};
  }
  if(provider==='resend'){
    const apiKey=String(process.env.RESEND_API_KEY||'').trim();
    if(!apiKey||!from) throw new Error('RESEND_API_KEY and EMAIL_FROM are required');
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({from,to:[item.recipient],subject:item.subject,html:renderTransactionalEmail(item)})});
    const text=await response.text();let body={};try{body=JSON.parse(text)}catch{}
    if(!response.ok) throw new Error(`Email provider rejected request (${response.status}): ${String(body?.message||text||'unknown error').slice(0,300)}`);
    return {provider:'resend',id:body?.id||null};
  }
  throw new Error(`Unsupported EMAIL_PROVIDER: ${provider}`);
}
let emailWorkerBusy=false;
async function processTransactionalEmailOutbox(){
  if(emailWorkerBusy)return {processed:0,busy:true};emailWorkerBusy=true;
  const maxAttempts=Math.max(1,Math.min(20,Number(process.env.EMAIL_MAX_ATTEMPTS)||5)),batchSize=Math.max(1,Math.min(50,Number(process.env.EMAIL_WORKER_BATCH_SIZE)||10));
  let processed=0,sent=0,failed=0;
  try{
    const items=claimTransactionalEmails({limit:batchSize,maxAttempts});
    for(const item of items){processed++;try{await deliverTransactionalEmail(item);completeTransactionalEmail(item.id);sent++;}catch(err){failTransactionalEmail(item.id,err?.message||'Delivery failed',{maxAttempts});failed++;console.warn(JSON.stringify({type:'email.delivery_failed',id:item.id,template:item.templateKey,error:String(err?.message||err).slice(0,300)}));}}
    return {processed,sent,failed};
  }finally{emailWorkerBusy=false}
}
function calculateAuthoritativeRentalPrice(listing,startDate,endDate,quantity){
  const {days}=validateAvailabilityWindow(startDate,endDate);
  const qty=validateRequestedQuantity(quantity);
  const day=Math.max(0,Number(listing?.priceDay||0));
  const week=Math.max(0,Number(listing?.priceWeek||0));
  if(!Number.isFinite(day) || day<=0) throw new Error('Listing has no valid daily price');
  const dailyTotal=days*day;
  const weekMix=week>0 ? Math.floor(days/7)*week+(days%7)*day : dailyTotal;
  return {days,quantity:qty,rental:Number((Math.min(dailyTotal,weekMix)*qty).toFixed(2))};
}
function calculateAuthoritativeBookingTotal(listing,input){
  const price=calculateAuthoritativeRentalPrice(listing,input.startDate,input.endDate,input.quantity);
  const pickupOnly=listing?.delivery==='Pickup only' || !(listing?.accommodationDelivery==='yes' || listing?.accommodationDelivery===true);
  const deliveryRequested=pickupOnly
    ? Boolean(String(input.deliveryAddress||input.accommodationName||'').trim())
    : Boolean(String(input.deliveryCity||input.deliveryAddress||input.accommodationName||'').trim());
  let delivery=0;
  if(deliveryRequested){
    if(listing?.delivery==='Pickup only' || !(listing?.accommodationDelivery==='yes' || listing?.accommodationDelivery===true))
      throw new Error('Delivery is not available for this listing');
    const city=String(input.deliveryCity||'').trim().toLocaleLowerCase('lt');
    const serviceCities=Array.isArray(listing?.deliveryZones)
      ?listing.deliveryZones
      :String(listing?.deliveryZones||'').split(',');
    const allowedCities=serviceCities.map(value=>String(value||'').trim().toLocaleLowerCase('lt')).filter(Boolean);
    if(!allowedCities.length && listing?.city)allowedCities.push(String(listing.city).trim().toLocaleLowerCase('lt'));
    if(!city || !allowedCities.includes(city))throw new Error('Delivery is not available in the selected city');
    if(!String(input.deliveryAddress||'').trim())throw new Error('Delivery address is required');
    const minOrder=Math.max(0,Number(listing?.minOrder||0));
    if(price.rental<minOrder) throw new Error(`Minimum rental subtotal for delivery is €${minOrder.toFixed(2)}`);
    delivery=Math.max(0,Number(listing?.hotelDeliveryFee||0));
  }
  const securityDeposit=Math.max(0,Number(listing?.deposit||0));
  return {...price,delivery,securityDeposit,total:Number((price.rental+delivery).toFixed(2)),
    paymentExposure:Number((price.rental+delivery+securityDeposit).toFixed(2))};
}

function validateSupplierListingInput(listing){
  if(!listing || typeof listing!=='object') throw new Error('Invalid listing');
  const title=String(listing.title||'').trim();
  const city=String(listing.city||'').trim();
  const quantity=Number(listing.quantity);
  const priceDay=Number(listing.priceDay);
  if(title.length<3 || title.length>120) throw new Error('Listing title must be 3–120 characters');
  if(city.length<2 || city.length>100) throw new Error('Valid city is required');
  if(!Number.isInteger(quantity) || quantity<1 || quantity>100000) throw new Error('Quantity must be between 1 and 100000');
  if(!Number.isFinite(priceDay) || priceDay<0 || priceDay>1000000) throw new Error('Invalid daily price');
  if(listing.latitude!=null && (Number(listing.latitude)<-90 || Number(listing.latitude)>90)) throw new Error('Invalid latitude');
  if(listing.longitude!=null && (Number(listing.longitude)<-180 || Number(listing.longitude)>180)) throw new Error('Invalid longitude');
  const photos=Array.isArray(listing.photos)?listing.photos:[];
  // New public listings require 2-5 successfully uploaded images. The
  // validation applies to real supplier API requests, not pre-existing rows.
  if(photos.length<2||photos.length>5)
    throw Object.assign(new Error('Skelbimui reikia nuo 2 iki 5 nuotraukų.'),{code:'LISTING_PHOTOS_REQUIRED'});
  for(const photo of photos){
    if(typeof photo!=='string' || !/^\/uploads\/[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp)$/.test(photo))
      throw Object.assign(new Error('Nuotrauka turi būti įkelta per saugų failų įkėlimą.'),{code:'LISTING_PHOTO_INVALID'});
    if(!fs.existsSync(path.join(runtimeConfig.uploadsDir,path.basename(photo))))
      throw Object.assign(new Error('Nuotraukos failas nerastas. Įkelk jį iš naujo.'),{code:'LISTING_PHOTO_MISSING'});
  }
  if(listing.coverPhoto && listing.coverPhoto!==photos[0])
    throw Object.assign(new Error('Pagrindinė nuotrauka turi sutapti su pirmąja.'),{code:'LISTING_PHOTO_INVALID'});
  return {
    ...listing,
    title,
    city,
    description:String(listing.description||'').slice(0,3000),
    photos,
    coverPhoto:photos[0],
    quantity,
    priceDay,
    priceWeek:Math.max(0,Number(listing.priceWeek||0)),
    deposit:Math.max(0,Number(listing.deposit||0))
  };
}

app.get('/api/listings', simpleRateLimit({windowMs:60000,max:180,keyPrefix:'public-listings'}), (req,res)=>{
  res.json({listings:listPublicRentalListings()});
});

app.get('/api/supplier/listings', requireRole('supplier','admin'), (req,res)=>{
  res.json({listings:listOwnerRentalListings(req.appUser.email)});
});

app.post('/api/supplier/listings', requireRole('supplier','admin'), (req,res)=>{
  try{
    const safeListing=validateSupplierListingInput(req.body?.listing||{});
    const payoutConnection=getDirectMerchantConnectionByEmail(db,req.appUser.email);
    const payoutVerified=directMerchantReady(payoutConnection);
    if(safeListing.bookingMode==='instant' && req.appUser.role!=='admin' && !payoutVerified){
      return res.status(409).json({error:'Instant Book is available after payout identity/account verification is complete.',code:'INSTANT_BOOK_REQUIRES_VERIFICATION'});
    }
    ensureSupplierOnboarding(req.appUser.email,{active:true});
    const listing=saveFullRentalListing({...safeListing,lifecycleStatus:'active',availabilityConfirmedAt:new Date().toISOString()},req.appUser.email);
    // Keep inventory/availability table in sync.
    upsertRentalListing({
      listingId:listing.id,
      ownerEmail:req.appUser.email,
      title:listing.title,
      totalQuantity:Number(listing.quantity||0),
      cancellationPolicy:listing.cancellationPolicy||'moderate'
    });
    res.json({listing});
  }catch(err){res.status(400).json({error:err.message});}
});

// Retain booking/payment audit history and remove only the public listing.
app.post('/api/supplier/listings/:listingId/archive', requireRole('supplier','admin'), (req,res)=>{
  try{
    const listing=archiveOwnerRentalListing(req.params.listingId,req.appUser.email);
    if(!listing)return res.status(404).json({error:'Skelbimas nerastas arba nepriklauso šiai paskyrai.'});
    res.json({ok:true,listingId:listing.id,archived:true});
  }catch(err){res.status(400).json({error:'Nepavyko pašalinti skelbimo iš viešos paieškos.'});}
});

app.delete('/api/supplier/listings/:listingId', requireRole('supplier','admin'), (req,res)=>{
  const ok=deleteOwnerRentalListing(req.params.listingId,req.appUser.email);
  if(!ok) return res.status(404).json({error:'Listing not found'});
  res.json({ok:true});
});

// V135 production diagnostics: safe operational signal, never secrets.
app.get('/api/ops/status',(req,res)=>{
  const gate=launchGate();
  const database=checkDatabase();
  const checks={
    runtime:{ok:runtimeConfig.production,detail:runtimeConfig.nodeEnv},
    stripe:{ok:gate.stripe.configured&&['test','live'].includes(gate.stripe.mode),detail:gate.stripe.configured?`${gate.stripe.mode}-${gate.stripe.keyType}`:'missing'},
    database:{ok:database.ok&&(!runtimeConfig.production||database.persistent),detail:database.ok?`${database.driver}-${database.source}`:'unavailable'},
    maps:{ok:Boolean(process.env.MAPS_PUBLIC_TOKEN),detail:process.env.MAPS_PUBLIC_TOKEN?(process.env.MAPS_PROVIDER||'configured'):'stub'},
    notifications:{ok:Boolean(process.env.EMAIL_PROVIDER&&process.env.EMAIL_PROVIDER!=='console'),detail:process.env.EMAIL_PROVIDER||'console'},emailWorker:{ok:process.env.EMAIL_WORKER_ENABLED==='true',detail:process.env.EMAIL_WORKER_ENABLED==='true'?'enabled':'disabled'}
  };
  const productionReady=gate.ready&&checks.runtime.ok&&checks.stripe.ok&&checks.database.ok&&checks.notifications.ok&&checks.emailWorker.ok;
  res.set('Cache-Control','no-store');
  res.status(productionReady||!runtimeConfig.production?200:503).json({ok:productionReady,checks,version:APP_VERSION});
});

// V130 non-secret integration capability contract.
app.get('/api/integrations/capabilities',(req,res)=>{
 res.set('Cache-Control','no-store');
 res.json({maps:{provider:process.env.MAPS_PROVIDER||'stub',configured:Boolean(process.env.MAPS_PUBLIC_TOKEN),mode:process.env.MAPS_PUBLIC_TOKEN?'live':'stub'},email:{provider:process.env.EMAIL_PROVIDER||'console',configured:Boolean(process.env.EMAIL_PROVIDER&&process.env.EMAIL_PROVIDER!=='console')},sms:{provider:process.env.SMS_PROVIDER||'disabled',configured:Boolean(process.env.SMS_PROVIDER&&process.env.SMS_PROVIDER!=='disabled')},push:{provider:process.env.PUSH_PROVIDER||'disabled',configured:Boolean(process.env.PUSH_PROVIDER&&process.env.PUSH_PROVIDER!=='disabled')},environment:process.env.NODE_ENV||'development'});
});

// V125 non-secret production readiness.
app.get('/healthz',(req,res)=>res.status(shuttingDown?503:200).json({ok:!shuttingDown,service:'rentinorbit',version:APP_VERSION}));

app.get('/api/readiness',(req,res)=>{
  res.set('Cache-Control','no-store');
  const gate=launchGate();
  res.status(gate.ready?200:503).json({ready:gate.ready,environment:runtimeConfig.nodeEnv,checks:gate.checks,blocking:gate.blocking,database:gate.database,stripe:gate.stripe,email:gate.email,version:APP_VERSION});
});

// Stripe Connect for authenticated suppliers — V195 direct-charge merchant model.
function directStatusResponse(status,{demo=false}={}){
  const reqs=Array.isArray(status?.requirements)?status.requirements:[];
  const currentlyDue=reqs.map(entry=>{
    if(typeof entry==='string') return entry;
    // Accounts v2 requirement entries expose the actionable field path in
    // `description` (for example `identity.individual.phone`).  Treating a
    // missing legacy `reference` as "nothing due" incorrectly marked fresh
    // restricted accounts as submitted and hid the exact onboarding work.
    return entry?.description || entry?.reference || entry?.type || entry?.reason || null;
  }).filter(Boolean);
  const active=String(status?.merchantCapabilityStatus||'')==='active';
  return {
    ...status,
    detailsSubmitted:active || currentlyDue.length===0,
    payoutsEnabled:active,
    currentlyDue,
    demo
  };
}

app.post('/api/stripe/connect/create-account', requireRole('supplier','admin'), async (req,res)=>{
  try{
    if(demoPaymentsEnabled){
      const existing=getStripeConnectionByUserId(req.appUser.userId);
      const saved=existing||saveStripeConnection({userId:req.appUser.userId,userEmail:req.appUser.email,stripeAccountId:`acct_demo_${req.appUser.userId}`,connectApi:'demo_merchant_direct',transferCapabilityStatus:'not_applicable',requirements:[]});
      return res.json({accountId:saved.stripeAccountId,state:'active',connectApi:'demo_merchant_direct',merchantCapabilityStatus:'active',detailsSubmitted:true,payoutsEnabled:true,demo:true});
    }
    if(!stripe) return res.status(503).json({error:'Stripe is not configured'});
    const country=String(req.body?.country||req.appUser.country||'').trim().toUpperCase();
    const legalEntityType=String(req.body?.legalEntityType||'').trim().toLowerCase();
    if(!/^[A-Z]{2}$/.test(country)) return res.status(400).json({error:'A 2-letter supplier country code is required'});
    if(!['individual','company'].includes(legalEntityType)) return res.status(400).json({error:'Choose whether the supplier is an individual or company'});

    let existing=getDirectMerchantConnectionByUserId(db,req.appUser.userId);
    if(existing){
      if(String(existing.connectApi||'')!=='v2_merchant_direct'){
        return res.status(409).json({error:'This supplier has a legacy Stripe connection. The new Direct Charges preview is available only to newly onboarded accounts.',code:'LEGACY_CONNECT_ACCOUNT_NOT_ELIGIBLE'});
      }
      const account=await retrieveDirectMerchantAccountV2(stripe,existing.stripeAccountId);
      const parsed=directMerchantCapabilityStatus(account);
      saveDirectMerchantMetadata(db,{userId:req.appUser.userId,accountId:existing.stripeAccountId,merchantCapabilityStatus:parsed.merchantCapabilityStatus,dashboard:parsed.dashboard,feesCollector:parsed.feesCollector,lossesCollector:parsed.lossesCollector,onboardingStatus:parsed.state==='active'?'complete':'pending',requirements:parsed.requirements});
      return res.json(directStatusResponse(parsed));
    }

    // A row from an older Connect implementation must not be silently repurposed;
    // Express + Stripe-owned losses is a new-accounts-only public preview path.
    const legacy=getStripeConnectionByUserId(req.appUser.userId);
    if(legacy){
      return res.status(409).json({error:'This supplier already has a legacy Stripe account. Create a fresh supplier test account for the Direct Charges preview.',code:'LEGACY_CONNECT_ACCOUNT_NOT_ELIGIBLE'});
    }

    const account=await createDirectMerchantAccountV2(stripe,{
      email:req.appUser.email,
      displayName:req.appUser.businessName || req.appUser.displayName || req.appUser.email,
      country,
      legalEntityType
    });
    saveStripeConnection({userId:req.appUser.userId,userEmail:req.appUser.email,stripeAccountId:account.id,connectApi:'v2_merchant_direct',transferCapabilityStatus:'not_applicable',requirements:[]});
    const parsed=directMerchantCapabilityStatus(account);
    saveDirectMerchantMetadata(db,{userId:req.appUser.userId,accountId:account.id,merchantCapabilityStatus:parsed.merchantCapabilityStatus,dashboard:'express',feesCollector:'stripe',lossesCollector:'stripe',onboardingStatus:parsed.state==='active'?'complete':'pending',country,entityType:legalEntityType,requirements:parsed.requirements});
    res.json(directStatusResponse(parsed));
  }catch(err){
    console.warn('Stripe connected account creation failed',err.message);
    res.status(400).json({error:process.env.NODE_ENV==='production'?'Unable to create Stripe connected account':err.message});
  }
});

app.post('/api/stripe/connect/onboarding-link', requireRole('supplier','admin'), async (req,res)=>{
  try{
    if(demoPaymentsEnabled) return res.json({demo:true,state:'active',clientSecret:null,mode:'demo'});
    if(!stripe) return res.status(503).json({error:'Stripe is not configured'});
    const connection=getDirectMerchantConnectionByUserId(db,req.appUser.userId);
    if(!connection) return res.status(404).json({error:'No connected account'});
    if(String(connection.connectApi||'')!=='v2_merchant_direct') return res.status(409).json({error:'Supplier account requires a new Direct Charges Connect account.',code:'SUPPLIER_CONNECT_V2_DIRECT_REQUIRED'});
    const session=await createEmbeddedOnboardingSession(stripe,connection.stripeAccountId);
    res.json({accountId:connection.stripeAccountId,clientSecret:session.client_secret,mode:'embedded'});
  }catch(err){res.status(400).json({error:process.env.NODE_ENV==='production'?'Unable to start Stripe onboarding':err.message});}
});

app.post('/api/stripe/connect/hosted-onboarding-link', requireRole('supplier','admin'), async (req,res)=>{
  try{
    if(demoPaymentsEnabled) return res.json({demo:true,state:'active',url:null});
    if(!stripe) return res.status(503).json({error:'Stripe is not configured'});
    const connection=getDirectMerchantConnectionByUserId(db,req.appUser.userId);
    if(!connection) return res.status(404).json({error:'No connected account'});
    if(String(connection.connectApi||'')!=='v2_merchant_direct') return res.status(409).json({error:'Supplier account requires a new Direct Charges Connect account.',code:'SUPPLIER_CONNECT_V2_DIRECT_REQUIRED'});
    const origin=publicOrigin(req);
    const link=await createHostedOnboardingLink(stripe,connection.stripeAccountId,{
      refreshUrl:`${origin}/?view=supplier-payouts&stripe_onboarding=refresh`,
      returnUrl:`${origin}/?view=supplier-payouts&stripe_onboarding=return`
    });
    res.json({url:link.url,expiresAt:link.expires_at||null,mode:'hosted'});
  }catch(err){res.status(400).json({error:process.env.NODE_ENV==='production'?'Unable to start Stripe onboarding':err.message});}
});

app.post('/api/stripe/connect/login-link', requireRole('supplier','admin'), async (req,res)=>{
  try{
    if(demoPaymentsEnabled) return res.json({demo:true,state:'active',url:null});
    if(!stripe) return res.status(503).json({error:'Stripe is not configured'});
    const connection=getDirectMerchantConnectionByUserId(db,req.appUser.userId);
    if(!connection) return res.status(404).json({error:'No connected account'});
    if(String(connection.connectApi||'')!=='v2_merchant_direct') return res.status(409).json({error:'Supplier account requires Direct Charges migration.',code:'SUPPLIER_CONNECT_V2_DIRECT_REQUIRED'});
    const link=await createExpressLoginLink(stripe,connection.stripeAccountId);
    res.json({url:link.url});
  }catch(err){res.status(400).json({error:process.env.NODE_ENV==='production'?'Unable to open Stripe Dashboard':err.message});}
});

app.get('/api/stripe/connect/status', requireRole('supplier','admin'), async (req,res)=>{
  try{
    if(demoPaymentsEnabled){
      let connection=getStripeConnectionByUserId(req.appUser.userId);
      if(!connection) connection=saveStripeConnection({userId:req.appUser.userId,userEmail:req.appUser.email,stripeAccountId:`acct_demo_${req.appUser.userId}`,connectApi:'demo_merchant_direct',transferCapabilityStatus:'not_applicable',requirements:[]});
      return res.json({accountId:connection.stripeAccountId,state:'active',connectApi:'demo_merchant_direct',merchantCapabilityStatus:'active',detailsSubmitted:true,payoutsEnabled:true,demo:true});
    }
    if(!stripe) return res.status(503).json({error:'Stripe is not configured'});
    const connection=getDirectMerchantConnectionByUserId(db,req.appUser.userId);
    if(!connection) return res.json({state:'not_created',connectApi:'v2_merchant_direct_target',detailsSubmitted:false,payoutsEnabled:false});
    if(String(connection.connectApi||'')!=='v2_merchant_direct') return res.json({accountId:connection.stripeAccountId,state:'migration_required',connectApi:connection.connectApi,detailsSubmitted:false,payoutsEnabled:false});
    const account=await retrieveDirectMerchantAccountV2(stripe,connection.stripeAccountId);
    const status=directMerchantCapabilityStatus(account);
    saveDirectMerchantMetadata(db,{userId:req.appUser.userId,accountId:connection.stripeAccountId,merchantCapabilityStatus:status.merchantCapabilityStatus,dashboard:status.dashboard,feesCollector:status.feesCollector,lossesCollector:status.lossesCollector,onboardingStatus:status.state==='active'?'complete':'pending',requirements:status.requirements});
    res.json(directStatusResponse(status));
  }catch(err){res.status(500).json({error:process.env.NODE_ENV==='production'?'Unable to retrieve Stripe account status':err.message});}
});

// Staging-only, read-only supplier/Stripe binding audit. No email, token,
// credentials, database mutation or third-party Stripe request.
app.get('/api/stripe/connect/booking-binding/:bookingId', requireRole('supplier','admin'), (req,res)=>{
  if(process.env.RENTINORBIT_STAGING!=='true') return res.status(404).json({error:'Not found'});
  const bookingId=String(req.params.bookingId||'');
  if(!canSupplierManageBooking(req.appUser,bookingId)) return res.status(404).json({error:'Booking not found'});
  const booking=getRentalBookingById(bookingId);
  const listing=booking?getRentalListing(booking.listingId):null;
  if(!booking||!listing) return res.status(404).json({error:'Booking not found'});
  const ownerConnection=getDirectMerchantConnectionByEmail(db,listing.ownerEmail);
  const loggedInConnection=getDirectMerchantConnectionByUserId(db,req.appUser.userId);
  const supplierOwnsListing=String(req.appUser.email||'').toLowerCase()===String(listing.ownerEmail||'').toLowerCase();
  const sameConnection=!!ownerConnection&&!!loggedInConnection&&
    ownerConnection.userId===loggedInConnection.userId&&
    ownerConnection.stripeAccountId===loggedInConnection.stripeAccountId;
  res.setHeader('Cache-Control','private, no-store');
  res.json({
    bookingId,
    bookingStatus:booking.status,
    paymentStatus:booking.paymentStatus,
    bookingHasPaymentIntent:Boolean(booking.stripePaymentIntentId),
    supplierOwnsListing,
    hasOwnerStripeConnection:Boolean(ownerConnection),
    ownerStripeAccountLast4:ownerConnection?.stripeAccountId?.slice(-4)||null,
    ownerConnectApi:ownerConnection?.connectApi||null,
    ownerDirectChargeReady:directMerchantReady(ownerConnection),
    loggedInStripeConnectionMatchesOwner:supplierOwnsListing?sameConnection:null,
    note:'This report uses current staging database bindings, not a live Stripe capability query.'
  });
});

// Admin-only provider-state bridge for test fixtures and recovery tooling.
// Only an authoritative, server-side Stripe response may change capabilities.
// Never accept a caller-supplied account object as proof that payments are active.
app.post('/api/admin/stripe/connect/v2-capability-sync', requireRole('admin'), async (req,res)=>{
  try{
    if(process.env.RENTINORBIT_STAGING!=='true') return res.status(404).json({error:'Not found'});
    if(!stripe) return res.status(503).json({error:'Stripe is not configured'});
    const userId=String(req.body?.userId||'').trim();
    if(!userId) return res.status(400).json({error:'userId is required'});
    const existing=getDirectMerchantConnectionByUserId(db,userId);
    if(!existing) return res.status(404).json({error:'Stripe connection not found'});
    if(String(existing.connectApi)!=='v2_merchant_direct') return res.status(409).json({error:'Legacy account cannot be automatically converted'});
    const account=await retrieveDirectMerchantAccountV2(stripe,existing.stripeAccountId);
    if(String(account?.id||'')!==String(existing.stripeAccountId)) return res.status(409).json({error:'Stripe account does not match supplier'});
    const status=directMerchantCapabilityStatus(account);
    const saved=saveDirectMerchantMetadata(db,{userId,accountId:existing.stripeAccountId,merchantCapabilityStatus:status.merchantCapabilityStatus,dashboard:status.dashboard,feesCollector:status.feesCollector,lossesCollector:status.lossesCollector,onboardingStatus:status.state==='active'?'complete':'pending',requirements:status.requirements});
    res.setHeader('Cache-Control','no-store, private');
    res.json({ok:true,status,saved:{userId:saved?.userId,accountId:saved?.stripeAccountId,connectApi:saved?.connectApi,merchantCapabilityStatus:saved?.merchantCapabilityStatus}});
  }catch(err){
    console.warn('Stripe account capability sync failed',safeOperationalError(err));
    res.status(502).json({error:'Could not verify supplier capability with Stripe'});
  }
});

app.post('/api/payments/deposit-intent', simpleRateLimit({windowMs:60000,max:12,keyPrefix:'deposit-payment'}), requireStripe, async (req,res)=>{
  try{
    const {bookingId,accessToken}=req.body||{}; if(!bookingId)return res.status(400).json({error:'bookingId is required'});
    const booking=getRentalBookingById(bookingId); if(!booking)return res.status(404).json({error:'Booking not found'});
    const user=sessionUser(req);
    const accountOwner=!!(user?.email&&String(user.email).toLowerCase()===String(booking.customerEmail||'').toLowerCase());
    const guestOwner=!user&&!!verifyBookingPaymentToken(bookingId,accessToken);
    if(!accountOwner&&!guestOwner)return res.status(403).json({error:'Booking access denied'});
    // Security-deposit holds must not precede supplier approval or rental payment.
    if(booking.status!=='confirmed')return res.status(409).json({error:'Supplier confirmation required before deposit authorization',code:'SUPPLIER_CONFIRMATION_REQUIRED'});
    if(booking.paymentStatus!=='paid')return res.status(409).json({error:'Rental must be paid before deposit authorization',code:'RENTAL_PAYMENT_REQUIRED'});
    const amount=Math.round(Math.max(0,Number(booking.securityDepositAmount||0))*100);
    if(amount<=0)return res.status(409).json({error:'This booking does not require a security deposit'});
    const listing=getRentalListing(booking.listingId);
    const connection=getDirectMerchantConnectionByEmail(db,listing?.ownerEmail);
    if(!connection || !requireSupplierDirectChargeCapability(connection,res)) return;
    let intent;
    if(booking.securityDepositPaymentIntentId){
      intent=await retrieveDirectChargePaymentIntent(stripe,{accountId:connection.stripeAccountId,paymentIntentId:booking.securityDepositPaymentIntentId});
      if(String(intent.metadata?.bookingId||'')!==String(bookingId)||String(intent.metadata?.purpose||'')!=='security_deposit'||Number(intent.amount)!==amount||String(intent.currency||'').toLowerCase()!=='eur')
        return res.status(409).json({error:'Stored deposit authorization does not match this booking'});
    }else{
      intent=await createDirectSecurityDepositIntent(stripe,{accountId:connection.stripeAccountId,amountCents:amount,bookingId,listingId:booking.listingId,idempotencyKey:`booking:${bookingId}:security-deposit`});
    }
    const depositStatus=intent.status==='requires_capture'?'authorized':'authorization_pending';
    setRentalSecurityDepositProviderState(bookingId,{paymentIntentId:intent.id,providerStatus:intent.status,depositStatus});
    res.json({clientSecret:intent.client_secret,paymentIntentId:intent.id,stripeAccountId:connection.stripeAccountId,status:intent.status,depositStatus,amount:amount/100,currency:'eur'});
  }catch(err){console.warn('Deposit authorization failed',err.message);res.status(400).json({error:process.env.NODE_ENV==='production'?'Unable to prepare security deposit':err.message});}
});

async function processExpiredBookings(){
  const expiredIds=expireStalePendingBookings();
  for(const bookingId of expiredIds){
    try{
      const booking=getRentalBookingById(bookingId); if(!booking)continue;
      const listing=getRentalListing(booking.listingId);
      const connection=getDirectMerchantConnectionByEmail(db,listing?.ownerEmail);
      if(stripe && connection?.stripeAccountId && booking.stripePaymentIntentId && booking.paymentStatus!=='paid'){
        const pi=await retrieveDirectChargePaymentIntent(stripe,{accountId:connection.stripeAccountId,paymentIntentId:booking.stripePaymentIntentId});
        if(new Set(['requires_payment_method','requires_confirmation','requires_action','requires_capture']).has(pi.status)){
          await cancelDirectChargePaymentIntent(stripe,{accountId:connection.stripeAccountId,paymentIntentId:pi.id,idempotencyKey:`booking:${bookingId}:expiry-payment-cancel`});
        }
      }
      if(stripe && connection?.stripeAccountId && booking.securityDepositPaymentIntentId && !['released','captured'].includes(booking.securityDepositStatus)){
        const dpi=await retrieveDirectChargePaymentIntent(stripe,{accountId:connection.stripeAccountId,paymentIntentId:booking.securityDepositPaymentIntentId});
        if(dpi.status==='requires_capture') await cancelDirectChargePaymentIntent(stripe,{accountId:connection.stripeAccountId,paymentIntentId:dpi.id,idempotencyKey:`booking:${bookingId}:expiry-deposit-cancel`});
        setRentalSecurityDepositProviderState(bookingId,{paymentIntentId:dpi.id,providerStatus:dpi.status==='requires_capture'?'canceled':dpi.status,depositStatus:'released'});
        resolveRentalSecurityDeposit(bookingId,{status:'released',resolution:'Booking expired before completion; deposit authorization released.'});
      }
      if(booking.customerEmail)createRentalNotification({uniqueKey:`booking:${bookingId}:expired:customer`,audience:'customer',userEmail:booking.customerEmail,bookingId,type:'booking.expired',title:'Booking request expired',message:'This booking request expired before payment/confirmation was completed. No active reservation remains.'});
      if(listing?.ownerEmail)createRentalNotification({uniqueKey:`booking:${bookingId}:expired:supplier`,audience:'supplier',userEmail:listing.ownerEmail,bookingId,type:'booking.expired',title:'Booking request expired',message:`The pending request for ${listing.title} expired and its availability has been released.`});
    }catch(err){console.warn('Expired booking cleanup failed',bookingId,err.message)}
  }
  return expiredIds;
}
const BOOKING_EXPIRY_SWEEP_MS=Math.max(60000,Number(process.env.BOOKING_EXPIRY_SWEEP_MS||60000));
const bookingExpiryTimer=setInterval(()=>processExpiredBookings().catch(err=>console.warn('Booking expiry sweep failed',err.message)),BOOKING_EXPIRY_SWEEP_MS);
bookingExpiryTimer.unref?.();

app.post('/api/payments/create-intent', simpleRateLimit({windowMs:60000,max:20,keyPrefix:'payment'}), async (req,res)=>{
  try{
    await processExpiredBookings();
    const {bookingId,paymentToken}=req.body||{};
    const booking=getRentalBookingById(bookingId);
    if(!booking) return res.status(404).json({error:'Booking not found'});
    const paymentUser=sessionUser(req);
    const accountOwner=!!(paymentUser?.email&&String(paymentUser.email).toLowerCase()===String(booking.customerEmail||'').toLowerCase());
    const guestOwner=!paymentUser&&!!verifyBookingPaymentToken(bookingId,paymentToken);
    if(!accountOwner&&!guestOwner) return res.status(403).json({error:'Booking access denied'}); /* STAGING_PAYMENT_OWNER_ACCESS_V2 */
    if(!['pending','confirmed'].includes(booking.status)){
      return res.status(409).json({error:`Booking cannot be paid in status ${booking.status}`});
    }
    // A successfully paid booking must never re-enter checkout, even if its
    // lifecycle status is still 'confirmed'. Reject before touching Stripe.
    if(['paid','succeeded','refunded','partially_refunded'].includes(String(booking.paymentStatus||'').toLowerCase()) || booking.stripeRefundId){
      return res.status(409).json({error:'This booking has already been paid or refunded',code:'BOOKING_PAYMENT_FINAL'});
    }

    const listing=getRentalListing(booking.listingId);
    // Payment, authorization and Stripe intent creation are forbidden until
    // the supplier confirms a request booking, in ALL environments.
    const preauthorizeRequest=false;
    if(booking.status!=='confirmed'){
      return res.status(409).json({error:'Supplier confirmation is required before payment.',code:'SUPPLIER_CONFIRMATION_REQUIRED'});
    }
    const amount=Math.round(Number(booking.orderValue||0)*100);
    if(amount<50) return res.status(400).json({error:'Booking amount is too small'});

    // An existing Stripe intent must retain the commission agreed when it
    // was created. A supplier plan change must not invalidate an in-flight
    // customer payment or rewrite its original accounting.
    const storedPricing=booking.stripePaymentIntentId?getBookingPricingSnapshot(db,booking.bookingId):null;
    const currentPricing=calculateBookingPricingForSupplier(db,{supplierEmail:listing?.ownerEmail,bookingAmountCents:amount});
    const pricing=storedPricing||currentPricing;
    if(storedPricing && (
      Number(storedPricing.bookingAmountCents)!==amount ||
      Number(storedPricing.commissionAmountCents)<0 ||
      !Number.isSafeInteger(Number(storedPricing.commissionAmountCents)) ||
      Number(storedPricing.supplierAmountCents)!==amount-Number(storedPricing.commissionAmountCents) ||
      String(storedPricing.currency||'').toLowerCase()!=='eur'
    )) return res.status(409).json({error:'Stored booking pricing does not match the booking',code:'BOOKING_PRICING_MISMATCH'});
    const platformFee=pricing.commissionAmountCents;
    const supplierAmount=pricing.supplierAmountCents;
    if(demoPaymentsEnabled){
      const paymentIntentId=booking.stripePaymentIntentId?.startsWith('demo_pi_')?booking.stripePaymentIntentId:`demo_pi_${crypto.randomUUID()}`;
      saveBookingPricingSnapshot(db,{bookingId:booking.bookingId,pricing});
      const updated=setBookingPaymentDetails({bookingId:booking.bookingId,paymentIntentId,paymentStatus:'requires_payment_method',platformFeeAmount:platformFee/100,supplierAmount:supplierAmount/100,paymentProvider:'demo'});
      setBookingPayoutDetails(booking.bookingId,{status:'pending',amount:supplierAmount/100,reference:`demo_po_${booking.bookingId}`});
      return res.json({provider:'demo',demo:true,paymentIntentId,status:updated.paymentStatus,amount:amount/100,platformFee:platformFee/100,supplierAmount:supplierAmount/100,securityDeposit:Number(booking.securityDepositAmount||0)});
    }
    if(!stripe) return res.status(503).json({error:'Stripe is not configured'});
    const connection=getDirectMerchantConnectionByEmail(db,listing?.ownerEmail);
    if(!connection) return res.status(409).json({error:'Supplier has not connected Stripe yet'});
    if(!requireSupplierDirectChargeCapability(connection,res)) return;

    let intent;
    if(booking.stripePaymentIntentId){
      intent=await retrieveDirectChargePaymentIntent(stripe,{accountId:connection.stripeAccountId,paymentIntentId:booking.stripePaymentIntentId});
      const intentBookingId=String(intent.metadata?.bookingId||'');
      const intentPurpose=String(intent.metadata?.purpose||'');
      if(intentBookingId!==String(booking.bookingId) || Number(intent.amount)!==amount || String(intent.currency||'').toLowerCase()!=='eur' || intentPurpose!=='rental_payment' || Number(intent.application_fee_amount)!==platformFee){
        return res.status(409).json({error:'Stored payment intent does not match this booking'});
      }
      if(intent.status==='canceled') return res.status(409).json({error:'Payment intent was cancelled; create a new booking payment attempt'});
      if(preauthorizeRequest && intent.capture_method!=='manual') return res.status(409).json({error:'Existing payment intent is not an authorization',code:'PREAUTH_INTENT_MISMATCH'});
      saveBookingPricingSnapshot(db,{bookingId:booking.bookingId,pricing});
    }else{
      intent=await createDirectChargePaymentIntent(stripe,{
        accountId:connection.stripeAccountId,
        amountCents:amount,
        applicationFeeCents:platformFee,
        currency:'eur',
        idempotencyKey:`booking:${booking.bookingId}:rental-payment`,
        manualCapture:preauthorizeRequest,
        metadata:{bookingId:booking.bookingId,listingId:booking.listingId,purpose:'rental_payment',supplierEmail:String(listing?.ownerEmail||''),paymentFlow:preauthorizeRequest?'preauthorize_then_capture':'pay_after_confirmation'}
      });
      saveBookingPricingSnapshot(db,{bookingId:booking.bookingId,pricing});
      setBookingPaymentDetails({bookingId:booking.bookingId,paymentIntentId:intent.id,paymentStatus:intent.status,platformFeeAmount:platformFee/100,supplierAmount:supplierAmount/100,paymentProvider:'stripe'});
    }

    res.json({
      clientSecret:intent.client_secret,
      paymentIntentId:intent.id,
      stripeAccountId:connection.stripeAccountId,
      captureMethod:intent.capture_method,
      preauthorization:preauthorizeRequest || (intent.capture_method==='manual' && intent.metadata?.paymentFlow==='preauthorize_then_capture'),
      status:intent.status,
      amount:amount/100,
      platformFee:platformFee/100,
      supplierAmount:supplierAmount/100
    });
  }catch(err){
    console.warn('Payment intent creation failed',err.message);
    res.status(400).json({error:process.env.NODE_ENV==='production'?'Unable to prepare payment':err.message});
  }
});

app.post('/api/payments/demo/confirm', simpleRateLimit({windowMs:60000,max:30,keyPrefix:'demo-payment'}), async (req,res)=>{
  try{
    if(!demoPaymentsEnabled) return res.status(404).json({error:'Demo payments are disabled'});
    const {bookingId,paymentToken,outcome='succeeded'}=req.body||{};
    const user=sessionUser(req);
    const booking=getRentalBookingById(bookingId);
    if(!booking) return res.status(404).json({error:'Booking not found'});
    const accountOwner=!!(user?.email&&String(user.email).toLowerCase()===String(booking.customerEmail||'').toLowerCase());
    const guestOwner=!user&&!!verifyBookingPaymentToken(bookingId,paymentToken);
    if(!accountOwner&&!guestOwner) return res.status(403).json({error:'Booking access denied'});
    if(!['pending','confirmed'].includes(booking.status))
      return res.status(409).json({error:'Booking is no longer payable',code:'BOOKING_PAYMENT_FINAL'});
    if(['paid','succeeded','refunded','partially_refunded'].includes(String(booking.paymentStatus||'').toLowerCase())||booking.stripeRefundId)
      return res.status(409).json({error:'Payment was already completed or refunded',code:'BOOKING_PAYMENT_FINAL'});
    const listingForPayment=getRentalListing(booking.listingId);
    if(booking.status!=='confirmed')
      return res.status(409).json({error:'Supplier confirmation required before payment',code:'SUPPLIER_CONFIRMATION_REQUIRED'});
    if(booking.paymentProvider!=='demo'||!String(booking.stripePaymentIntentId||'').startsWith('demo_pi_'))
      return res.status(409).json({error:'Demo checkout must be initiated before confirmation',code:'PAYMENT_INTENT_REQUIRED'});
    if(!['failed','succeeded'].includes(outcome))
      return res.status(400).json({error:'Invalid demo payment result',code:'INVALID_PAYMENT_OUTCOME'});
    if(outcome==='failed'){
      const failed=setBookingPaymentDetails({bookingId,paymentIntentId:booking.stripePaymentIntentId||`demo_pi_${crypto.randomUUID()}`,paymentStatus:'failed',platformFeeAmount:booking.platformFeeAmount||0,supplierAmount:booking.supplierAmount||0,paymentProvider:'demo'});
      return res.status(402).json({provider:'demo',status:'failed',error:'Demo card was declined.',booking:failed});
    }
    const paid=setBookingPaymentDetails({bookingId,paymentIntentId:booking.stripePaymentIntentId||`demo_pi_${crypto.randomUUID()}`,paymentStatus:'paid',platformFeeAmount:booking.platformFeeAmount||0,supplierAmount:booking.supplierAmount||0,paymentProvider:'demo'});
    let deposit={status:'not_required',amount:0};
    const depositAmount=Math.max(0,Number(paid.securityDepositAmount||0));
    if(depositAmount>0){
      const depositIntentId=paid.securityDepositPaymentIntentId||`demo_dep_${crypto.randomUUID()}`;
      setRentalSecurityDepositProviderState(bookingId,{paymentIntentId:depositIntentId,providerStatus:'requires_capture',depositStatus:'authorized'});
      deposit={status:'authorized',amount:depositAmount,paymentIntentId:depositIntentId};
    }
    if(paid.customerEmail) createRentalNotification({uniqueKey:`demo-payment:${bookingId}:customer`,audience:'customer',userEmail:paid.customerEmail,bookingId,type:'payment.succeeded',title:'Test payment completed',message:`Demo payment of €${Number(paid.orderValue||0).toFixed(2)} completed. No real money was charged.`});
    const listing=getRentalListing(paid.listingId);
    if(listing?.bookingMode==='instant' && getRentalBookingById(bookingId)?.status==='pending'){
      const confirmed=updateRentalBookingStatus(bookingId,'confirmed');
      markSupplierResponded(bookingId);
      // Instant booking approval is not a supplier signature.
      try{queueBookingStatusEmail(confirmed,'confirmed',{message:'Instant Book confirmed automatically after payment.'})}catch{}
    }
    if(listing?.ownerEmail) createRentalNotification({uniqueKey:`demo-payment:${bookingId}:supplier`,audience:'supplier',userEmail:listing.ownerEmail,bookingId,type:'payment.succeeded',title:listing.bookingMode==='instant'?'Instant booking confirmed':'Test payment received',message:listing.bookingMode==='instant'?`Booking ${bookingId} was confirmed automatically.`:`Booking ${bookingId} is paid in demo mode and ready for confirmation.`});
    res.json({provider:'demo',demo:true,status:'paid',booking:getRentalBookingById(bookingId),deposit});
  }catch(err){res.status(400).json({error:err.message});}
});

// Read persistent webhook event log from SQLite.
app.get('/api/stripe/webhook-events', requireRole('admin'), (req, res) => {
  const { limit = 50, type = null, status = null, from = null, to = null } = req.query;
  const safeLimit=Math.max(1,Math.min(200,Number(limit)||50));
  const events = listWebhookEvents({ limit:safeLimit, type, status, from, to });
  res.json({ events });
});

// Demo webhook-event simulator for UI testing.
// This does NOT forge a signed Stripe webhook; it only returns a sample event payload.
app.post('/api/stripe/connect/simulate-event', requireRole('admin'), (req, res) => {
  if(process.env.NODE_ENV==='production' && process.env.ENABLE_STRIPE_SIMULATOR!=='true'){
    return res.status(404).json({error:'Not found'});
  }
  const { type = 'account.updated', supplierId = 'demo', fail = false, eventId = null } = req.body || {};

  const event = {
    id: eventId || `evt_sim_${Date.now()}`,
    object: 'event',
    type,
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    account: `acct_sim_${supplierId}`,
    data: {
      object: {
        id: `acct_sim_${supplierId}`,
        details_submitted: type !== 'account.created',
        payouts_enabled: type === 'account.updated',
        charges_enabled: type === 'account.updated'
      }
    }
  };

  const existingOrNew = insertSimulatedWebhook({
    eventId: event.id,
    type: event.type,
    account: event.account,
    status: fail ? 'failed' : 'processed',
    error: fail ? 'Simulated processing error' : null,
    source: 'simulator',
    payload: event
  });

  console.log('[Simulated webhook]', event.type, event.id);
  res.json({ ...event, log: existingOrNew });
});



// V62: live availability inputs must be bounded and must never be served stale.
function parseRentalDate(value,label){
  const text=String(value||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(`${label} must use YYYY-MM-DD`);
  const date=new Date(`${text}T00:00:00Z`);
  if(Number.isNaN(date.getTime()) || date.toISOString().slice(0,10)!==text) throw new Error(`${label} is invalid`);
  return date;
}
function validateAvailabilityWindow(startValue,endValue,{maxDays=366,allowPast=false}={}){
  const start=parseRentalDate(startValue,'startDate');
  const end=parseRentalDate(endValue,'endDate');
  if(end<=start) throw new Error('endDate must be after startDate');
  const days=(end-start)/86400000;
  if(days>maxDays) throw new Error(`Rental window cannot exceed ${maxDays} days`);
  if(!allowPast){
    const now=new Date();
    const todayUtc=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
    if(start<todayUtc) throw new Error('startDate cannot be in the past');
    if(start>new Date(todayUtc.getTime()+730*86400000)) throw new Error('startDate is too far in the future');
  }
  return {start,end,days};
}
function validateRequestedQuantity(value){
  const quantity=Number(value);
  if(!Number.isInteger(quantity) || quantity<1 || quantity>999) throw new Error('quantity must be an integer from 1 to 999');
  return quantity;
}
function noStoreAvailability(res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('Pragma','no-cache');
}

// ---- Rental availability / anti-double-booking API ----
app.post('/api/rentals/listings/sync', requireRole('supplier','admin'), (req, res) => {
  try {
    const items = Array.isArray(req.body?.listings) ? req.body.listings : [];
    const synced = [];
    for(const raw of items.slice(0,250)){
      const item=validateSupplierListingInput(raw);
      const existing=getRentalListing(item.id);
      if(existing?.ownerEmail &&
         existing.ownerEmail.toLowerCase()!==req.appUser.email.toLowerCase() &&
         req.appUser.role!=='admin'){
        continue;
      }
      const saved=saveFullRentalListing(item,req.appUser.email);
      synced.push(upsertRentalListing({
        listingId:saved.id,
        ownerEmail:req.appUser.email,
        title:saved.title,
        totalQuantity:Number(saved.quantity||0),
        cancellationPolicy:saved.cancellationPolicy||'moderate'
      }));
    }
    res.json({ synced });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/rentals/availability', simpleRateLimit({windowMs:60000,max:120,keyPrefix:'availability'}), (req, res) => {
  try {
    const { listingId, startDate, endDate, quantity = 1 } = req.query;
    if (!listingId || !startDate || !endDate) {
      return res.status(400).json({ error: 'listingId, startDate and endDate are required' });
    }
    validateAvailabilityWindow(startDate,endDate);
    const requestedQuantity=validateRequestedQuantity(quantity);
    const availability = getAvailability({
      listingId,
      startDate,
      endDate,
      requestedQuantity
    });
    if (!availability) return res.status(404).json({ error: 'Listing not found' });
    noStoreAvailability(res);
    res.json(availability);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/rentals/calendar', simpleRateLimit({windowMs:60000,max:60,keyPrefix:'calendar'}), (req, res) => {
  try {
    const { listingId, fromDate, toDate } = req.query;
    if (!listingId || !fromDate || !toDate) {
      return res.status(400).json({ error: 'listingId, fromDate and toDate are required' });
    }
    validateAvailabilityWindow(fromDate,toDate,{maxDays:93});
    const calendar = getAvailabilityCalendar({ listingId, fromDate, toDate });
    if (!calendar) return res.status(404).json({ error: 'Listing not found' });
    noStoreAvailability(res);
    res.json(calendar);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/rentals/bookings', simpleRateLimit({windowMs:60000,max:12,keyPrefix:'booking-create'}), bookingIdempotency, (req, res) => {
  console.log('STAGING_BOOKING_DIAG_V1',JSON.stringify({contentType:req.headers['content-type']||null,listingId:req.body?.listingId||null,startDate:req.body?.startDate||null,endDate:req.body?.endDate||null,quantity:req.body?.quantity??null,termsAccepted:req.body?.termsAccepted??null,deliveryCity:req.body?.deliveryCity||null,deliveryAddress:req.body?.deliveryAddress||null,accommodationName:req.body?.accommodationName||null}));
  try {
    const {
      listingId, startDate, endDate, quantity = 1, status = 'pending',
      customerName = null, customerEmail = null, customerPhone = null,
      accommodationName = null, deliveryCity = null, deliveryAddress = null,
      roomNumber = null, contactPerson = null, deliveryInstructions = null,
      orderValue = null, termsAccepted = false, rentalStartTime = null
    } = req.body || {};
    if (!listingId || !startDate || !endDate) {
      return res.status(400).json({ error: 'listingId, startDate and endDate are required' });
    }
    if(termsAccepted!==true){
      return res.status(400).json({error:'Rental terms must be accepted before booking',code:'TERMS_REQUIRED'});
    }
    validateAvailabilityWindow(startDate,endDate);
    const qty=validateRequestedQuantity(quantity);
    const sessionUserForValidation=sessionUser(req);
    const emailForValidation=sessionUserForValidation?.email || customerEmail || '';
    if(emailForValidation && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(emailForValidation))){
      return res.status(400).json({error:'Valid customer email is required'});
    }
    if(customerName && String(customerName).length>120){
      return res.status(400).json({error:'Customer name is too long'});
    }
    if(customerPhone && String(customerPhone).length>40){
      return res.status(400).json({error:'Customer phone is too long'});
    }
    const inventoryListing=getRentalListing(listingId);
    const listingForBooking=getFullRentalListing(listingId);
    if(!inventoryListing || !listingForBooking || listingForBooking.moderationStatus==='blocked' || inventoryListing.lifecycleStatus!=='active'){
      return res.status(404).json({error:'Listing not found'});
    }
    const authenticatedUser=sessionUser(req);
    const effectiveCustomerEmail=authenticatedUser?.email || customerEmail || null;
    const effectiveCustomerName=authenticatedUser?.displayName || authenticatedUser?.name || customerName || null;
    const supplierTimezone=supplierTimezoneForListing(listingForBooking);
    // Legacy API clients without a time may still book, but receive a
    // conservative midnight cutoff, never an invented local pickup time.
    const rentalStartAt=rentalStartTime ? resolveRentalStart({startDate,startTime:rentalStartTime,timeZone:supplierTimezone}) : null;
    if(rentalStartAt && new Date(rentalStartAt).getTime()<=Date.now()) return res.status(400).json({error:'Rental start must be in the future'});
    const authoritativePrice=calculateAuthoritativeBookingTotal(listingForBooking,{
      startDate,endDate,quantity:qty,deliveryCity,deliveryAddress,accommodationName
    });
    const bookingId = `RB-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const result = createRentalBookingAtomic({
      bookingId,
      listingId,
      startDate,
      endDate,
      rentalStartAt,rentalStartTime:rentalStartTime||null,rentalTimeZone:supplierTimezone,
      quantity: qty,
      status: 'pending',
      customerName:effectiveCustomerName,
      customerEmail:effectiveCustomerEmail,
      customerPhone,
      accommodationName,
      deliveryCity,
      deliveryAddress,
      roomNumber,
      contactPerson,
      deliveryInstructions,
      orderValue:authoritativePrice.total,
      securityDepositAmount:authoritativePrice.securityDeposit,
      holdMinutes:Number(process.env.BOOKING_HOLD_MINUTES || 30)
    });
    const agreement=createRentalAgreement({
      bookingId,
      termsVersion:'rentinorbit-rental-v2',
      // Agreeing to platform checkout terms does not replace signing the
      // booking-specific rental agreement. Each party accepts explicitly.
      customerAcceptedAt:null,
      snapshot:{
        platform:'RentInOrbit',bookingId,listingId,listingTitle:listingForBooking.title,
        supplierEmail:listingForBooking.ownerEmail||null,customerName:effectiveCustomerName||null,customerEmail:effectiveCustomerEmail||null,
        startDate,endDate,rentalStartAt,rentalStartTime:rentalStartTime||null,rentalTimeZone:supplierTimezone,quantity:qty,currency:'EUR',rentalAmount:authoritativePrice.rental,deliveryFee:authoritativePrice.delivery,
        total:authoritativePrice.total,securityDeposit:authoritativePrice.securityDeposit,
        cancellationPolicy:result.booking.cancellationPolicySnapshot||listingForBooking.cancellationPolicy||'moderate',
        cancellationPolicyVersion:result.booking.cancellationPolicyVersion,
        terms:[
          'Nuomotojas išnuomoja daiktą, o nuomininkas įsipareigoja jį naudoti tik pagal paskirtį.',
          'Daiktas turi būti grąžintas sutartu laiku, atsižvelgiant į įprastą nusidėvėjimą.',
          'Žalos, negrąžinimo, atšaukimo ir užstato klausimai sprendžiami pagal skelbimo bei RentInOrbit sąlygas.',
          'Šios per RentInOrbit pateiktos rezervacijos mokėjimai, keitimai ir pratęsimai vykdomi per platformą.'
        ]
      }
    });

    if(isEmail(effectiveCustomerEmail)){
      try{
        const guestBookingUrl=result.paymentToken
          ? `${PUBLIC_BASE_URL}/?booking=${encodeURIComponent(result.booking.bookingId)}&access=${encodeURIComponent(result.paymentToken)}`
          : null;
        enqueueTransactionalEmail({
          recipient:effectiveCustomerEmail,
          templateKey:'booking_received',
          subject:`RentInOrbit booking received · ${listingForBooking.title}`,
          dedupeKey:`booking:${result.booking.bookingId}:received`,
          payload:{
            templateVersion:2,
            bookingId:result.booking.bookingId,
            listingId,
            listingTitle:listingForBooking.title,
            customerName:effectiveCustomerName,
            startDate,endDate,quantity:qty,
            rentalSubtotal:authoritativePrice.rental,
            deliveryFee:authoritativePrice.delivery,
            total:authoritativePrice.total,
            currency:'EUR',
            fulfillment:authoritativePrice.delivery>0?'delivery':'pickup',
            deliveryCity:deliveryCity||null,
            deliveryAddress:deliveryAddress||null,
            accommodationName:accommodationName||null,
            bookingUrl:guestBookingUrl,
            accountBookingPath:result.paymentToken?null:'/?view=my-bookings',
            nextStep:'Supplier review pending'
          }
        });
      }catch(err){ console.warn('Could not queue booking email',err.message); }
    }

    const listing=listingForBooking;
    if(isEmail(listing?.ownerEmail)){
      try{
        enqueueTransactionalEmail({
          recipient:listing.ownerEmail,
          templateKey:'supplier_booking_received',
          subject:`New RentInOrbit booking request · ${listing.title}`,
          dedupeKey:`supplier:booking:${result.booking.bookingId}:received`,
          payload:{templateVersion:1,bookingId:result.booking.bookingId,listingId,listingTitle:listing.title,
            customerName:effectiveCustomerName||'Customer',startDate,endDate,quantity:qty,
            total:authoritativePrice.total,currency:'EUR',fulfillment:authoritativePrice.delivery>0?'delivery':'pickup',
            supplierDashboardUrl:`${PUBLIC_BASE_URL}/?view=supplier-bookings`}
        });
      }catch(err){ console.warn('Could not queue supplier booking email',err.message); }
    }
    if(listing?.ownerEmail){
      createRentalNotification({
        uniqueKey:`booking:${bookingId}:created:supplier`,
        audience:'supplier',
        userEmail:listing.ownerEmail,
        bookingId,
        type:'booking.created',
        title:'New booking request',
        message:`${effectiveCustomerName||'Customer'} requested ${qty} × ${listing.title} for ${startDate} → ${endDate}.`
      });
    }
    if(effectiveCustomerEmail){
      createRentalNotification({
        uniqueKey:`booking:${bookingId}:created:customer`,
        audience:'customer',
        userEmail:effectiveCustomerEmail,
        bookingId,
        type:'booking.created',
        title:'Reservation created',
        message:`Your reservation is pending. Inventory is held until ${result.booking?.expiresAt||'payment expiry'}.`
      });
    }

    res.json({...result,price:authoritativePrice,agreement});
  } catch (err) {
    if (err.code === 'INSUFFICIENT_AVAILABILITY') {
      return res.status(409).json({
        error: err.message,
        code: err.code,
        availability: err.availability
      });
    }
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/rentals/bookings', requireRole('supplier','admin'), (req,res)=>{
  try{
    const ownerEmail=req.appUser.role==='admin'
      ? (req.query.ownerEmail || null)
      : req.appUser.email;
    res.json({bookings:listRentalBookings({ownerEmail})});
  }catch(err){
    res.status(400).json({error:err.message});
  }
});

app.post('/api/rentals/bookings/:bookingId/status', requireRole('supplier','admin'), async (req,res)=>{
  try{
    if(!canSupplierManageBooking(req.appUser,req.params.bookingId)){
      return res.status(403).json({error:'Forbidden'});
    }
    const requestedStatus=req.body?.status || 'confirmed';
    if(['active','returned'].includes(requestedStatus))
      return res.status(409).json({error:'Daikto išdavimui ir grąžinimui reikalingas vienkartinis nuomininko kodas.',code:'TRANSFER_CODE_REQUIRED'});
    if(requestedStatus==='completed' &&
      getRentalBookingById(req.params.bookingId)?.status==='active')
      return res.status(409).json({error:'Prieš užbaigdami nuomą patvirtinkite daikto grąžinimą vienkartiniu kodu.',code:'RETURN_CODE_REQUIRED'});

    // Refresh expired requests before an approval can capture any funds.
    if(requestedStatus==='confirmed') await processExpiredBookings();

    if(requestedStatus==='declined'){
      markSupplierResponded(req.params.bookingId);
      const responseListing=getRentalListing(getRentalBookingById(req.params.bookingId)?.listingId);
      if(responseListing?.ownerEmail) resetSupplierMissedResponses(responseListing.ownerEmail);
      const cancelled=await cancelBookingWithPaymentHandling(
        req.params.bookingId,
        req.body?.reason || 'Declined by supplier',
        {forceFullRefund:true}
      );
      if(!cancelled) return res.status(404).json({error:'Booking not found'});

      // Record final supplier-facing declined state after funds are handled.
      const bookingRow=getRentalBookingById(req.params.bookingId);
      if(bookingRow?.status==='cancelled'){
        setRentalBookingStatusAfterRefund(req.params.bookingId,'declined');
      }
      const booking=getRentalBookingById(req.params.bookingId);
      const availability=getAvailability({
        listingId:booking.listingId,
        startDate:booking.startDate,
        endDate:booking.endDate,
        requestedQuantity:1
      });
      try{
        queueBookingStatusEmail(booking,'declined',{message:req.body?.reason||'Declined by supplier'});
      }catch(err){ console.warn('Could not queue booking declined email',err.message); }
      return res.json({booking,availability,refundAmount:cancelled.refundAmount});
    }

    // Capture the customer's previously authorized rental amount only when
    // the supplier confirms. Never capture a mismatched, expired or terminal intent.
    if(requestedStatus==='confirmed' && rentalPreauthEnabled){
      const before=getRentalBookingById(req.params.bookingId);
      const listing=before?getRentalListing(before.listingId):null;
      if(before && listing?.bookingMode==='request' && before.status==='pending' && !before.stripePaymentIntentId){
        return res.status(409).json({error:'Nuomininkas dar neautorizavo nuomos mokesčio kortelėje.',code:'CUSTOMER_AUTHORIZATION_REQUIRED'});
      }
      if(before && listing?.bookingMode==='request' && before.stripePaymentIntentId && !before.stripePaymentIntentId.startsWith('demo_pi_')){
        const connection=getDirectMerchantConnectionByEmail(db,listing.ownerEmail);
        if(!stripe || !connection?.stripeAccountId) return res.status(409).json({error:'Supplier TEST Stripe is not ready',code:'SUPPLIER_STRIPE_NOT_READY'});
        const pi=await retrieveDirectChargePaymentIntent(stripe,{accountId:connection.stripeAccountId,paymentIntentId:before.stripePaymentIntentId});
        if(pi.capture_method==='manual' && pi.metadata?.paymentFlow==='preauthorize_then_capture'){
          const bound=validateRentalPaymentIntentBinding(pi,before,connection.stripeAccountId);
          if(!bound.ok) return res.status(409).json({error:'Authorization does not match this rental',code:'PREAUTH_BINDING_INVALID'});
          if(!['pending','confirmed'].includes(before.status)) return res.status(409).json({error:'Rental is not eligible for capture',code:'BOOKING_NOT_PAYABLE'});
          let captured=pi;
          if(pi.status==='requires_capture'){
            captured=await captureDirectChargePaymentIntent(stripe,{
              accountId:connection.stripeAccountId,paymentIntentId:pi.id,
              idempotencyKey:`booking:${before.bookingId}:approval-capture`
            });
          }else if(pi.status!=='succeeded'){
            return res.status(409).json({error:'Nuomininko mokėjimo rezervacija dar nepatvirtinta. Palaukite kortelės autorizacijos.',code:'CUSTOMER_AUTHORIZATION_REQUIRED'});
          }
          if(captured.status!=='succeeded') return res.status(409).json({error:'Nepavyko nuskaičiuoti rezervuotos nuomos sumos.',code:'CAPTURE_INCOMPLETE'});
          setBookingPaymentDetails({
            bookingId:before.bookingId,paymentIntentId:captured.id,paymentStatus:'paid',
            platformFeeAmount:Number(before.platformFeeAmount||0),
            supplierAmount:Number(before.supplierAmount||0),paymentProvider:'stripe'
          });
        }
      }
    }

    const booking = updateRentalBookingStatus(
      req.params.bookingId,
      requestedStatus,
      req.body?.reason || null
    );
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if(requestedStatus==='confirmed'){
      markSupplierResponded(req.params.bookingId);
      const responseListing=getRentalListing(booking.listingId);
      if(responseListing?.ownerEmail) resetSupplierMissedResponses(responseListing.ownerEmail);
      // Supplier must explicitly accept the rental agreement in the app.
      if(responseListing?.bookingMode==='request' && String(booking.paymentStatus||'unpaid')!=='paid'){
        const minutes=Math.max(10,Math.min(240,Number(process.env.POST_CONFIRM_PAYMENT_MINUTES||60)));
        const nowIso=new Date().toISOString();
        const dueIso=new Date(Date.now()+minutes*60000).toISOString();
        db.prepare('UPDATE rental_bookings SET expires_at=?, updated_at=? WHERE booking_id=?').run(dueIso,nowIso,req.params.bookingId);
      }
    }
    if(requestedStatus==='returned' && booking.paymentProvider==='demo' && booking.paymentStatus==='paid'){
      setBookingPayoutDetails(booking.bookingId,{status:'ready',amount:Number(booking.supplierAmount||0),reference:`demo_po_${booking.bookingId}`});
    }
    if(requestedStatus==='completed' && booking.paymentProvider==='demo' && booking.paymentStatus==='paid'){
      const latest=getRentalBookingById(booking.bookingId);
      if(latest?.securityDepositStatus==='authorized'){
        setRentalSecurityDepositProviderState(booking.bookingId,{paymentIntentId:latest.securityDepositPaymentIntentId||`demo_dep_${crypto.randomUUID()}`,providerStatus:'canceled',depositStatus:'released'});
        try{resolveRentalSecurityDeposit(booking.bookingId,{status:'released',resolution:'Demo deposit released at completion.'})}catch{}
      }
      setBookingPayoutDetails(booking.bookingId,{status:'paid',amount:Number(booking.supplierAmount||0),reference:`demo_po_${booking.bookingId}`});
    }

    const availability = getAvailability({
      listingId: booking.listingId,
      startDate: booking.startDate,
      endDate: booking.endDate,
      requestedQuantity: 1
    });

    if(booking.customerEmail){
      try{
        queueBookingStatusEmail(booking,booking.status,{message:req.body?.reason||''});
      }catch(err){ console.warn('Could not queue booking status email',err.message); }
      createRentalNotification({
        uniqueKey:`booking:${booking.bookingId}:status:${booking.status}`,
        audience:'customer',
        userEmail:booking.customerEmail,
        bookingId:booking.bookingId,
        type:`booking.${booking.status}`,
        title:`Booking ${booking.status}`,
        message:`Your booking status changed to ${booking.status}.`
      });
    }

    res.json({ booking, availability });
  } catch (err) {
    const code = err.code === 'INVALID_TRANSITION' || err.code === 'INVALID_STATUS' ? 409 : 400;
    res.status(code).json({ error: err.message, code: err.code || null });
  }
});


app.post('/api/rentals/bookings/:bookingId/cancel', simpleRateLimit({windowMs:60000,max:12,keyPrefix:'booking-cancel'}), async (req,res)=>{
  try{
    if(!bookingAccessAllowed(req,req.params.bookingId)){
      return res.status(403).json({error:'Booking access denied'});
    }
    const actor=sessionUser(req);
    const supplierInitiated=canSupplierManageBooking(actor,req.params.bookingId);
    const bookingBeforeCancellation=getRentalBookingById(req.params.bookingId);
    // Server-side guard: do not refund after handover, return or completion.
    // Disputes use a separate flow, with evidence and appropriate authorization.
    if(bookingBeforeCancellation && ['active','returned','completed'].includes(String(bookingBeforeCancellation.status||'').toLowerCase())){
      return res.status(409).json({error:'Cannot cancel after handover, return or completion. Open a dispute instead.',code:'CANCELLATION_LOCKED_AFTER_HANDOVER'});
    }
    const result=await cancelBookingWithPaymentHandling(
      req.params.bookingId,
      req.body?.reason || null,
      {forceFullRefund:supplierInitiated}
    );
    if(!result) return res.status(404).json({error:'Booking not found'});
    const booking=result.booking;
    const listing=booking ? getRentalListing(booking.listingId) : null;

    if(listing?.ownerEmail){
      createRentalNotification({
        uniqueKey:`booking:${booking.bookingId}:cancelled:supplier`,
        audience:'supplier',userEmail:listing.ownerEmail,bookingId:booking.bookingId,
        type:'booking.cancelled',title:'Booking cancelled',
        message:`Booking ${booking.bookingId} was cancelled. Refund: €${Number(result.refundAmount||0).toFixed(2)}.`
      });
    }
    if(booking?.customerEmail){
      createRentalNotification({
        uniqueKey:`booking:${booking.bookingId}:cancelled:customer`,
        audience:'customer',userEmail:booking.customerEmail,bookingId:booking.bookingId,
        type:'booking.cancelled',title:'Booking cancelled',
        message:`Your booking was cancelled. Refund: €${Number(result.refundAmount||0).toFixed(2)}.`
      });
    }
    try{
      const refundText='€'+Number(result.refundAmount||0).toFixed(2);
      if(booking?.customerEmail && isEmail(booking.customerEmail)){
        enqueueTransactionalEmail({
          recipient:booking.customerEmail,
          templateKey:'booking_cancelled',
          subject:`RentInOrbit · Booking cancelled · ${booking.bookingId}`,
          dedupeKey:`booking:${booking.bookingId}:cancelled:email:customer`,
          payload:{
            templateVersion:1,
            bookingId:booking.bookingId,
            listingTitle:getFullRentalListing(booking.listingId)?.title||listing?.title||'Rental item',
            status:'cancelled',
            message:`Your booking was cancelled. Refund: ${refundText}.`,
            accountBookingPath:`/?view=my-bookings&booking=${encodeURIComponent(booking.bookingId)}`
          }
        });
      }
      if(listing?.ownerEmail && isEmail(listing.ownerEmail)){
        enqueueTransactionalEmail({
          recipient:listing.ownerEmail,
          templateKey:'booking_cancelled_supplier',
          subject:`RentInOrbit · Booking cancelled · ${booking.bookingId}`,
          dedupeKey:`booking:${booking.bookingId}:cancelled:email:supplier`,
          payload:{
            templateVersion:1,
            bookingId:booking.bookingId,
            listingTitle:getFullRentalListing(booking.listingId)?.title||listing?.title||'Rental item',
            status:'cancelled',
            message:`Booking ${booking.bookingId} was cancelled. Customer refund: ${refundText}.`,
            bookingUrl:`${PUBLIC_BASE_URL}/?view=supplier-bookings&booking=${encodeURIComponent(booking.bookingId)}`
          }
        });
      }
    }catch(err){ console.warn('Could not queue cancellation emails',err.message); }
    res.json(result);
  }catch(err){
    res.status(err.code==='INVALID_TRANSITION'?409:400)
      .json({error:err.message,code:err.code||null});
  }
});

app.post('/api/rentals/bookings/:bookingId/return', requireRole('supplier','admin'), simpleRateLimit({windowMs:60000,max:20,keyPrefix:'booking-return'}), (req,res)=>{
  try{
    return res.status(409).json({error:'Patvirtinkite grąžinimą nuomininko vienkartiniu kodu.',code:'TRANSFER_CODE_REQUIRED'});
    if(!canSupplierManageBooking(req.appUser,req.params.bookingId)){
      return res.status(403).json({error:'Forbidden'});
    }
    const booking=markRentalReturned(
      req.params.bookingId,
      req.body?.condition || 'good',
      req.body?.notes || null
    );
    if(!booking) return res.status(404).json({error:'Booking not found'});
    const listing=getRentalListing(booking.listingId);
    const depositAmount=Math.max(0,Number(booking.securityDepositAmount||0));
    let deposit=booking;
    if(depositAmount>0){
      const depositStatus=booking.returnCondition==='good'?'release_pending':'claim_pending';
      const resolution=booking.returnCondition==='good'
        ?'Item returned in good condition; deposit release is pending payment-provider confirmation.'
        :`Return recorded as ${booking.returnCondition}; deposit claim requires review before any capture.`;
      deposit=resolveRentalSecurityDeposit(booking.bookingId,{status:depositStatus,resolution});
      if(booking.paymentProvider==='demo' && depositStatus==='release_pending'){
        setRentalSecurityDepositProviderState(booking.bookingId,{paymentIntentId:booking.securityDepositPaymentIntentId||`demo_dep_${crypto.randomUUID()}`,providerStatus:'canceled',depositStatus:'released'});
        deposit=resolveRentalSecurityDeposit(booking.bookingId,{status:'released',resolution:'Demo deposit automatically released after a good return.'});
      }
      if(booking.customerEmail) createRentalNotification({
        uniqueKey:`booking:${booking.bookingId}:deposit:${depositStatus}:customer`,
        audience:'customer',userEmail:booking.customerEmail,bookingId:booking.bookingId,
        type:`deposit.${depositStatus}`,title:depositStatus==='release_pending'?'Deposit release started':'Deposit under review',
        message:depositStatus==='release_pending'
          ?`Your €${depositAmount.toFixed(2)} security deposit is marked for release.`
          :`Your €${depositAmount.toFixed(2)} security deposit is under review because the return was recorded as ${booking.returnCondition}.`
      });
    }
    if(booking.paymentProvider==='demo' && booking.paymentStatus==='paid'){
      setBookingPayoutDetails(booking.bookingId,{status:'ready',amount:Number(booking.supplierAmount||0),reference:`demo_po_${booking.bookingId}`});
    }
    if(booking.customerEmail) createRentalNotification({uniqueKey:`booking:${booking.bookingId}:returned:customer`,audience:'customer',userEmail:booking.customerEmail,bookingId:booking.bookingId,type:'booking.returned',title:'Item return recorded',message:`Return recorded as ${booking.returnCondition||'good'}.`});
    if(listing?.ownerEmail) createRentalNotification({uniqueKey:`booking:${booking.bookingId}:returned:supplier`,audience:'supplier',userEmail:listing.ownerEmail,bookingId:booking.bookingId,type:'booking.returned',title:'Item return recorded',message:`Return recorded as ${booking.returnCondition||'good'}.`});
    res.json({booking:deposit,deposit:{amount:depositAmount,status:deposit?.securityDepositStatus||'not_required'}});
  }catch(err){
    res.status(err.code==='INVALID_TRANSITION'?409:400)
      .json({error:err.message,code:err.code||null});
  }
});


// Staging-only, booking-bound acceptance and handover.
// Identity check stays not_verified until a real ID-verification provider is integrated.
app.get('/api/rentals/bookings/:bookingId/trust',simpleRateLimit({windowMs:60000,max:100,keyPrefix:'rental-trust'}),(req,res)=>{
  const id=req.params.bookingId;
  if(!bookingAccessAllowed(req,id))return res.status(403).json({error:'Prieiga prie rezervacijos draudžiama.'});
  res.set('Cache-Control','no-store, private');
  const agreement=getRentalAgreement(id);
  const acceptanceAudit=getRentalAgreementAcceptanceAudit(id);
  // Independent acceptance evidence is separate from supplier order confirmation.
  const partyEvidence=Object.fromEntries(['customer','supplier'].map(party=>{
    const record=acceptanceAudit.find(row=>row.party===party);
    const acceptedAt=party==='customer'?agreement?.customerAcceptedAt:agreement?.supplierAcceptedAt;
    return [party,{
      verified:!!record && !!acceptedAt && record.acceptedAt===acceptedAt,
      acceptedAt:record?.acceptedAt||null
    }];
  }));
  res.json({agreement,acceptanceEvidence:partyEvidence,transfer:rentalTransferStatus(id),identityVerification:rentalIdentityVerificationStatus(id)});
});
app.post('/api/rentals/bookings/:bookingId/agreement/accept',
  simpleRateLimit({windowMs:60000,max:12,keyPrefix:'agreement-accept'}),(req,res)=>{
  const id=req.params.bookingId,user=sessionUser(req),booking=getRentalBookingById(id);
  if(!booking||!bookingAccessAllowed(req,id))return res.status(403).json({error:'Rezervacija nepasiekiama.'});
  const supplier=user?.role==='supplier'&&canSupplierManageBooking(user,id);
  const accountCustomer=!!user?.email&&String(user.email).toLowerCase()===String(booking.customerEmail||'').toLowerCase();
  // A guest token is not an identity switch for an authenticated third party.
  // To sign as a guest, the renter must use an unauthenticated browser session.
  const guestCustomer=!user&&!!verifyBookingPaymentToken(id,req.body?.accessToken||'');
  const customer=!supplier&&(accountCustomer||guestCustomer);
  if(!supplier&&!customer)return res.status(403).json({error:'Negalite patvirtinti šios sutarties.'});
  if(req.body?.accepted!==true)return res.status(400).json({error:'Būtinas aiškus sutarties patvirtinimas.'});
  const agreement=getRentalAgreement(id);
  if(!agreement)return res.status(404).json({error:'Sutartis nerasta.'});
  res.set('Cache-Control','no-store, private');
  res.json({agreement:acceptRentalAgreement(id,supplier?'supplier':'customer',{
    actorEmail:supplier?String(user.email):String(booking.customerEmail||''),
    authMethod:user?'session':'booking_guest_token'
  })});
});
app.post('/api/rentals/bookings/:bookingId/transfer-code',
  simpleRateLimit({windowMs:60000,max:8,keyPrefix:'transfer-issue'}),(req,res)=>{
  const id=req.params.bookingId,booking=getRentalBookingById(id),user=sessionUser(req);
  if(!booking)return res.status(404).json({error:'Rezervacija nerasta.'});
  const isSupplier=!!user&&user.role==='supplier'&&canSupplierManageBooking(user,id);
  const isAccountCustomer=!!user?.email&&String(user.email).toLowerCase()===String(booking.customerEmail||'').toLowerCase();
  const isGuestCustomer=!user&&!!verifyBookingPaymentToken(id,req.body?.accessToken||'');
  // A supplier cannot request a renter PIN. An authenticated unrelated user
  // cannot upgrade their identity by attaching somebody else's guest token.
  if(isSupplier||(!isAccountCustomer&&!isGuestCustomer))
    return res.status(403).json({error:'Tik nuomininkas gali gauti šios rezervacijos kodą.'});
  try{
    if(req.body?.purpose==='return')
      return res.status(409).json({error:'Grąžinimą patvirtina nuomotojas be papildomo kodo.',code:'RETURN_PIN_NOT_REQUIRED'});
    const value=issueRentalTransferCode(id,req.body?.purpose,'customer');
    res.set('Cache-Control','no-store, private');
    res.json(value);
  }catch(err){
    const conflict=['TRANSFER_NOT_READY','TRANSFER_ALREADY_USED','OWN_AGREEMENT_REQUIRED'].includes(err.code);
    res.status(conflict?409:400).json({error:err.message,code:err.code||null});
  }
});
app.post('/api/rentals/bookings/:bookingId/transfer-confirm',
  requireRole('supplier'),simpleRateLimit({windowMs:60000,max:10,keyPrefix:'transfer-confirm'}),(req,res)=>{
  const id=req.params.bookingId;
  if(!canSupplierManageBooking(req.appUser,id))return res.status(403).json({error:'Rezervacija nepriklauso šiam nuomotojui.'});
  if(req.body?.purpose==='return')
    return res.status(409).json({error:'Grąžinimą nuomotojas patvirtina be kodo.',code:'RETURN_PIN_NOT_REQUIRED'});
  try{
    const result=verifyAndConsumeRentalTransferCode(id,req.body?.purpose,req.body?.code,{
      returnCondition:req.body?.returnCondition,returnNotes:req.body?.returnNotes
    });
    if(!result.ok)return res.status(409).json({error:'Neteisingas nuomininko kodas.',code:result.reason});
    const booking=result.booking;
    const listing=booking?getRentalListing(booking.listingId):null;
    const purpose=req.body?.purpose;
    if(purpose==='return'&&booking){
      const amount=Math.max(0,Number(booking.securityDepositAmount||0));
      if(amount>0){
        try{
          const good=booking.returnCondition==='good';
          resolveRentalSecurityDeposit(id,{
            status:good?'release_pending':'claim_pending',
            resolution:good?'Grąžinimas patvirtintas kodu; užstato atlaisvinimas laukia mokėjimų patikros.':'Daikto būklė pažymėta kaip netinkama; užstato klausimą turi peržiūrėti administratorius.'
          });
        }catch(err){console.error('Deposit review update after verified return failed',id,err.message);}
      }
    }
    // Handover/return events are booking-bound and recorded even if notification delivery fails.
    try{
      const label=purpose==='pickup'?'Daiktas išduotas':'Daiktas grąžintas';
      if(booking?.customerEmail)createRentalNotification({
        uniqueKey:`transfer:${id}:${purpose}:customer`,audience:'customer',userEmail:booking.customerEmail,bookingId:id,
        type:`booking.${purpose}`,title:label,message:'Perdavimas patvirtintas vienkartiniu kodu.'
      });
      if(listing?.ownerEmail)createRentalNotification({
        uniqueKey:`transfer:${id}:${purpose}:supplier`,audience:'supplier',userEmail:listing.ownerEmail,bookingId:id,
        type:`booking.${purpose}`,title:label,message:'Perdavimas patvirtintas vienkartiniu kodu.'
      });
    }catch(err){console.warn('Could not notify verified transfer',id,err.message);}
    res.set('Cache-Control','no-store, private');
    res.json({...result,booking:getRentalBookingById(id)});
  }catch(err){res.status(err.code==='TRANSFER_CODE_EXPIRED'||err.code==='TRANSFER_NOT_READY'||err.code==='AGREEMENT_REQUIRED'?409:400).json({error:err.message,code:err.code||null});}
});

// Supplier records physical return; no second renter PIN is required.
// A return condition is mandatory, and a damage claim never auto-captures a deposit.
app.post('/api/rentals/bookings/:bookingId/return-confirm',
  requireRole('supplier'),simpleRateLimit({windowMs:60000,max:10,keyPrefix:'return-confirm'}),(req,res)=>{
  const id=req.params.bookingId;
  if(!canSupplierManageBooking(req.appUser,id))
    return res.status(403).json({error:'Tik šio daikto nuomotojas gali patvirtinti grąžinimą.'});
  const condition=String(req.body?.returnCondition||'').trim().toLowerCase();
  const notes=String(req.body?.returnNotes||'').trim();
  if(!['good','damaged','missing'].includes(condition))
    return res.status(400).json({error:'Privaloma nurodyti daikto būklę.',code:'RETURN_CONDITION_REQUIRED'});
  if(condition!=='good'&&!notes)
    return res.status(400).json({error:'Nurodykite pastebėtus pažeidimus ar trūkumus.',code:'RETURN_NOTES_REQUIRED'});
  try{
    const current=getRentalBookingById(id);
    if(!current||current.status!=='active')
      return res.status(409).json({error:'Grąžinimą galima patvirtinti tik aktyviai nuomai.',code:'TRANSFER_NOT_READY'});
    const booking=markRentalReturned(id,condition,notes||null);
    const listing=getRentalListing(booking.listingId);
    if(Math.max(0,Number(booking.securityDepositAmount||0))>0){
      try{
        resolveRentalSecurityDeposit(id,{
          status:condition==='good'?'release_pending':'claim_pending',
          resolution:condition==='good'
            ?'Nuomotojas patvirtino grąžinimą; užstato atlaisvinimas laukia mokėjimų patikros.'
            :'Nuomotojas nurodė pažeidimus ar trūkumus; užstato klausimas laukia peržiūros.'
        });
      }catch(err){console.error('Return deposit review failed',id,err.message);}
    }
    try{
      if(booking.customerEmail)createRentalNotification({
        uniqueKey:`return-confirm:${id}:customer`,audience:'customer',
        userEmail:booking.customerEmail,bookingId:id,type:'booking.return',
        title:'Nuomotojas patvirtino grąžinimą',
        message:condition==='good'
          ?'Daiktas pažymėtas kaip grąžintas tvarkingas. Jei nesutinkate, galite pradėti ginčą.'
          :'Daiktas pažymėtas kaip grąžintas su pastabomis dėl būklės. Galite peržiūrėti užsakymą ir pradėti ginčą.'
      });
      if(listing?.ownerEmail)createRentalNotification({
        uniqueKey:`return-confirm:${id}:supplier`,audience:'supplier',
        userEmail:listing.ownerEmail,bookingId:id,type:'booking.return',
        title:'Grąžinimas užfiksuotas',message:'Daikto grąžinimo būklė įrašyta į užsakymą.'
      });
    }catch(err){console.warn('Return notification failed',id,err.message);}
    res.set('Cache-Control','no-store, private');
    res.json({ok:true,booking:getRentalBookingById(id)});
  }catch(err){res.status(err.code==='INVALID_TRANSITION'?409:400).json({error:err.message,code:err.code||null});}
});

app.get('/api/rentals/bookings/:bookingId/agreement',(req,res)=>{
  try{
    if(!bookingAccessAllowed(req,req.params.bookingId) && !canSupplierManageBooking(sessionUser(req),req.params.bookingId)){
      return res.status(403).json({error:'Booking access denied'});
    }
    const agreement=getRentalAgreement(req.params.bookingId);
    if(!agreement)return res.status(404).json({error:'Agreement not found'});
    res.setHeader('Cache-Control','no-store, private');
    res.json({agreement});
  }catch(err){res.status(400).json({error:err.message});}
});

function conversationParticipant(user,conversation){
  if(!user||!conversation)return false;
  const e=String(user.email||'').toLowerCase();
  return user.role==='admin'||e===String(conversation.customerEmail||'').toLowerCase()||e===String(conversation.supplierEmail||'').toLowerCase();
}
function containsOffPlatformContact(text){
  const v=String(text||'');
  if(/https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/i.test(v)) return true;
  // Do not treat ISO dates such as 2026-10-30 as phone numbers.
  const withoutDates=v.replace(/\b\d{4}-\d{2}-\d{2}\b/g,'');
  return /(?:\+?\d[\s().-]*){7,}/.test(withoutDates);
}
app.get('/api/conversations',requireRole('customer','supplier','admin'),(req,res)=>{
  try{
    const email=String(req.appUser.email||'').toLowerCase();
    const conversations=listRentalConversationsForUser(email);
    // Show booking-specific starters in Messages even if neither party has
    // initiated a conversation yet. Limit results to the logged-in member.
    const supplierBookings=req.appUser.role==='supplier'
      ? listRentalBookings({ownerEmail:email}) : [];
    const customerBookings=listCustomerRentalBookings(email);
    const seen=new Set();
    const bookingCandidates=[...supplierBookings.map(b=>({...b,side:'supplier'})),
      ...customerBookings.map(b=>({...b,side:'customer'}))]
      .filter(b=>{
        if(!b.bookingId||!b.listingId||seen.has(String(b.bookingId)))return false;
        seen.add(String(b.bookingId));return true;
      })
      .sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))
      .slice(0,80)
      .map(b=>({
        bookingId:String(b.bookingId),listingId:String(b.listingId),
        title:String(getRentalListing(b.listingId)?.title||'Nuomojamas daiktas'),
        counterparty:b.side==='supplier'?String(b.customerName||'Nuomininkas'):'Nuomotojas',
        side:b.side,status:String(b.status||'')
      }));
    res.set('Cache-Control','no-store, private');
    res.json({conversations,bookingCandidates});
  }catch(err){res.status(400).json({error:err.message});}
});
app.post('/api/conversations',requireRole('customer','supplier','admin'),simpleRateLimit({windowMs:60000,max:30,keyPrefix:'conversation-create'}),(req,res)=>{
  try{
    const listingId=String(req.body?.listingId||'');
    // Historical confirmed bookings may reference listings without data_json.
    // Always use the persisted owner record, not a publicly visible catalog requirement.
    const listing=getFullRentalListing(listingId)||getRentalListing(listingId);
    if(!listing)return res.status(404).json({error:'Listing not found'});
    let customerEmail=null,supplierEmail=String(listing.ownerEmail||'').toLowerCase(),bookingId=req.body?.bookingId?String(req.body.bookingId):null;
    const actorEmail=String(req.appUser.email||'').toLowerCase();
    const actorOwnsListing=supplierEmail===actorEmail;
    if(req.appUser.role==='admin'){
      customerEmail=String(req.body?.customerEmail||'').toLowerCase();
    }else if(actorOwnsListing){
      if(!bookingId)return res.status(400).json({error:'bookingId is required when messaging a renter about your own listing'});
      const booking=getRentalBookingById(bookingId);if(!booking)return res.status(404).json({error:'Booking not found'});
      customerEmail=booking.customerEmail;
    }else{
      // A general listing enquiry is allowed, but a booking-bound conversation
      // must be initiated only by that booking's actual renter.
      if(bookingId){
        const renterBooking=getRentalBookingById(bookingId);
        if(!renterBooking || String(renterBooking.customerEmail||'').toLowerCase()!==actorEmail)
          return res.status(403).json({error:'Rezervacija nepriklauso šiai paskyrai.',code:'BOOKING_ACCESS_DENIED'});
      }
      customerEmail=req.appUser.email;
    }
    if(!customerEmail||!supplierEmail)return res.status(400).json({error:'Conversation participants are unavailable'});
    if(bookingId){const b=getRentalBookingById(bookingId);if(!b||String(b.listingId)!==listingId)return res.status(400).json({error:'Booking does not match listing'});}
    res.json({conversation:createOrGetRentalConversation({listingId,bookingId,customerEmail,supplierEmail})});
  }catch(err){res.status(400).json({error:err.message});}
});
app.get('/api/conversations/:conversationId/messages',requireRole('customer','supplier','admin'),(req,res)=>{
  const conversation=getRentalConversation(req.params.conversationId);
  if(!conversation)return res.status(404).json({error:'Conversation not found'});
  if(!conversationParticipant(req.appUser,conversation))return res.status(403).json({error:'Forbidden'});
  res.setHeader('Cache-Control','no-store, private');
  res.json({conversation,messages:listRentalMessages(conversation.conversationId)});
});
app.post('/api/conversations/:conversationId/messages',requireRole('customer','supplier','admin'),simpleRateLimit({windowMs:60000,max:60,keyPrefix:'message-create'}),(req,res)=>{
  try{
    const conversation=getRentalConversation(req.params.conversationId);
    if(!conversation)return res.status(404).json({error:'Conversation not found'});
    if(!conversationParticipant(req.appUser,conversation))return res.status(403).json({error:'Forbidden'});
    const body=String(req.body?.body||'').trim();
    const booking=conversation.bookingId?getRentalBookingById(conversation.bookingId):null;
    const contactAllowed=booking&&booking.paymentStatus==='paid'&&['confirmed','active','returned','completed'].includes(booking.status);
    if(!contactAllowed&&containsOffPlatformContact(body))return res.status(400).json({error:'Contact details can be shared after the booking is confirmed',code:'CONTACT_DETAILS_BLOCKED'});
    const message=addRentalMessage({conversationId:conversation.conversationId,senderEmail:req.appUser.email,senderRole:req.appUser.role,body});
    const recipient=String(req.appUser.email).toLowerCase()===String(conversation.customerEmail).toLowerCase()?conversation.supplierEmail:conversation.customerEmail;
    if(recipient)createRentalNotification({uniqueKey:`message:${message.messageId}`,audience:String(recipient).toLowerCase()===String(conversation.supplierEmail).toLowerCase()?'supplier':'customer',userEmail:recipient,bookingId:conversation.bookingId||null,type:'message.received',title:'New message',message:'You have a new RentInOrbit message.'});
    res.json({message});
  }catch(err){res.status(400).json({error:err.message,code:err.code||null});}
});

app.get('/api/listings/:listingId/reputation',(req,res)=>{
  const listing=getFullRentalListing(req.params.listingId);if(!listing)return res.status(404).json({error:'Listing not found'});
  const payoutConnection=getDirectMerchantConnectionByEmail(db,listing.ownerEmail);
  const verifiedSupplier=directMerchantReady(payoutConnection);
  res.json({supplier:getSupplierReputation(listing.ownerEmail),verifiedSupplier});
});
app.get('/api/supplier/bookings/:bookingId/customer-reputation',requireRole('supplier','admin'),(req,res)=>{
  if(!canSupplierManageBooking(req.appUser,req.params.bookingId))return res.status(403).json({error:'Forbidden'});
  const booking=getRentalBookingById(req.params.bookingId);if(!booking)return res.status(404).json({error:'Booking not found'});
  res.json({customer:getRenterReputation(booking.customerEmail)});
});
app.post('/api/supplier/bookings/:bookingId/customer-review',requireRole('supplier','admin'),simpleRateLimit({windowMs:60000,max:20,keyPrefix:'renter-review'}),(req,res)=>{
  try{
    if(!canSupplierManageBooking(req.appUser,req.params.bookingId))return res.status(403).json({error:'Forbidden'});
    const booking=getRentalBookingById(req.params.bookingId);if(!booking)return res.status(404).json({error:'Booking not found'});
    if(!booking.customerEmail)return res.status(400).json({error:'Customer identity is unavailable for this booking',code:'CUSTOMER_IDENTITY_REQUIRED'});
    res.json(createRenterReview({bookingId:booking.bookingId,reviewerEmail:req.appUser.email,revieweeEmail:booking.customerEmail,rating:Number(req.body?.rating),comment:req.body?.comment||null}));
  }catch(err){const status=err.code==='REVIEW_ALREADY_EXISTS'||err.code==='REVIEW_NOT_ALLOWED'?409:400;res.status(status).json({error:err.message,code:err.code||null});}
});

app.get('/api/rentals/reviews', (req, res) => {
  try {
    const listingId=req.query.listingId;
    if (!listingId) return res.status(400).json({ error:'listingId is required' });
    res.json(listRentalReviews(listingId));
  } catch (err) {
    res.status(400).json({ error:err.message });
  }
});

app.post('/api/rentals/reviews', simpleRateLimit({windowMs:60000,max:20,keyPrefix:'review-create'}), (req,res)=>{
  try{
    const {bookingId,rating,comment=null}=req.body||{};
    if(!bookingId || !rating) return res.status(400).json({error:'bookingId and rating are required'});
    if(!bookingAccessAllowed(req,bookingId)){
      return res.status(403).json({error:'Booking access denied'});
    }
    const safeRating=Number(rating);
    if(!Number.isInteger(safeRating) || safeRating<1 || safeRating>5){
      return res.status(400).json({error:'Rating must be an integer from 1 to 5'});
    }
    const safeComment=String(comment||'').trim();
    if(safeComment.length>2000) return res.status(400).json({error:'Review comment is too long'});
    if(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(safeComment)){
      return res.status(400).json({error:'Review comment contains unsupported characters'});
    }
    res.json(createRentalReview({bookingId,rating:safeRating,comment:safeComment||null}));
  } catch (err) {
    const known=new Set(['REVIEW_NOT_ALLOWED','REVIEW_ALREADY_EXISTS','BOOKING_NOT_FOUND']);
    const code=err.code||null;
    const status=code==='BOOKING_NOT_FOUND'?404:(code==='REVIEW_NOT_ALLOWED'||code==='REVIEW_ALREADY_EXISTS'?409:400);
    res.status(status).json({
      error:known.has(code)?err.message:'Unable to create review',
      code:known.has(code)?code:null
    });
  }
});



// V182 admin-controlled supplier pre-launch onboarding.
app.get('/api/admin/suppliers', requireRole('admin'), (req,res)=>{
  res.json({suppliers:listSupplierOnboarding()});
});
app.post('/api/admin/suppliers', requireRole('admin'), (req,res)=>{
  try{res.json({supplier:upsertPrelaunchSupplier(req.body||{})});}catch(err){res.status(400).json({error:err.message});}
});
app.post('/api/admin/suppliers/:email/invite', requireRole('admin'), (req,res)=>{
  try{
    const invite=createSupplierActivationInvite(decodeURIComponent(req.params.email),{hours:Number(req.body?.hours||168)});
    const listingCount=listOwnerRentalListings(invite.supplier.email).length;
    const activationUrl=`${PUBLIC_BASE_URL}/?supplier_invite=${encodeURIComponent(invite.token)}`;
    enqueueTransactionalEmail({recipient:invite.supplier.email,templateKey:'supplier_activation',subject:'Activate your RentInOrbit supplier account',dedupeKey:`supplier-activation:${invite.supplier.email}:${invite.expiresAt}`,payload:{activationUrl,expiresAt:invite.expiresAt,listingCount,businessName:invite.supplier.businessName}});
    res.json({supplier:invite.supplier,expiresAt:invite.expiresAt,queued:true});
  }catch(err){res.status(400).json({error:err.message});}
});
app.post('/api/admin/suppliers/invite-ready', requireRole('admin'), (req,res)=>{
  const suppliers=listSupplierOnboarding().filter(s=>['prelaunch','invited'].includes(s.status));
  let queued=0;
  for(const supplier of suppliers){
    try{
      const invite=createSupplierActivationInvite(supplier.email,{hours:Number(req.body?.hours||168)});
      const listingCount=listOwnerRentalListings(supplier.email).length;
      enqueueTransactionalEmail({recipient:supplier.email,templateKey:'supplier_activation',subject:'Activate your RentInOrbit supplier account',dedupeKey:`supplier-activation:${supplier.email}:${invite.expiresAt}`,payload:{activationUrl:`${PUBLIC_BASE_URL}/?supplier_invite=${encodeURIComponent(invite.token)}`,expiresAt:invite.expiresAt,listingCount,businessName:supplier.businessName}}); queued++;
    }catch{}
  }
  res.json({queued,total:suppliers.length});
});
app.post('/api/admin/suppliers/:email/listings', requireRole('admin'), (req,res)=>{
  try{
    const supplierEmail=decodeURIComponent(req.params.email).trim().toLowerCase();
    upsertPrelaunchSupplier({email:supplierEmail});
    const safe=validateSupplierListingInput(req.body?.listing||{});
    const listing=saveFullRentalListing({...safe,lifecycleStatus:'prelaunch',availabilityConfirmedAt:null,bookingMode:req.body?.listing?.bookingMode==='instant'?'instant':'request',supplierResponseHours:Number(req.body?.listing?.supplierResponseHours||4)},supplierEmail);
    upsertRentalListing({listingId:listing.id,ownerEmail:supplierEmail,title:listing.title,totalQuantity:Number(listing.quantity||0),cancellationPolicy:listing.cancellationPolicy||'moderate'});
    res.json({listing});
  }catch(err){res.status(400).json({error:err.message});}
});
app.get('/api/supplier/activation/:token', simpleRateLimit({windowMs:60000,max:60,keyPrefix:'supplier-activation-check'}), (req,res)=>{
  try{
    const token=String(req.params.token||'');
    const hash=crypto.createHash('sha256').update(token).digest('hex');
    const row=db.prepare(`SELECT email,business_name AS businessName,display_name AS displayName,invite_expires_at AS expiresAt FROM supplier_onboarding WHERE invite_token_hash=?`).get(hash);
    if(!row || !row.expiresAt || new Date(row.expiresAt).getTime()<Date.now()) return res.status(404).json({error:'Activation link is invalid or expired'});
    res.json({supplier:row,listingCount:listOwnerRentalListings(row.email).length});
  }catch(err){res.status(400).json({error:err.message});}
});
app.post('/api/supplier/activation', simpleRateLimit({windowMs:15*60*1000,max:12,keyPrefix:'supplier-activation'}), (req,res)=>{
  try{
    if(req.body?.termsAccepted!==true) return res.status(400).json({error:'Platform terms must be accepted before supplier activation',code:'TERMS_ACCEPTANCE_REQUIRED'});
    const result=activateSupplierInvite(req.body?.token,{password:req.body?.password});
    const session=createAppSession(result.user.userId); setSessionCookie(res,session.token);
    res.json(result);
  }catch(err){res.status(err.code==='INVITE_INVALID'||err.code==='INVITE_EXPIRED'?404:400).json({error:err.message,code:err.code||null});}
});
app.post('/api/supplier/listings/confirm-current', requireRole('supplier','admin'), (req,res)=>{
  try{res.json(confirmSupplierListings(req.appUser.email,{listingIds:req.body?.listingIds||null}));}catch(err){res.status(400).json({error:err.message});}
});

app.get('/api/admin/dashboard', requireRole('admin'), (req,res)=>{
  try { res.json(getAdminDashboardData()); }
  catch(err){ res.status(400).json({error:err.message}); }
});

app.post('/api/admin/listings/:listingId/moderation', requireRole('admin'), (req,res)=>{
  try{
    const listing=setListingModerationStatus(
      req.params.listingId,
      req.body?.status || 'active',
      req.body?.reason || null
    );
    if(!listing) return res.status(404).json({error:'Listing not found'});
    res.json({listing});
  }catch(err){ res.status(400).json({error:err.message}); }
});

app.post('/api/rentals/disputes', simpleRateLimit({windowMs:60000,max:10,keyPrefix:'dispute-create'}), (req,res)=>{
  try{
    const {bookingId,openedBy='customer',reason,details=null,accessToken=''}=req.body||{};
    if(!bookingId||!reason) return res.status(400).json({error:'bookingId and reason are required'});
    const safeReason=String(reason).trim();
    const safeDetails=details==null?null:String(details).trim();
    if(!safeReason || safeReason.length>500) return res.status(400).json({error:'Dispute reason must be 1–500 characters'});
    if(safeDetails && safeDetails.length>5000) return res.status(400).json({error:'Dispute details are too long'});

    const user=sessionUser(req);
    const booking=getRentalBookingById(bookingId);
    if(!booking) return res.status(404).json({error:'Booking not found'});
    const supplierAllowed=canSupplierManageBooking(user,bookingId);
    const accountCustomerAllowed=!!(
      user?.email &&
      String(booking.customerEmail||'').toLowerCase()===String(user.email).toLowerCase()
    );
    // A guest link must never override an authenticated account identity.
    const guestCustomerAllowed=!user&&!!verifyBookingPaymentToken(bookingId,accessToken);
    if(!supplierAllowed && !accountCustomerAllowed && !guestCustomerAllowed){
      return res.status(403).json({error:'Booking access denied'});
    }

    const safeOpenedBy=supplierAllowed ? 'supplier' : 'customer';
    const dispute=createRentalDispute({bookingId,openedBy:safeOpenedBy,reason:safeReason,details:safeDetails});
    const listing=getRentalListing(booking.listingId);
    if(listing?.ownerEmail){
      createRentalNotification({
        uniqueKey:`dispute:${dispute.disputeId}:supplier`,
        audience:'supplier',userEmail:listing.ownerEmail,bookingId,
        type:'dispute.opened',title:'Dispute opened',
        message:`Dispute opened for booking ${bookingId}: ${safeReason}.`
      });
    }
    if(booking?.customerEmail){
      createRentalNotification({
        uniqueKey:`dispute:${dispute.disputeId}:customer`,
        audience:'customer',userEmail:booking.customerEmail,bookingId,
        type:'dispute.opened',title:'Dispute opened',
        message:`A dispute was opened for booking ${bookingId}: ${safeReason}.`
      });
    }
    res.json({dispute});
  }catch(err){
    const status=err.code==='DISPUTE_ALREADY_OPEN'?409:(err.code==='BOOKING_NOT_FOUND'?404:400);
    res.status(status).json({error:err.message,code:err.code||null});
  }
});

// V100 — provider-confirmed security-deposit release/capture.
// Only admins can finalize collateral movement after return/claim review.
app.post('/api/admin/bookings/:bookingId/deposit/release', requireRole('admin'), simpleRateLimit({windowMs:60000,max:20,keyPrefix:'deposit-release'}), requireStripe, async (req,res)=>{
  try{
    const booking=getRentalBookingById(req.params.bookingId);
    if(!booking)return res.status(404).json({error:'Booking not found'});
    if(booking.securityDepositStatus!=='release_pending')return res.status(409).json({error:'Deposit is not pending release'});
    if(!booking.securityDepositPaymentIntentId)return res.status(409).json({error:'No deposit authorization exists'});
    const listing=getRentalListing(booking.listingId);
    const connection=getDirectMerchantConnectionByEmail(db,listing?.ownerEmail);
    if(!connection?.stripeAccountId)return res.status(409).json({error:'Supplier Stripe account not found'});
    const intent=await retrieveDirectChargePaymentIntent(stripe,{accountId:connection.stripeAccountId,paymentIntentId:booking.securityDepositPaymentIntentId});
    if(String(intent.metadata?.bookingId||'')!==String(booking.bookingId)||String(intent.metadata?.purpose||'')!=='security_deposit')return res.status(409).json({error:'Deposit authorization identity mismatch'});
    if(intent.status==='requires_capture') await cancelDirectChargePaymentIntent(stripe,{accountId:connection.stripeAccountId,paymentIntentId:intent.id,idempotencyKey:`booking:${booking.bookingId}:deposit-release`});
    else if(intent.status!=='canceled') return res.status(409).json({error:`Deposit cannot be released from provider status ${intent.status}`});
    setRentalSecurityDepositProviderState(booking.bookingId,{paymentIntentId:intent.id,providerStatus:'canceled',depositStatus:'released'});
    const updated=resolveRentalSecurityDeposit(booking.bookingId,{status:'released',resolution:String(req.body?.resolution||'Deposit authorization released after satisfactory return.').slice(0,3000)});
    if(updated.customerEmail)createRentalNotification({uniqueKey:`booking:${booking.bookingId}:deposit:released:customer`,audience:'customer',userEmail:updated.customerEmail,bookingId:booking.bookingId,type:'deposit.released',title:'Security deposit released',message:`Your €${Number(updated.securityDepositAmount||0).toFixed(2)} security deposit authorization has been released.`});
    res.json({booking:updated,deposit:{status:'released',amount:Number(updated.securityDepositAmount||0)}});
  }catch(err){res.status(400).json({error:process.env.NODE_ENV==='production'?'Unable to release security deposit':err.message});}
});

app.post('/api/admin/bookings/:bookingId/deposit/capture', requireRole('admin'), simpleRateLimit({windowMs:60000,max:10,keyPrefix:'deposit-capture'}), requireStripe, async (req,res)=>{
  try{
    const booking=getRentalBookingById(req.params.bookingId);
    if(!booking)return res.status(404).json({error:'Booking not found'});
    if(booking.securityDepositStatus!=='claim_pending')return res.status(409).json({error:'Deposit claim is not pending review'});
    if(!booking.securityDepositPaymentIntentId)return res.status(409).json({error:'No deposit authorization exists'});
    const reason=String(req.body?.resolution||'').trim();
    if(reason.length<10||reason.length>3000)return res.status(400).json({error:'A clear damage/claim resolution is required'});
    const maxAmount=Math.round(Math.max(0,Number(booking.securityDepositAmount||0))*100);
    const requested=Number(req.body?.amount);
    const captureCents=Number.isFinite(requested)?Math.round(requested*100):maxAmount;
    if(captureCents<=0||captureCents>maxAmount)return res.status(400).json({error:'Capture amount exceeds the authorized security deposit'});
    const listing=getRentalListing(booking.listingId);
    const connection=getDirectMerchantConnectionByEmail(db,listing?.ownerEmail);
    if(!connection?.stripeAccountId)return res.status(409).json({error:'Supplier Stripe account not found'});
    const intent=await retrieveDirectChargePaymentIntent(stripe,{accountId:connection.stripeAccountId,paymentIntentId:booking.securityDepositPaymentIntentId});
    if(String(intent.metadata?.bookingId||'')!==String(booking.bookingId)||String(intent.metadata?.purpose||'')!=='security_deposit'||intent.status!=='requires_capture')return res.status(409).json({error:'Deposit authorization is not capture-ready'});
    const captured=await captureDirectSecurityDeposit(stripe,{accountId:connection.stripeAccountId,paymentIntentId:intent.id,amountCents:captureCents,idempotencyKey:`booking:${booking.bookingId}:deposit-capture:${captureCents}`});
    setRentalSecurityDepositProviderState(booking.bookingId,{paymentIntentId:intent.id,providerStatus:captured.status,depositStatus:'captured'});
    const updated=resolveRentalSecurityDeposit(booking.bookingId,{status:'captured',resolution:reason});
    if(updated.customerEmail)createRentalNotification({uniqueKey:`booking:${booking.bookingId}:deposit:captured:${captureCents}:customer`,audience:'customer',userEmail:updated.customerEmail,bookingId:booking.bookingId,type:'deposit.captured',title:'Security deposit claim resolved',message:`€${(captureCents/100).toFixed(2)} of the security deposit was captured after claim review. Resolution: ${reason}`});
    res.json({booking:updated,deposit:{status:'captured',capturedAmount:captureCents/100,authorizedAmount:maxAmount/100}});
  }catch(err){res.status(400).json({error:process.env.NODE_ENV==='production'?'Unable to resolve security deposit claim':err.message});}
});

app.get('/api/admin/disputes', requireRole('admin'), (req,res)=>{
  try{ res.json({disputes:listRentalDisputes()}); }
  catch(err){ res.status(400).json({error:err.message}); }
});

app.post('/api/admin/disputes/:disputeId/resolve', requireRole('admin'), simpleRateLimit({windowMs:60000,max:30,keyPrefix:'dispute-resolve'}), (req,res)=>{
  try{
    const dispute=resolveRentalDispute(req.params.disputeId,req.body?.resolution);
    if(!dispute) return res.status(404).json({error:'Dispute not found'});
    res.json({dispute});
  }catch(err){
    const status=err.code==='DISPUTE_ALREADY_RESOLVED'?409:400;
    res.status(status).json({error:err.message,code:err.code||null});
  }
});



app.get('/api/customer/bookings', requireRole('customer','supplier','admin'), (req,res)=>{
  try{
    res.json({bookings:listCustomerRentalBookings(req.appUser.email)});
  }catch(err){res.status(400).json({error:err.message});}
});

app.get('/api/customer/bookings/:bookingId', (req,res)=>{
  try{
    const user=sessionUser(req);
    let booking=null;
    if(user?.email){
      booking=listCustomerRentalBookings(user.email).find(b=>b.bookingId===req.params.bookingId)||null;
    }
    // A guest link cannot impersonate a different renter in an authenticated
    // supplier/customer session; sign out before opening a guest booking.
    if(!booking && !user){
      booking=getCustomerBookingByAccessToken(req.params.bookingId,req.query.accessToken||'');
    }
    if(!booking) return res.status(403).json({error:'Booking access denied'});
    res.setHeader('Cache-Control','no-store, private');
    res.json({
    booking,
    timeline:listBookingNotifications(req.params.bookingId),
    guestAccess:{revoked:Boolean(booking.guestAccessRevokedAt),revokedAt:booking.guestAccessRevokedAt||null}
  });
  }catch(err){res.status(400).json({error:err.message});}
});


// V191: recovery alternatives after a supplier decline / automatic no-response decline.
app.get('/api/customer/bookings/:bookingId/alternatives', (req,res)=>{
  try{
    const user=sessionUser(req);
    let booking=null;
    if(user?.email){
      booking=listCustomerRentalBookings(user.email).find(b=>b.bookingId===req.params.bookingId)||null;
    }
    // A guest link cannot impersonate a different renter in an authenticated
    // supplier/customer session; sign out before opening a guest booking.
    if(!booking && !user){
      booking=getCustomerBookingByAccessToken(req.params.bookingId,req.query.accessToken||'');
    }
    if(!booking) return res.status(403).json({error:'Booking access denied'});
    const status=String(booking.status||'').toLowerCase();
    if(!['declined','expired'].includes(status)) return res.json({alternatives:[],reason:'booking_not_declined'});

    const original=getFullRentalListing(booking.listingId)||{};
    const originalPrice=Math.max(0,Number(original.priceDay||0));
    const requestedQty=Math.max(1,Number(booking.quantity||1));
    const same=(a,b)=>String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase();
    const scored=[];

    for(const listing of listPublicRentalListings()){
      if(!listing || String(listing.id)===String(booking.listingId)) continue;
      // V191 recovery flow always requires a fresh supplier confirmation.
      if(String(listing.bookingMode||'request')==='instant') continue;
      if(Number(listing.quantity||0)<requestedQty) continue;
      if(original.category && !same(listing.category,original.category)) continue;
      if(original.city){
        const zones=Array.isArray(listing.deliveryZones)?listing.deliveryZones:String(listing.deliveryZones||'').split(',').map(x=>x.trim()).filter(Boolean);
        const servesOriginalCity=same(listing.city,original.city)||zones.some(z=>same(z,original.city));
        if(!servesOriginalCity) continue;
      }
      let availability=null;
      try{
        availability=getAvailability({listingId:String(listing.id),startDate:booking.startDate,endDate:booking.endDate,requestedQuantity:requestedQty});
      }catch{}
      if(!availability?.available) continue;

      let score=0;
      if(original.category && same(listing.category,original.category)) score+=70;
      if(original.city && same(listing.city,original.city)) score+=40;
      else if(original.country && same(listing.country,original.country)) score+=18;
      const price=Math.max(0,Number(listing.priceDay||0));
      if(originalPrice>0 && price>0){
        const ratio=Math.min(originalPrice,price)/Math.max(originalPrice,price);
        score+=Math.round(ratio*22);
      }
      const responseHours=Math.max(1,Math.min(48,Number(listing.supplierResponseHours||4)));
      score+=Math.max(0,12-Math.min(12,responseHours));
      scored.push({
        score,
        id:String(listing.id),
        title:String(listing.title||'Rental item'),
        category:String(listing.category||''),
        city:String(listing.city||''),
        country:String(listing.country||''),
        priceDay:price,
        priceWeek:Math.max(0,Number(listing.priceWeek||0)),
        deposit:Math.max(0,Number(listing.deposit||0)),
        quantity:Number(listing.quantity||0),
        remainingQuantity:Number(availability.remainingQuantity||0),
        supplierResponseHours:responseHours,
        pickupEnabled:listing.pickupEnabled!==false,
        deliveryEnabled:Boolean(listing.deliveryEnabled || listing.accommodationDelivery==='yes' || listing.accommodationDelivery===true),
        delivery:String(listing.delivery||''),
        accommodationDelivery:listing.accommodationDelivery||'no',
        hotelDeliveryFee:Math.max(0,Number(listing.hotelDeliveryFee||0)),
        minOrder:Math.max(0,Number(listing.minOrder||0)),
        deliveryLeadTime:String(listing.deliveryLeadTime||''),
        deliveryWindow:String(listing.deliveryWindow||''),
        coverPhoto:String(listing.coverPhoto||''),
        description:String(listing.description||'').slice(0,500),
        cancellationPolicy:String(listing.cancellationPolicy||'moderate'),
        bookingMode:'request'
      });
    }
    scored.sort((a,b)=>b.score-a.score || a.supplierResponseHours-b.supplierResponseHours || a.priceDay-b.priceDay);
    res.setHeader('Cache-Control','no-store, private');
    res.json({
      alternatives:scored.slice(0,6).map(({score,...x})=>x),
      context:{bookingId:booking.bookingId,startDate:booking.startDate,endDate:booking.endDate,quantity:requestedQty,city:original.city||booking.deliveryCity||'',country:original.country||'',category:original.category||'',autoDeclined:Boolean(booking.supplierAutoDeclinedAt)}
    });
  }catch(err){res.status(400).json({error:err.message});}
});

app.post('/api/customer/bookings/:bookingId/revoke-guest-link', requireRole('customer','supplier','admin'), (req,res)=>{
  const user=sessionUser(req);
  const booking=getRentalBookingById(req.params.bookingId);
  if(!booking) return res.status(404).json({error:'Booking not found'});
  const ownsBooking=user?.email && String(booking.customerEmail||'').toLowerCase()===String(user.email).toLowerCase();
  if(!ownsBooking && !canSupplierManageBooking(user,req.params.bookingId)) return res.status(403).json({error:'Forbidden'});
  revokeBookingGuestAccess(req.params.bookingId);
  res.setHeader('Cache-Control','no-store, private');
  res.json({ok:true});
});


const uploadsDir = runtimeConfig.uploadsDir;
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir,{
  dotfiles:'deny', fallthrough:false,
  setHeaders(res){
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Cache-Control','public, max-age=31536000, immutable');
    res.setHeader('Content-Security-Policy',"default-src 'none'; img-src 'self'; sandbox");
  }
}));

function matchesImageSignature(bytes,mime){
  if(!Buffer.isBuffer(bytes) || bytes.length<12) return false;
  if(mime==='image/jpeg') return bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff;
  if(mime==='image/png') return bytes.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if(mime==='image/webp') return bytes.subarray(0,4).toString('ascii')==='RIFF' && bytes.subarray(8,12).toString('ascii')==='WEBP';
  return false;
}

function sanitizeExt(mime='image/jpeg'){
  if(mime==='image/png') return 'png';
  if(mime==='image/webp') return 'webp';
  return 'jpg';
}

app.post('/api/uploads/image', simpleRateLimit({windowMs:60000,max:30,keyPrefix:'upload'}), requireRole('supplier','admin'), (req,res)=>{
  try{
    const { dataUrl, fileName='image' } = req.body || {};
    if(!dataUrl || !/^data:image\/(png|jpeg|webp);base64,/.test(dataUrl)){
      return res.status(400).json({ error:'Valid PNG/JPEG/WEBP image is required' });
    }

    const [meta,b64]=dataUrl.split(',');
    const mime=(meta.match(/^data:(image\/[^;]+);base64$/)||[])[1] || 'image/jpeg';
    const bytes=Buffer.from(b64,'base64');
    const maxBytes=8*1024*1024;
    if(bytes.length>maxBytes){
      return res.status(413).json({error:'Image is too large. Maximum size is 8 MB.'});
    }
    if(bytes.length<32 || !matchesImageSignature(bytes,mime)){
      return res.status(400).json({error:'Image content does not match the declared file type.'});
    }
    const ext=sanitizeExt(mime);
    const safeBase=String(fileName).replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,40) || 'image';
    const name=`${Date.now()}-${Math.random().toString(36).slice(2,8)}-${safeBase}.${ext}`;
    const filePath=path.join(uploadsDir,name);
    fs.writeFileSync(filePath,bytes);

    res.json({ url:`/uploads/${name}` });
  }catch(err){
    res.status(400).json({ error:err.message });
  }
});

app.use(express.static(__dirname));


let supplierMaintenanceRunning=false;
async function runSupplierReliabilityMaintenance(){
  if(supplierMaintenanceRunning) return;
  supplierMaintenanceRunning=true;
  try{
    markStaleSupplierListings({days:Number(process.env.SUPPLIER_LISTING_FRESH_DAYS||30)});
    for(const supplier of listSuppliersNeedingFreshnessReminder({days:Number(process.env.SUPPLIER_FRESHNESS_REMINDER_DAYS||25)})){
      enqueueTransactionalEmail({recipient:supplier.email,templateKey:'supplier_freshness',subject:'Please confirm your RentInOrbit listings',dedupeKey:`supplier-freshness:${supplier.email}:${new Date().toISOString().slice(0,10)}`,payload:{dashboardUrl:`${PUBLIC_BASE_URL}/?view=supplier-listings`}});
      markSupplierFreshnessReminder(supplier.email);
    }
    const now=Date.now();
    for(const item of listSupplierResponseMaintenance(new Date())){
      const schedule=supplierResponseSchedule(item.createdAt,item.supplierResponseHours||4,item.supplierTimezone||'UTC');
      const reminder1=new Date(schedule.reminder1At).getTime(), reminder2=new Date(schedule.reminder2At).getTime(), due=new Date(item.supplierResponseDueAt||schedule.dueAt).getTime();
      if(now>=reminder1 && Number(item.supplierReminderStage||0)<1){
        enqueueTransactionalEmail({recipient:item.supplierEmail,templateKey:'supplier_response_reminder',subject:`RentInOrbit booking is waiting · ${item.title}`,dedupeKey:`supplier-response:${item.bookingId}:1`,payload:{bookingId:item.bookingId,listingTitle:item.title,dueAt:item.supplierResponseDueAt,dashboardUrl:`${PUBLIC_BASE_URL}/?view=supplier-bookings&booking=${encodeURIComponent(item.bookingId)}`}});
        setSupplierReminderStage(item.bookingId,1);
      }
      if(now>=reminder2 && Number(item.supplierReminderStage||0)<2){
        enqueueTransactionalEmail({recipient:item.supplierEmail,templateKey:'supplier_response_reminder',subject:`Urgent: respond to RentInOrbit booking · ${item.title}`,dedupeKey:`supplier-response:${item.bookingId}:2`,payload:{bookingId:item.bookingId,listingTitle:item.title,dueAt:item.supplierResponseDueAt,dashboardUrl:`${PUBLIC_BASE_URL}/?view=supplier-bookings&booking=${encodeURIComponent(item.bookingId)}`}});
        setSupplierReminderStage(item.bookingId,2);
      }
      if(Number.isFinite(due) && due>0 && now>=due){
        try{
          const cancelled=await cancelBookingWithPaymentHandling(item.bookingId,'Supplier did not respond before the deadline',{forceFullRefund:true});
          if(cancelled){
            const row=getRentalBookingById(item.bookingId); if(row?.status==='cancelled') setRentalBookingStatusAfterRefund(item.bookingId,'declined');
            markSupplierAutoDeclined(item.bookingId); recordSupplierMissedResponse(item.supplierEmail,{suspendAt:Number(process.env.SUPPLIER_MISSED_RESPONSE_SUSPEND_AT||3)});
            const final=getRentalBookingById(item.bookingId); try{queueBookingStatusEmail(final,'declined',{message:'The supplier did not respond in time. Any eligible payment is being returned.'});}catch{}
          }
        }catch(err){console.warn('Supplier auto-decline failed',item.bookingId,err.message);}
      }
    }
  }finally{supplierMaintenanceRunning=false;}
}
setTimeout(()=>runSupplierReliabilityMaintenance().catch(err=>console.warn('Supplier maintenance failed',err.message)),1500);
const supplierMaintenanceTimer=setInterval(()=>runSupplierReliabilityMaintenance().catch(err=>console.warn('Supplier maintenance failed',err.message)),5*60*1000);
supplierMaintenanceTimer.unref?.();

const server=app.listen(port,runtimeConfig.host, () => {
  const database=checkDatabase();
  const config=productionConfigReport();
  console.log(JSON.stringify({type:'startup',service:'rentinorbit',version:APP_VERSION,environment:runtimeConfig.nodeEnv,host:runtimeConfig.host,port,database:{driver:databaseRuntime.driver,source:databaseRuntime.source,persistent:databaseRuntime.persistent,migrationVersion:database.migrationVersion},stripe:config.stripe,paymentProvider,email:config.email,ready:launchGate().ready}));
});
let emailWorkerTimer=null;
let emailWorkerPromise=null;
function runEmailWorker(){
  if(emailWorkerPromise)return emailWorkerPromise;
  emailWorkerPromise=processTransactionalEmailOutbox().finally(()=>{emailWorkerPromise=null});
  return emailWorkerPromise;
}
if(process.env.EMAIL_WORKER_ENABLED==='true'){
  const recovered=recoverInterruptedTransactionalEmails();
  const interval=Math.max(5000,Math.min(300000,Number(process.env.EMAIL_WORKER_INTERVAL_MS)||15000));
  emailWorkerTimer=setInterval(()=>runEmailWorker().catch(err=>console.error(JSON.stringify({type:'email_worker_error',error:safeOperationalError(err)}))),interval);
  emailWorkerTimer.unref?.();
  setTimeout(()=>runEmailWorker().catch(err=>console.error(JSON.stringify({type:'email_worker_startup_error',error:safeOperationalError(err)}))),500).unref?.();
  console.log(JSON.stringify({type:'email_worker_started',provider:process.env.EMAIL_PROVIDER||'console',intervalMs:interval,recovered}));
}

let shuttingDown=false;
function gracefulShutdown(signal){
  if(shuttingDown)return;shuttingDown=true;
  console.log(JSON.stringify({type:'shutdown',signal,timestamp:new Date().toISOString()}));
  clearInterval(bookingExpiryTimer);
  if(emailWorkerTimer)clearInterval(emailWorkerTimer);
  if(!server.listening){try{closeDatabase()}catch{}process.exit(process.exitCode||1);return}
  server.close(async err=>{
    if(err){console.error(JSON.stringify({type:'http_shutdown_error',error:safeOperationalError(err)}));process.exitCode=1}
    if(emailWorkerPromise){
      await Promise.race([emailWorkerPromise.catch(()=>{}),new Promise(resolve=>setTimeout(resolve,5000))]);
    }
    try{closeDatabase()}catch(dbError){console.error(JSON.stringify({type:'database_shutdown_error',error:safeOperationalError(dbError)}));process.exitCode=1}
    process.exit(process.exitCode||0);
  });
  server.closeIdleConnections?.();
  setTimeout(()=>{console.error('Forced shutdown after timeout');server.closeAllConnections?.();try{closeDatabase()}catch{}process.exit(1)},10000).unref();
}
process.on('SIGTERM',()=>gracefulShutdown('SIGTERM'));
process.on('SIGINT',()=>gracefulShutdown('SIGINT'));
server.on('error',error=>{
  console.error(JSON.stringify({type:'server_error',code:String(error?.code||'UNKNOWN'),syscall:String(error?.syscall||'listen')}));
  process.exitCode=1;
  gracefulShutdown('serverError');
});
process.on('unhandledRejection',err=>console.error(JSON.stringify({type:'unhandled_rejection',error:safeOperationalError(err)})));
process.on('uncaughtException',err=>{console.error(JSON.stringify({type:'uncaught_exception',error:safeOperationalError(err)}));gracefulShutdown('uncaughtException')});

/* STAGING_CANCEL_EMAIL_V1 */
