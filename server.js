import express from 'express';
import Stripe from 'stripe';
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
  authenticateAppUser,
  createAppSession,
  getAppUserBySessionToken,
  deleteAppSession,
  seedDefaultUsers,
  saveFullRentalListing,
  listPublicRentalListings,
  listOwnerRentalListings,
  deleteOwnerRentalListing,
  saveStripeConnection,
  updateStripeConnectionCapability,
  getStripeConnectionByUserId,
  getStripeConnectionByEmail,
  verifyBookingPaymentToken,
  revokeBookingGuestAccess,
  setBookingPaymentDetails,
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
  acceptRentalAgreement,
  createOrGetRentalConversation,
  getRentalConversation,
  listRentalConversationsForUser,
  listRentalMessages,
  addRentalMessage,
  createRenterReview,
  getRenterReputation,
  getSupplierReputation
  ,databaseRuntime
  ,checkDatabase
  ,closeDatabase
  ,REQUIRED_SCHEMA_VERSION
} from './db.js';
import {assertProductionConfig,productionConfigReport,productionStorageReport,runtimeConfig} from './config.js';
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
      "script-src 'self' https://js.stripe.com https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://unpkg.com",
      "img-src 'self' data: blob: https://tile.openstreetmap.org",
      "font-src 'self' data:",
      "connect-src 'self' https://api.stripe.com https://tile.openstreetmap.org",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
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
const stripe = stripeKey ? new Stripe(stripeKey,{apiVersion:'2026-08-26.dahlia',appInfo:{name:'RentAll',version:runtimeConfig.appVersion}}) : null;

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

function sessionUser(req){
  const cookies=parseCookies(req);
  return getAppUserBySessionToken(cookies.rentall_session);
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
  if(!stripe || !booking?.stripePaymentIntentId) return null;

  const intent=await stripe.paymentIntents.retrieve(booking.stripePaymentIntentId);

  if(intent.status==='succeeded'){
    if(booking.stripeRefundId) return null;
    const alreadyRefunded=Math.max(0,Number(booking.refundAmount||0));
    const orderValue=Math.max(0,Number(booking.orderValue||0));
    const remaining=Math.max(0,orderValue-alreadyRefunded);
    const requested=Math.max(0,Number(refundAmount||0));
    const safeRefund=Math.min(requested,remaining);
    const cents=Math.round(safeRefund*100);
    if(cents<=0) return null;

    const refund=await stripe.refunds.create({
      payment_intent:intent.id,
      amount:cents,
      reverse_transfer:true,
      refund_application_fee:true,
      reason:'requested_by_customer',
      metadata:{bookingId:booking.bookingId}
    },{idempotencyKey:`booking:${booking.bookingId}:cancellation-refund:${cents}`});

    setStripeRefundDetails(booking.bookingId,{
      refundId:refund.id,
      refundStatus:refund.status,
      refundAmount:cents/100
    });
    return refund;
  }

  const cancelable=new Set([
    'requires_payment_method','requires_confirmation',
    'requires_action','requires_capture'
  ]);
  if(cancelable.has(intent.status)){
    await stripe.paymentIntents.cancel(intent.id);
  }
  return null;
}

async function cancelBookingWithPaymentHandling(bookingId,reason,{forceFullRefund=false}={}){
  const booking=getRentalBookingById(bookingId);
  if(!booking) return null;
  const listing=getRentalListing(booking.listingId);
  const refundAmount=forceFullRefund
    ? Number(booking.orderValue||0)
    : calculateRefundAmount(booking,listing?.cancellationPolicy||'moderate');

  await handleStripeCancellationForBooking(booking,refundAmount);

  const result=cancelRentalBookingWithRefund(bookingId,reason);
  // Supplier decline always gets a full refund, overriding customer cancellation policy.
  if(forceFullRefund && result?.booking){
    const row=result.booking;
    // cancelRentalBookingWithRefund calculates by policy; report the actual full refund.
    row.refundAmount=refundAmount;
  }
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
  const token=req.body?.accessToken || req.query?.accessToken || '';
  return !!verifyBookingPaymentToken(bookingId,token);
}

function setSessionCookie(res,token,maxAgeSeconds=14*86400){
  const secure = String(appUrl).startsWith('https://') ? '; Secure' : '';
  res.setHeader('Set-Cookie',
    `rentall_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`
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

function stripeV2RecipientStatus(account){
  const cap=account?.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers;
  const status=String(cap?.status||'unknown');
  const requirements=Array.isArray(cap?.requirements)?cap.requirements:[];
  return {
    accountId:account?.id||null,
    connectApi:'v2_recipient',
    transferCapabilityStatus:status,
    state:status==='active'?'active':(status==='pending'?'pending':'needs_information'),
    requirements
  };
}

function requireSupplierTransferCapability(connection,res){
  if(!connection?.stripeAccountId){
    res.status(409).json({error:'Supplier has not connected payouts',code:'SUPPLIER_PAYOUTS_NOT_CONNECTED'});
    return false;
  }
  // V118 fail-closed bridge: legacy stored IDs cannot be treated as transfer-ready
  // from v1 charges_enabled/payouts_enabled fields. Accounts v2 capability
  // retrieval must prove stripe_transfers === active before payments are enabled.
  if(!String(connection.connectApi||'').startsWith('v2')){
    res.status(409).json({error:'Supplier payout account must complete Stripe Connect v2 migration before accepting payments.',code:'SUPPLIER_CONNECT_V2_REQUIRED'});
    return false;
  }
  if(String(connection.transferCapabilityStatus||'')!=='active'){
    res.status(409).json({error:'Supplier payouts are not active yet.',code:'SUPPLIER_TRANSFERS_INACTIVE'});
    return false;
  }
  return true;
}

// Stripe webhook must receive RAW body.
function validateRentalPaymentIntentBinding(pi,booking){
  if(!pi||!booking) return {ok:false,reason:'missing_payment_or_booking'};
  if(String(pi.id||'')!==String(booking.stripePaymentIntentId||'')) return {ok:false,reason:'payment_intent_id_mismatch'};
  if(String(pi.metadata?.bookingId||'')!==String(booking.bookingId||'')) return {ok:false,reason:'booking_metadata_mismatch'};
  if(String(pi.metadata?.purpose||'rental_payment')!=='rental_payment') return {ok:false,reason:'payment_purpose_mismatch'};
  const expectedAmount=Math.round(Math.max(0,Number(booking.orderValue||0))*100);
  if(Number(pi.amount)!==expectedAmount) return {ok:false,reason:'payment_amount_mismatch'};
  if(String(pi.currency||'').toLowerCase()!=='eur') return {ok:false,reason:'payment_currency_mismatch'};
  return {ok:true};
}

function validateSecurityDepositIntentBinding(pi,booking){
  if(!pi||!booking) return {ok:false,reason:'missing_payment_or_booking'};
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
      if (process.env.STRIPE_WEBHOOK_SECRET) {
        event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          process.env.STRIPE_WEBHOOK_SECRET
        );
      } else {
        if(process.env.NODE_ENV==='production'){
          return res.status(503).send('Stripe webhook secret is not configured');
        }
        event = JSON.parse(req.body.toString('utf8'));
      }
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
          const binding=booking?validateSecurityDepositIntentBinding(pi,booking):{ok:false,reason:'booking_not_found'};
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
          const binding=booking?validateSecurityDepositIntentBinding(pi,booking):{ok:false,reason:'booking_not_found'};
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
              const binding=validateRentalPaymentIntentBinding(pi,booking);
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

              const terminalNonPayable=new Set(['expired','cancelled','declined']);
              if(terminalNonPayable.has(booking.status) && !booking.stripeRefundId){
                const refund=await stripe.refunds.create({
                  payment_intent:pi.id,
                  reverse_transfer:true,
                  refund_application_fee:true,
                  reason:'requested_by_customer',
                  metadata:{bookingId,reason:`late_payment_after_${booking.status}`}
                },{idempotencyKey:`booking:${bookingId}:late-terminal-refund`});
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
            const paidBooking=getRentalBookingById(bookingId);
            const paidListing=paidBooking ? getRentalListing(paidBooking.listingId) : null;
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
          }
          console.log('Payment succeeded:', pi.id);
          break;
        }
        case 'payment_intent.payment_failed': {
          const pi=event.data.object;
          const bookingId=pi.metadata?.bookingId;
          if(bookingId){
            const booking=getRentalBookingById(bookingId);
            const binding=booking?validateRentalPaymentIntentBinding(pi,booking):{ok:false,reason:'booking_not_found'};
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
  lt:{eyebrow:'RentAll nuomos platforma',fallbackDescription:'Nuomojamas daiktas per RentAll.',location:'Vieta',seeListing:'Žiūrėti skelbimą',dailyPrice:'Kaina dienai',available:'Kiekis',fulfilment:'Atsiėmimas / pristatymas',delivery:'Galimas pristatymas',pickup:'Atsiėmimas',cta:'Peržiūrėti prieinamumą ir rezervuoti'},
  en:{eyebrow:'RentAll marketplace',fallbackDescription:'Rental item available through RentAll.',location:'Location',seeListing:'See listing',dailyPrice:'Daily price',available:'Available',fulfilment:'Pickup / delivery',delivery:'Delivery available',pickup:'Pickup',cta:'View availability & book'},
  es:{eyebrow:'Marketplace RentAll',fallbackDescription:'Artículo disponible para alquilar en RentAll.',location:'Ubicación',seeListing:'Ver anuncio',dailyPrice:'Precio por día',available:'Disponibles',fulfilment:'Recogida / entrega',delivery:'Entrega disponible',pickup:'Recogida',cta:'Ver disponibilidad y reservar'},
  de:{eyebrow:'RentAll Marktplatz',fallbackDescription:'Mietartikel über RentAll verfügbar.',location:'Ort',seeListing:'Anzeige ansehen',dailyPrice:'Preis pro Tag',available:'Verfügbar',fulfilment:'Abholung / Lieferung',delivery:'Lieferung verfügbar',pickup:'Abholung',cta:'Verfügbarkeit prüfen & buchen'},
  ru:{eyebrow:'Маркетплейс RentAll',fallbackDescription:'Вещь доступна для аренды через RentAll.',location:'Место',seeListing:'Открыть объявление',dailyPrice:'Цена за день',available:'Доступно',fulfilment:'Самовывоз / доставка',delivery:'Доставка доступна',pickup:'Самовывоз',cta:'Проверить доступность и забронировать'}
};
function pageShell({req,title,description,body,canonicalPath}){
  const origin=publicOrigin(req),canonical=origin+canonicalPath,lang=pageLanguage(req),c=PAGE_SHELL_COPY[lang]||PAGE_SHELL_COPY.en;
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeEmailHtml(title)}</title><meta name="description" content="${escapeEmailHtml(description)}"><link rel="canonical" href="${escapeEmailHtml(canonical)}"><meta property="og:title" content="${escapeEmailHtml(title)}"><meta property="og:description" content="${escapeEmailHtml(description)}"><meta property="og:url" content="${escapeEmailHtml(canonical)}"><meta property="og:type" content="website"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/light-premium-v161.css"></head><body class="theme-aurora"><header class="topbar"><div class="container nav"><a class="brand" href="/">RentAll</a><nav class="navlinks"><a href="/">${c.marketplace}</a><a href="/help?lang=${lang}">${c.help}</a></nav></div></header><main class="section"><div class="container">${body}</div></main><footer><div class="container footer-grid"><div><b>RentAll</b><p>${c.tagline}</p></div><div><a href="/terms?lang=${lang}">${c.terms}</a><a href="/privacy?lang=${lang}">${c.privacy}</a><a href="/cookies?lang=${lang}">${c.cookies}</a></div><div><a href="/fees?lang=${lang}">${c.fees}</a><a href="/help?lang=${lang}">${c.help}</a></div></div></footer></body></html>`;
}

app.get('/listing/:listingId/:slug?',(req,res)=>{
  const listing=getFullRentalListing(req.params.listingId);
  if(!listing||listing.moderationStatus==='blocked'||listing.moderationStatus==='paused')return res.status(404).send('Listing not found');
  const origin=publicOrigin(req),canonicalPath=`/listing/${encodeURIComponent(listing.id)}/${seoSlug(listing.title)}`;
  const lang=pageLanguage(req),seoCopy=LISTING_SEO_COPY[lang]||LISTING_SEO_COPY.en;
  const location=[listing.city,listing.country].filter(Boolean).join(', '),description=String(listing.description||seoCopy.fallbackDescription).slice(0,160);
  const image=absoluteAsset(origin,listing.coverPhoto||listing.photos?.[0]);
  const title=`${listing.title}${location?' · '+location:''} | RentAll`;
  const body=`<article class="seo-listing-page"><div class="eyebrow">${seoCopy.eyebrow}</div><h1>${escapeEmailHtml(listing.title)}</h1><p class="hero-copy">${escapeEmailHtml(listing.description||seoCopy.fallbackDescription)}</p>${image?`<img src="${escapeEmailHtml(image)}" alt="${escapeEmailHtml(listing.title)}" style="width:min(720px,100%);max-height:480px;object-fit:cover;border-radius:22px;border:1px solid #dde4de">`:''}<div class="v92-facts" style="margin:24px 0"><div><span>${seoCopy.location}</span><b>${escapeEmailHtml(location||seoCopy.seeListing)}</b></div><div><span>${seoCopy.dailyPrice}</span><b>€${Number(listing.priceDay||0).toFixed(2)}</b></div><div><span>${seoCopy.available}</span><b>${Number(listing.quantity||1)}</b></div><div><span>${seoCopy.fulfilment}</span><b>${listing.deliveryEnabled?seoCopy.delivery:seoCopy.pickup}</b></div></div><p><a class="primary" href="/?listing=${encodeURIComponent(listing.id)}">${seoCopy.cta}</a></p></article>`;
  let html=pageShell({req,title,description,body,canonicalPath});
  if(image)html=html.replace('</head>',`<meta property="og:image" content="${escapeEmailHtml(image)}"></head>`);
  res.type('html').send(html);
});

const LEGAL_COPY={
  lt:{
    help:['Pagalba ir DUK','RentAll sujungia nuomininkus su privačiais ir verslo tiekėjais. Prieš rezervuojant matysi kainą, prieinamumą, atsiėmimo ar pristatymo sąlygas ir atšaukimo taisykles.','Užsakymą, mokėjimo būseną, sutartį, žinutes ir problemos pranešimą rasi skiltyje „Mano užsakymai“.'],
    terms:['Naudojimosi ir nuomos taisyklės','Rezervuodamas patvirtini konkretaus skelbimo kainą, datas, kiekį, pristatymo ar atsiėmimo sąlygas, užstatą ir atšaukimo politiką. RentAll veikia kaip marketplace tarpininkas, o daikto nuomos santykis sudaromas tarp nuomininko ir tiekėjo.','Daiktas turi būti naudojamas pagal paskirtį, grąžintas sutartu laiku ir tokios būklės, kokios buvo perduotas, išskyrus normalų nusidėvėjimą. Ginčai ir žala nagrinėjami pagal užsakymo įrašus bei nuomos sutartį.'],
    privacy:['Privatumo politika','Tvarkome tik duomenis, reikalingus paskyrai, skelbimams, rezervacijoms, mokėjimams, saugumui, pagalbai ir teisinių pareigų vykdymui. Mokėjimo kortelių duomenų RentAll nesaugo — juos tvarko mokėjimų paslaugų teikėjas.','Kontaktiniai duomenys iki patvirtintos rezervacijos nėra skirti sandoriui išvesti už platformos ribų. Dėl duomenų teisių galima kreiptis į RentAll pagalbos kontaktą.'],
    cookies:['Slapukai','RentAll naudoja būtinus slapukus prisijungimui, saugumui ir sesijai palaikyti. Nebūtini analitiniai ar reklaminiai slapukai neturėtų būti įjungiami be tinkamo pasirinkimo ir sutikimo.','Kalbos ir dalis vartotojo pasirinkimų gali būti saugomi naršyklėje, kad platforma prisimintų nustatymus.'],
    fees:['Kainos ir mokesčiai','Prieš apmokėjimą klientui turi būti parodyta visa mokėtina suma: nuoma, pristatymas, platformos mokestis (jei taikomas) ir atskirai nurodytas užstatas.','Tiekėjo gaunama suma ir RentAll mokestis apskaičiuojami serveryje. Galutinė kainodara gali priklausyti nuo tiekėjo plano ir užsakymo dydžio, tačiau netikėtų mokesčių po patvirtinimo neturi atsirasti.']
  },
  en:{help:['Help & FAQ','RentAll connects renters with private and business suppliers. Before booking you can see price, availability, pickup or delivery conditions and the cancellation policy.','Your booking, payment status, agreement, messages and problem reporting are available in My bookings.'],terms:['Platform and rental terms','By booking you confirm the listing price, dates, quantity, pickup or delivery conditions, deposit and cancellation policy. RentAll operates as a marketplace intermediary; the rental relationship is between the renter and supplier.','Use the item only as intended and return it on time in the condition received, allowing for normal wear. Damage and disputes are handled using booking records and the rental agreement.'],privacy:['Privacy policy','We process data needed for accounts, listings, bookings, payments, safety, support and legal obligations. RentAll does not store payment-card details; the payment provider processes them.','Contact details before a confirmed booking are not intended to move the transaction off-platform. Contact RentAll support to exercise applicable data rights.'],cookies:['Cookies','RentAll uses essential cookies for sign-in, security and sessions. Non-essential analytics or advertising cookies should not be enabled without the appropriate choice and consent.','Language and some preferences may be stored in the browser so the marketplace can remember your settings.'],fees:['Pricing & fees','Before payment, the customer must see the full amount: rental, delivery, platform fee (if applicable), with any security deposit shown separately.','Supplier proceeds and RentAll fees are calculated server-side. Final pricing may vary by supplier plan and order size, but no unexpected fee should appear after confirmation.']},
  es:{help:['Ayuda y preguntas frecuentes','RentAll conecta a arrendatarios con proveedores particulares y empresas. Antes de reservar puedes ver precio, disponibilidad, recogida o entrega y política de cancelación.','Tus reservas, estado de pago, contrato, mensajes y reportes están en Mis reservas.'],terms:['Condiciones de la plataforma y del alquiler','Al reservar confirmas precio, fechas, cantidad, recogida o entrega, depósito y cancelación. RentAll actúa como intermediario del marketplace; la relación de alquiler es entre arrendatario y proveedor.','Usa el artículo para su finalidad y devuélvelo a tiempo en el estado recibido, salvo desgaste normal. Los daños y disputas se gestionan con los registros de la reserva y el contrato.'],privacy:['Política de privacidad','Tratamos los datos necesarios para cuentas, anuncios, reservas, pagos, seguridad, soporte y obligaciones legales. RentAll no almacena datos de tarjeta.','Los datos de contacto antes de una reserva confirmada no deben usarse para sacar la operación fuera de la plataforma.'],cookies:['Cookies','RentAll utiliza cookies esenciales para inicio de sesión, seguridad y sesión. Las cookies analíticas o publicitarias no esenciales requieren la elección y consentimiento correspondientes.','El idioma y algunas preferencias pueden guardarse en el navegador.'],fees:['Precios y comisiones','Antes del pago se muestra el total: alquiler, entrega, comisión de plataforma si aplica y el depósito por separado.','Los ingresos del proveedor y las comisiones de RentAll se calculan en el servidor y no deben aparecer cargos inesperados después de confirmar.']},
  de:{help:['Hilfe & FAQ','RentAll verbindet Mieter mit privaten und gewerblichen Anbietern. Vor der Buchung siehst du Preis, Verfügbarkeit, Abholung oder Lieferung und die Stornierungsbedingungen.','Buchung, Zahlungsstatus, Vertrag, Nachrichten und Problemmeldungen findest du unter Meine Buchungen.'],terms:['Plattform- und Mietbedingungen','Mit der Buchung bestätigst du Preis, Zeitraum, Menge, Abholung/Lieferung, Kaution und Stornierungsregeln. RentAll ist Marktplatzvermittler; das Mietverhältnis besteht zwischen Mieter und Anbieter.','Nutze den Artikel bestimmungsgemäß und gib ihn rechtzeitig im erhaltenen Zustand zurück, normale Abnutzung ausgenommen.'],privacy:['Datenschutz','Wir verarbeiten Daten für Konten, Inserate, Buchungen, Zahlungen, Sicherheit, Support und gesetzliche Pflichten. Kartendaten werden nicht von RentAll gespeichert.','Kontaktdaten vor einer bestätigten Buchung sollen nicht dazu dienen, die Transaktion außerhalb der Plattform abzuwickeln.'],cookies:['Cookies','RentAll nutzt notwendige Cookies für Anmeldung, Sicherheit und Sitzungen. Nicht notwendige Analyse- oder Werbe-Cookies benötigen die passende Auswahl und Einwilligung.','Sprache und einige Einstellungen können im Browser gespeichert werden.'],fees:['Preise & Gebühren','Vor der Zahlung wird der Gesamtbetrag angezeigt: Miete, Lieferung, Plattformgebühr falls zutreffend und eine Kaution separat.','Anbieterauszahlung und RentAll-Gebühren werden serverseitig berechnet; nach Bestätigung sollen keine unerwarteten Gebühren entstehen.']},
  ru:{help:['Помощь и вопросы','RentAll связывает арендаторов с частными и коммерческими поставщиками. До бронирования видны цена, доступность, самовывоз/доставка и правила отмены.','Бронирование, оплата, договор, сообщения и обращение по проблеме доступны в разделе «Мои бронирования».'],terms:['Условия платформы и аренды','Бронируя, вы подтверждаете цену, даты, количество, условия получения/доставки, депозит и отмену. RentAll выступает посредником marketplace; договор аренды заключается между арендатором и поставщиком.','Используйте вещь по назначению и возвращайте вовремя в полученном состоянии с учётом нормального износа.'],privacy:['Политика конфиденциальности','Мы обрабатываем данные для аккаунтов, объявлений, бронирований, платежей, безопасности, поддержки и юридических обязанностей. RentAll не хранит данные банковских карт.','Контактные данные до подтверждённого бронирования не предназначены для вывода сделки за пределы платформы.'],cookies:['Cookies','RentAll использует необходимые cookies для входа, безопасности и сессий. Необязательные аналитические или рекламные cookies требуют соответствующего выбора и согласия.','Язык и некоторые настройки могут сохраняться в браузере.'],fees:['Цены и комиссии','До оплаты показывается полная сумма: аренда, доставка, комиссия платформы при наличии, а депозит указывается отдельно.','Выплата поставщику и комиссия RentAll рассчитываются на сервере; после подтверждения не должно появляться неожиданных сборов.']}
};
for(const [pathName,key] of [['/help','help'],['/terms','terms'],['/privacy','privacy'],['/cookies','cookies'],['/fees','fees']]){
  app.get(pathName,(req,res)=>{
    const lang=pageLanguage(req),copy=LEGAL_COPY[lang]?.[key]||LEGAL_COPY.en[key];
    const stageNote=process.env.RENTALL_STAGING==='true'?'<div class="review-card"><b>Staging note</b><p>This policy text must receive professional legal review before public production launch.</p></div>':'';
    const body=`<div class="eyebrow">RentAll</div><h1>${escapeEmailHtml(copy[0])}</h1><div class="review-card"><p>${escapeEmailHtml(copy[1])}</p><p>${escapeEmailHtml(copy[2])}</p></div>${stageNote}<p><a class="secondary" href="/">← RentAll</a></p>`;
    res.type('html').send(pageShell({req,title:`${copy[0]} | RentAll`,description:copy[1],body,canonicalPath:pathName}));
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
    service:'rentall-marketplace',
    version:APP_VERSION,
    database:databaseCheck.ok?'ok':'error',
    migrationVersion:databaseCheck.migrationVersion,
    stripe:stripe ? 'configured' : 'not_configured',
    environment:process.env.NODE_ENV || 'development',
    timestamp:new Date().toISOString()
  };
}


function databaseBackupStatus(){
  const required=Boolean(runtimeConfig.deployment&&String(process.env.RENTALL_STAGING||'').trim()!=='true');
  const enabled=String(process.env.DB_BACKUP_ENABLED||'').trim().toLowerCase()==='true';
  const maxAgeHours=Math.max(1,Math.min(168,Number(process.env.DB_BACKUP_MAX_AGE_HOURS)||30));
  const defaultEvidence=path.join(path.dirname(runtimeConfig.database.path),'backups','last-verified-backup.json');
  const evidencePath=String(process.env.DB_BACKUP_EVIDENCE_PATH||defaultEvidence);
  let verifiedAt=null,integrity=null,ageHours=null,evidenceValid=false;
  try{
    const evidence=JSON.parse(fs.readFileSync(evidencePath,'utf8'));
    verifiedAt=String(evidence.verifiedAt||'');integrity=String(evidence.integrity||'');
    const ts=new Date(verifiedAt).getTime();
    if(Number.isFinite(ts)){ageHours=(Date.now()-ts)/3600000;evidenceValid=integrity==='ok'&&ageHours>=0&&ageHours<=maxAgeHours;}
  }catch{}
  return {required,enabled,evidenceValid,verifiedAt:verifiedAt||null,ageHours:ageHours==null?null:Number(ageHours.toFixed(2)),maxAgeHours};
}

function launchGate(){
  const report=productionConfigReport();
  const storage=productionStorageReport();
  const database=checkDatabase();
  const backup=databaseBackupStatus();
  const checks=[...report.checks.map(({id,required,ready})=>({id,required,ready})),...storage.checks.map(({id,required,ready})=>({id,required,ready})),{id:'database_connection',required:true,ready:database.ok},{id:'database_migration',required:true,ready:database.migrationVersion>=REQUIRED_SCHEMA_VERSION},{id:'database_backup_enabled',required:backup.required,ready:backup.enabled},{id:'database_backup_recent_verified',required:backup.required,ready:backup.enabled&&backup.evidenceValid},{id:'accepting_traffic',required:true,ready:!shuttingDown}];
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
  if(!key.startsWith('booking_') && key!=='supplier_booking_received') return res.status(400).send('Preview unavailable');
  let payload={}; try{payload=typeof item.payload==='string'?JSON.parse(item.payload):item.payload||{};}catch{}
  res.setHeader('Cache-Control','no-store, private');
  res.type('html').send(
    key==='supplier_booking_received' ? renderSupplierBookingReceivedEmail(payload) :
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
    platformFeePercent:Number(process.env.PLATFORM_FEE_PERCENT || 15)
  });
});

app.post('/api/auth/register', simpleRateLimit({windowMs:15*60*1000,max:12,keyPrefix:'auth-register'}), (req,res)=>{
  try{
    const {email,password,displayName=null,businessName=null,country=null,city=null,role='supplier'}=req.body||{};
    if(String(password||'').length<8){
      return res.status(400).json({error:'Password must contain at least 8 characters'});
    }
    const safeRole=role==='customer'?'customer':'supplier';
    const user=createAppUser({email,password,role:safeRole,displayName,businessName,country,city});
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
  const token=parseCookies(req).rentall_session;
  deleteAppSession(token);
  res.setHeader('Set-Cookie','rentall_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.json({ok:true});
});

app.get('/api/auth/me', (req,res)=>{
  res.json({user:sessionUser(req)});
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
  const e=v=>escapeHtml(String(v??''));
  const total=Number(payload.total||0).toFixed(2);
  const dashboardUrl=String(payload.supplierDashboardUrl||`${PUBLIC_BASE_URL}/?view=supplier-bookings`);
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

function renderBookingReceivedEmail(payload={}){
  const fmt=v=>new Intl.NumberFormat('en',{style:'currency',currency:payload.currency||'EUR'}).format(Number(v||0));
  const url=payload.bookingUrl||(payload.accountBookingPath?`${PUBLIC_BASE_URL}${payload.accountBookingPath}`:PUBLIC_BASE_URL);
  return `<!doctype html><html><body style="margin:0;background:#f4f7f4;font-family:Arial,sans-serif;color:#172019"><table role="presentation" width="100%"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" style="max-width:620px;background:#fff;border-radius:18px;padding:28px"><tr><td>
  <div style="font-size:22px;font-weight:800">RentAll</div><h1>Booking request received</h1>
  <p>Reference <strong>${escapeEmailHtml(payload.bookingId)}</strong></p>
  <p>Hi ${escapeEmailHtml(payload.customerName||'there')}, your request for <strong>${escapeEmailHtml(payload.listingTitle||'rental item')}</strong> has been received.</p>
  <table role="presentation" width="100%"><tr><td>Dates</td><td align="right"><strong>${escapeEmailHtml(payload.startDate)} → ${escapeEmailHtml(payload.endDate)}</strong></td></tr><tr><td>Quantity</td><td align="right"><strong>${escapeEmailHtml(payload.quantity)}</strong></td></tr><tr><td>Rental</td><td align="right"><strong>${fmt(payload.rentalSubtotal)}</strong></td></tr>${Number(payload.deliveryFee||0)>0?`<tr><td>Delivery</td><td align="right"><strong>${fmt(payload.deliveryFee)}</strong></td></tr>`:''}<tr><td>Total</td><td align="right"><strong>${fmt(payload.total)}</strong></td></tr></table>
  <p><strong>Next:</strong> ${escapeEmailHtml(payload.nextStep||'Supplier review pending')}</p><p><a href="${escapeEmailHtml(url)}" style="display:inline-block;padding:13px 18px;border-radius:10px;background:#173f2a;color:#fff;text-decoration:none;font-weight:700">View booking</a></p>
  <p style="font-size:12px;color:#66706a">For your security, do not forward a guest booking link.</p></td></tr></table></td></tr></table></body></html>`;
}


function renderBookingStatusEmail(payload={}){
  const url=payload.bookingUrl||(payload.accountBookingPath?`${PUBLIC_BASE_URL}${payload.accountBookingPath}`:PUBLIC_BASE_URL);
  const status=String(payload.status||'updated');
  const heading=status==='confirmed'?'Booking confirmed':status==='declined'?'Booking declined':status==='cancelled'?'Booking cancelled':'Booking updated';
  return `<!doctype html><html><body style="margin:0;background:#f4f7f4;font-family:Arial,sans-serif;color:#172019"><table role="presentation" width="100%"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" style="max-width:620px;background:#fff;border-radius:18px;padding:28px"><tr><td><div style="font-size:22px;font-weight:800">RentAll</div><h1>${escapeEmailHtml(heading)}</h1><p>Reference <strong>${escapeEmailHtml(payload.bookingId)}</strong></p><p>Your booking for <strong>${escapeEmailHtml(payload.listingTitle||'rental item')}</strong> is now <strong>${escapeEmailHtml(status)}</strong>.</p><p>${escapeEmailHtml(payload.message||'Open your booking for the latest details.')}</p><p><a href="${escapeEmailHtml(url)}" style="display:inline-block;padding:13px 18px;border-radius:10px;background:#173f2a;color:#fff;text-decoration:none;font-weight:700">Open RentAll</a></p><p style="font-size:12px;color:#66706a">If you booked as a guest, use the secure View booking link in your original booking receipt.</p></td></tr></table></td></tr></table></body></html>`;
}
function queueBookingStatusEmail(booking,status,{message=''}={}){
  if(!booking?.customerEmail || !isEmail(booking.customerEmail)) return false;
  const listing=getFullRentalListing(booking.listingId);
  enqueueTransactionalEmail({
    recipient:booking.customerEmail,
    templateKey:`booking_${status}`,
    subject:`RentAll · ${status==='confirmed'?'Booking confirmed':status==='declined'?'Booking declined':status==='cancelled'?'Booking cancelled':'Booking updated'} · ${booking.bookingId}`,
    dedupeKey:`booking:${booking.bookingId}:status:${status}`,
    payload:{templateVersion:1,bookingId:booking.bookingId,listingTitle:listing?.title||'Rental item',status,message,bookingUrl:null,accountBookingPath:'/?view=my-bookings'}
  });
  return true;
}


// V139 production transactional email worker. Explicitly disabled unless enabled by deployment config.
function renderTransactionalEmail(item){
  const key=String(item?.templateKey||''), payload=item?.payload||{};
  if(key==='supplier_booking_received') return renderSupplierBookingReceivedEmail(payload);
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
  const deliveryRequested=Boolean(String(input.deliveryCity||input.deliveryAddress||input.accommodationName||'').trim());
  let delivery=0;
  if(deliveryRequested){
    if(listing?.delivery==='Pickup only' || !(listing?.accommodationDelivery==='yes' || listing?.accommodationDelivery===true))
      throw new Error('Delivery is not available for this listing');
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
  return {
    ...listing,
    title,
    city,
    description:String(listing.description||'').slice(0,3000),
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
    const listing=saveFullRentalListing(safeListing,req.appUser.email);
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
app.get('/healthz',(req,res)=>res.status(shuttingDown?503:200).json({ok:!shuttingDown,service:'rentall',version:APP_VERSION}));

app.get('/api/readiness',(req,res)=>{
  res.set('Cache-Control','no-store');
  const gate=launchGate();
  res.status(gate.ready?200:503).json({ready:gate.ready,environment:runtimeConfig.nodeEnv,checks:gate.checks,blocking:gate.blocking,database:gate.database,stripe:gate.stripe,email:gate.email,version:APP_VERSION});
});

// Stripe Connect for authenticated suppliers.
app.post('/api/stripe/connect/create-account', requireStripe, requireRole('supplier','admin'), async (req,res)=>{
  // V117: legacy v1 Express account creation is intentionally disabled.
  // New marketplace suppliers must be provisioned with Stripe Accounts v2
  // configuration.recipient + stripe_transfers capability. Until the installed
  // Stripe SDK/API path is migrated and sandbox-validated, fail closed instead
  // of creating a deprecated or incorrectly-liable connected account.
  const existing=getStripeConnectionByUserId(req.appUser.userId);
  if(existing){
    return res.json({accountId:existing.stripeAccountId,state:'migration_required',connectApi:'v2_recipient'});
  }
  return res.status(503).json({
    error:'Supplier payout onboarding is temporarily unavailable while RentAll migrates to Stripe Connect Accounts v2.',
    code:'CONNECT_V2_MIGRATION_REQUIRED',
    requiredConfiguration:'configuration.recipient.stripe_balance.stripe_transfers',
    dashboard:'express'
  });
});

app.post('/api/stripe/connect/onboarding-link', requireStripe, requireRole('supplier','admin'), async (req,res)=>{
  const connection=getStripeConnectionByUserId(req.appUser.userId);
  if(!connection) return res.status(404).json({error:'No connected account'});
  return res.status(503).json({error:'Stripe Connect v2 embedded onboarding is required for this supplier.',code:'CONNECT_V2_ONBOARDING_REQUIRED'});
});

app.post('/api/stripe/connect/login-link', requireStripe, requireRole('supplier','admin'), async (req,res)=>{
  const connection=getStripeConnectionByUserId(req.appUser.userId);
  if(!connection) return res.status(404).json({error:'No connected account'});
  if(!String(connection.connectApi||'').startsWith('v2')) return res.status(409).json({error:'Supplier account requires Connect v2 migration.',code:'SUPPLIER_CONNECT_V2_REQUIRED'});
  return res.status(503).json({error:'Express dashboard access will be enabled with the Accounts v2 onboarding implementation.',code:'CONNECT_V2_DASHBOARD_PENDING'});
});

app.get('/api/stripe/connect/status', requireStripe, requireRole('supplier','admin'), async (req,res)=>{
  try{
    const connection=getStripeConnectionByUserId(req.appUser.userId);
    if(!connection) return res.json({state:'not_created',connectApi:'v2_recipient_target'});
    if(String(connection.connectApi||'').startsWith('v2')){
      return res.json({
        accountId:connection.stripeAccountId,
        state:String(connection.transferCapabilityStatus||'')==='active'?'active':'needs_information',
        connectApi:connection.connectApi,
        transferCapabilityStatus:connection.transferCapabilityStatus||'unknown'
      });
    }
    const account=await stripe.accounts.retrieve(connection.stripeAccountId);
    res.json(statusFromLegacyAccountDuringV2Migration(account));
  }catch(err){res.status(500).json({error:err.message});}
});

// V119 provider-state ingestion bridge. Production Stripe account webhooks should
// pass their verified Accounts v2 object through this parser before persistence.
app.post('/api/admin/stripe/connect/v2-capability-sync', requireRole('admin'), (req,res)=>{
  const {userId,account}=req.body||{};
  if(!userId||!account?.id) return res.status(400).json({error:'userId and Accounts v2 account object are required'});
  const existing=getStripeConnectionByUserId(String(userId));
  if(!existing) return res.status(404).json({error:'Stripe connection not found'});
  if(String(existing.stripeAccountId)!==String(account.id)) return res.status(409).json({error:'Stripe account does not match supplier'});
  const status=stripeV2RecipientStatus(account);
  const saved=updateStripeConnectionCapability({
    userId:String(userId),
    connectApi:status.connectApi,
    transferCapabilityStatus:status.transferCapabilityStatus,
    requirements:status.requirements
  });
  res.json({ok:true,status,saved:{userId:saved?.userId,accountId:saved?.stripeAccountId,connectApi:saved?.connectApi,transferCapabilityStatus:saved?.transferCapabilityStatus}});
});

app.post('/api/payments/deposit-intent', simpleRateLimit({windowMs:60000,max:12,keyPrefix:'deposit-payment'}), requireStripe, async (req,res)=>{
  try{
    const {bookingId,accessToken}=req.body||{}; if(!bookingId)return res.status(400).json({error:'bookingId is required'});
    const booking=getRentalBookingById(bookingId); if(!booking)return res.status(404).json({error:'Booking not found'});
    const user=sessionUser(req);
    const accountOwner=!!(user?.email&&String(user.email).toLowerCase()===String(booking.customerEmail||'').toLowerCase());
    const guestOwner=!!verifyBookingPaymentToken(bookingId,accessToken);
    if(!accountOwner&&!guestOwner)return res.status(403).json({error:'Booking access denied'});
    if(!['pending','confirmed'].includes(booking.status))return res.status(409).json({error:`Deposit cannot be authorized in status ${booking.status}`});
    const amount=Math.round(Math.max(0,Number(booking.securityDepositAmount||0))*100);
    if(amount<=0)return res.status(409).json({error:'This booking does not require a security deposit'});
    let intent;
    if(booking.securityDepositPaymentIntentId){
      intent=await stripe.paymentIntents.retrieve(booking.securityDepositPaymentIntentId);
      if(String(intent.metadata?.bookingId||'')!==String(bookingId)||String(intent.metadata?.purpose||'')!=='security_deposit'||Number(intent.amount)!==amount||String(intent.currency||'').toLowerCase()!=='eur')
        return res.status(409).json({error:'Stored deposit authorization does not match this booking'});
    }else{
      intent=await stripe.paymentIntents.create({amount,currency:'eur',capture_method:'manual',automatic_payment_methods:{enabled:true},metadata:{bookingId:String(bookingId),listingId:String(booking.listingId),purpose:'security_deposit'}},{idempotencyKey:`booking:${bookingId}:security-deposit`});
    }
    const depositStatus=intent.status==='requires_capture'?'authorized':'authorization_pending';
    setRentalSecurityDepositProviderState(bookingId,{paymentIntentId:intent.id,providerStatus:intent.status,depositStatus});
    res.json({clientSecret:intent.client_secret,paymentIntentId:intent.id,status:intent.status,depositStatus,amount:amount/100,currency:'eur'});
  }catch(err){console.warn('Deposit authorization failed',err.message);res.status(400).json({error:process.env.NODE_ENV==='production'?'Unable to prepare security deposit':err.message});}
});

async function processExpiredBookings(){
  const expiredIds=expireStalePendingBookings();
  for(const bookingId of expiredIds){
    try{
      const booking=getRentalBookingById(bookingId); if(!booking)continue;
      // Cancel an uncaptured rental payment authorization if one exists.
      if(stripe && booking.stripePaymentIntentId && booking.paymentStatus!=='paid'){
        const pi=await stripe.paymentIntents.retrieve(booking.stripePaymentIntentId);
        if(new Set(['requires_payment_method','requires_confirmation','requires_action','requires_capture']).has(pi.status)){
          await stripe.paymentIntents.cancel(pi.id);
        }
      }
      // Release a deposit authorization that is no longer attached to a payable booking.
      if(stripe && booking.securityDepositPaymentIntentId && !['released','captured'].includes(booking.securityDepositStatus)){
        const dpi=await stripe.paymentIntents.retrieve(booking.securityDepositPaymentIntentId);
        if(dpi.status==='requires_capture') await stripe.paymentIntents.cancel(dpi.id);
        setRentalSecurityDepositProviderState(bookingId,{paymentIntentId:dpi.id,providerStatus:dpi.status==='requires_capture'?'canceled':dpi.status,depositStatus:'released'});
        resolveRentalSecurityDeposit(bookingId,{status:'released',resolution:'Booking expired before completion; deposit authorization released.'});
      }
      if(booking.customerEmail)createRentalNotification({uniqueKey:`booking:${bookingId}:expired:customer`,audience:'customer',userEmail:booking.customerEmail,bookingId,type:'booking.expired',title:'Booking request expired',message:'This booking request expired before payment/confirmation was completed. No active reservation remains.'});
      const listing=getRentalListing(booking.listingId);
      if(listing?.ownerEmail)createRentalNotification({uniqueKey:`booking:${bookingId}:expired:supplier`,audience:'supplier',userEmail:listing.ownerEmail,bookingId,type:'booking.expired',title:'Booking request expired',message:`The pending request for ${listing.title} expired and its availability has been released.`});
    }catch(err){console.warn('Expired booking cleanup failed',bookingId,err.message)}
  }
  return expiredIds;
}
const RENTALL_EXPIRY_SWEEP_MS=Math.max(60000,Number(process.env.BOOKING_EXPIRY_SWEEP_MS||60000));
const rentallExpiryTimer=setInterval(()=>processExpiredBookings().catch(err=>console.warn('Booking expiry sweep failed',err.message)),RENTALL_EXPIRY_SWEEP_MS);
rentallExpiryTimer.unref?.();

app.post('/api/payments/create-intent', simpleRateLimit({windowMs:60000,max:20,keyPrefix:'payment'}), requireStripe, async (req,res)=>{
  try{
    await processExpiredBookings();
    const {bookingId,paymentToken}=req.body||{};
    const paymentBooking=verifyBookingPaymentToken(bookingId,paymentToken);
    if(!paymentBooking) return res.status(403).json({error:'Invalid or expired payment token'});

    const booking=getRentalBookingById(bookingId);
    if(!booking) return res.status(404).json({error:'Booking not found'});
    if(!['pending','confirmed'].includes(booking.status)){
      return res.status(409).json({error:`Booking cannot be paid in status ${booking.status}`});
    }

    const listing=getRentalListing(booking.listingId);
    const connection=getStripeConnectionByEmail(listing?.ownerEmail);
    if(!connection) return res.status(409).json({error:'Supplier has not connected Stripe yet'});

    const amount=Math.round(Number(booking.orderValue||0)*100);
    if(amount<50) return res.status(400).json({error:'Booking amount is too small'});

    const feePercent=Math.max(0,Math.min(100,Number(process.env.PLATFORM_FEE_PERCENT||15)));
    const platformFee=Math.round(amount*feePercent/100);
    const supplierAmount=amount-platformFee;

    let intent;
    if(booking.stripePaymentIntentId){
      intent=await stripe.paymentIntents.retrieve(booking.stripePaymentIntentId);
      const intentBookingId=String(intent.metadata?.bookingId||'');
      const intentPurpose=String(intent.metadata?.purpose||'');
      const intentDestination=String(intent.transfer_data?.destination||'');
      if(intentBookingId!==String(booking.bookingId) || Number(intent.amount)!==amount || String(intent.currency||'').toLowerCase()!=='eur' || intentPurpose!=='rental_payment' || intentDestination!==String(connection.stripeAccountId)){
        return res.status(409).json({error:'Stored payment intent does not match this booking'});
      }
      if(intent.status==='canceled'){
        return res.status(409).json({error:'Payment intent was cancelled; create a new booking payment attempt'});
      }
    }else{
      intent=await stripe.paymentIntents.create({
        amount,
        currency:'eur',
        automatic_payment_methods:{enabled:true},
        application_fee_amount:platformFee,
        transfer_data:{destination:connection.stripeAccountId},
        metadata:{
          bookingId:booking.bookingId,
          listingId:booking.listingId,
          purpose:'rental_payment',
          supplierEmail:listing?.ownerEmail||''
        }
      },{idempotencyKey:`booking:${booking.bookingId}:payment-intent`});

      setBookingPaymentDetails({
        bookingId:booking.bookingId,
        paymentIntentId:intent.id,
        paymentStatus:intent.status,
        platformFeeAmount:platformFee/100,
        supplierAmount:supplierAmount/100
      });
    }

    res.json({
      clientSecret:intent.client_secret,
      paymentIntentId:intent.id,
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
    if(termsAccepted!==true){
      return res.status(400).json({error:'Rental terms must be accepted before booking',code:'TERMS_REQUIRED'});
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
  try {
    const {
      listingId, startDate, endDate, quantity = 1, status = 'pending',
      customerName = null, customerEmail = null, customerPhone = null,
      accommodationName = null, deliveryCity = null, deliveryAddress = null,
      roomNumber = null, contactPerson = null, deliveryInstructions = null,
      orderValue = null, termsAccepted = false
    } = req.body || {};
    if (!listingId || !startDate || !endDate) {
      return res.status(400).json({ error: 'listingId, startDate and endDate are required' });
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
    if(!inventoryListing || !listingForBooking || listingForBooking.moderationStatus==='blocked'){
      return res.status(404).json({error:'Listing not found'});
    }
    const authenticatedUser=sessionUser(req);
    const effectiveCustomerEmail=authenticatedUser?.email || customerEmail || null;
    const effectiveCustomerName=authenticatedUser?.displayName || authenticatedUser?.name || customerName || null;
    const authoritativePrice=calculateAuthoritativeBookingTotal(listingForBooking,{
      startDate,endDate,quantity:qty,deliveryCity,deliveryAddress,accommodationName
    });
    const bookingId = `RB-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const result = createRentalBookingAtomic({
      bookingId,
      listingId,
      startDate,
      endDate,
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
      termsVersion:'rentall-rental-v1',
      customerAcceptedAt:new Date().toISOString(),
      snapshot:{
        platform:'RentAll',bookingId,listingId,listingTitle:listingForBooking.title,
        supplierEmail:listingForBooking.ownerEmail||null,customerName:effectiveCustomerName||null,customerEmail:effectiveCustomerEmail||null,
        startDate,endDate,quantity:qty,currency:'EUR',rentalAmount:authoritativePrice.rental,deliveryFee:authoritativePrice.delivery,
        total:authoritativePrice.total,securityDeposit:authoritativePrice.securityDeposit,
        cancellationPolicy:listingForBooking.cancellationPolicy||'moderate',
        terms:['Use the item only for its intended purpose.','Return the item on time in the condition received, allowing for normal wear.','Damage, loss, cancellation and deposit handling follow the listing and RentAll terms.']
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
          subject:`RentAll booking received · ${listingForBooking.title}`,
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
          subject:`New RentAll booking request · ${listing.title}`,
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

    if(requestedStatus==='declined'){
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

    const booking = updateRentalBookingStatus(
      req.params.bookingId,
      requestedStatus,
      req.body?.reason || null
    );
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if(requestedStatus==='confirmed'){
      try{acceptRentalAgreement(req.params.bookingId,'supplier')}catch{}
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
    const result=await cancelBookingWithPaymentHandling(
      req.params.bookingId,
      req.body?.reason || null
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
    res.json(result);
  }catch(err){
    res.status(err.code==='INVALID_TRANSITION'?409:400)
      .json({error:err.message,code:err.code||null});
  }
});

app.post('/api/rentals/bookings/:bookingId/return', requireRole('supplier','admin'), simpleRateLimit({windowMs:60000,max:20,keyPrefix:'booking-return'}), (req,res)=>{
  try{
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
      if(booking.customerEmail) createRentalNotification({
        uniqueKey:`booking:${booking.bookingId}:deposit:${depositStatus}:customer`,
        audience:'customer',userEmail:booking.customerEmail,bookingId:booking.bookingId,
        type:`deposit.${depositStatus}`,title:depositStatus==='release_pending'?'Deposit release started':'Deposit under review',
        message:depositStatus==='release_pending'
          ?`Your €${depositAmount.toFixed(2)} security deposit is marked for release.`
          :`Your €${depositAmount.toFixed(2)} security deposit is under review because the return was recorded as ${booking.returnCondition}.`
      });
    }
    if(booking.customerEmail) createRentalNotification({uniqueKey:`booking:${booking.bookingId}:returned:customer`,audience:'customer',userEmail:booking.customerEmail,bookingId:booking.bookingId,type:'booking.returned',title:'Item return recorded',message:`Return recorded as ${booking.returnCondition||'good'}.`});
    if(listing?.ownerEmail) createRentalNotification({uniqueKey:`booking:${booking.bookingId}:returned:supplier`,audience:'supplier',userEmail:listing.ownerEmail,bookingId:booking.bookingId,type:'booking.returned',title:'Item return recorded',message:`Return recorded as ${booking.returnCondition||'good'}.`});
    res.json({booking:deposit,deposit:{amount:depositAmount,status:deposit?.securityDepositStatus||'not_required'}});
  }catch(err){
    res.status(err.code==='INVALID_TRANSITION'?409:400)
      .json({error:err.message,code:err.code||null});
  }
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
  res.json({conversations:listRentalConversationsForUser(req.appUser.email)});
});
app.post('/api/conversations',requireRole('customer','supplier','admin'),simpleRateLimit({windowMs:60000,max:30,keyPrefix:'conversation-create'}),(req,res)=>{
  try{
    const listingId=String(req.body?.listingId||'');
    const listing=getFullRentalListing(listingId);if(!listing)return res.status(404).json({error:'Listing not found'});
    let customerEmail=null,supplierEmail=String(listing.ownerEmail||'').toLowerCase(),bookingId=req.body?.bookingId?String(req.body.bookingId):null;
    if(req.appUser.role==='customer') customerEmail=req.appUser.email;
    else if(req.appUser.role==='supplier'){
      if(String(listing.ownerEmail||'').toLowerCase()!==String(req.appUser.email||'').toLowerCase())return res.status(403).json({error:'Forbidden'});
      if(!bookingId)return res.status(400).json({error:'bookingId is required for supplier conversations'});
      const booking=getRentalBookingById(bookingId);if(!booking)return res.status(404).json({error:'Booking not found'});
      customerEmail=booking.customerEmail;
    }else{
      customerEmail=String(req.body?.customerEmail||'').toLowerCase();
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
    const contactAllowed=booking&&['confirmed','active','returned','completed'].includes(booking.status);
    if(!contactAllowed&&containsOffPlatformContact(body))return res.status(400).json({error:'Contact details can be shared after the booking is confirmed',code:'CONTACT_DETAILS_BLOCKED'});
    const message=addRentalMessage({conversationId:conversation.conversationId,senderEmail:req.appUser.email,senderRole:req.appUser.role,body});
    const recipient=String(req.appUser.email).toLowerCase()===String(conversation.customerEmail).toLowerCase()?conversation.supplierEmail:conversation.customerEmail;
    if(recipient)createRentalNotification({uniqueKey:`message:${message.messageId}`,audience:String(recipient).toLowerCase()===String(conversation.supplierEmail).toLowerCase()?'supplier':'customer',userEmail:recipient,bookingId:conversation.bookingId||null,type:'message.received',title:'New message',message:'You have a new RentAll message.'});
    res.json({message});
  }catch(err){res.status(400).json({error:err.message,code:err.code||null});}
});

app.get('/api/listings/:listingId/reputation',(req,res)=>{
  const listing=getFullRentalListing(req.params.listingId);if(!listing)return res.status(404).json({error:'Listing not found'});
  res.json({supplier:getSupplierReputation(listing.ownerEmail)});
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
    const guestCustomerAllowed=!!verifyBookingPaymentToken(bookingId,accessToken);
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
    const intent=await stripe.paymentIntents.retrieve(booking.securityDepositPaymentIntentId);
    if(String(intent.metadata?.bookingId||'')!==String(booking.bookingId)||String(intent.metadata?.purpose||'')!=='security_deposit')return res.status(409).json({error:'Deposit authorization identity mismatch'});
    if(intent.status==='requires_capture') await stripe.paymentIntents.cancel(intent.id);
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
    const intent=await stripe.paymentIntents.retrieve(booking.securityDepositPaymentIntentId);
    if(String(intent.metadata?.bookingId||'')!==String(booking.bookingId)||String(intent.metadata?.purpose||'')!=='security_deposit'||intent.status!=='requires_capture')return res.status(409).json({error:'Deposit authorization is not capture-ready'});
    const captured=await stripe.paymentIntents.capture(intent.id,{amount_to_capture:captureCents},{idempotencyKey:`booking:${booking.bookingId}:deposit-capture:${captureCents}`});
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
    if(!booking){
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

const server=app.listen(port,runtimeConfig.host, () => {
  const database=checkDatabase();
  const config=productionConfigReport();
  console.log(JSON.stringify({type:'startup',service:'rentall',version:APP_VERSION,environment:runtimeConfig.nodeEnv,host:runtimeConfig.host,port,database:{driver:databaseRuntime.driver,source:databaseRuntime.source,persistent:databaseRuntime.persistent,migrationVersion:database.migrationVersion},stripe:config.stripe,email:config.email,ready:launchGate().ready}));
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
  clearInterval(rentallExpiryTimer);
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
