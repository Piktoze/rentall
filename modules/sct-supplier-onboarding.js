// Authenticated SCT recipient onboarding; caller identity comes only from requireRole/session.
import {createHash} from 'node:crypto';
import {isIsolatedStripeTestClient} from './isolated-stripe-test-client.js';
import {isCommercialStripeClient} from './commercial-sct-client.js';
import {inspectIsolatedSctRecipientAccount} from './isolated-sct-recipient-account-gate.js';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const hash=s=>createHash('sha256').update(s).digest('hex');
const include=['identity','configuration.recipient','configuration.merchant','requirements','defaults'];
export async function createSctSupplierOnboarding({db,stripe,env,runtime,now=Date.now}){
 const live=env.STRIPE_MODE==='live',mode=live?'live':'test';
 if(!runtime||!(live?isCommercialStripeClient(stripe,env.STRIPE_SECRET_KEY):env.STRIPE_MODE==='test'&&isIsolatedStripeTestClient(stripe,env.STRIPE_SECRET_KEY)))fail('SCT_ONBOARDING_TRUSTED_CLIENT_REQUIRED');
 if(live&&env.COMMERCIAL_SCT_RUNTIME_ENABLED!=='true')fail('SCT_ONBOARDING_LIVE_DISABLED');
 const platform=await stripe.accounts.retrieve();
 if(!/^acct_[A-Za-z0-9]+$/.test(platform?.id||'')||(live&&platform.id!==env.COMMERCIAL_STRIPE_PLATFORM_ACCOUNT_ID))fail('SCT_ONBOARDING_PLATFORM_MISMATCH');
 const connectApi='v2_recipient_sct_'+mode;
 const origin=new URL(env.PUBLIC_BASE_URL||env.APP_URL).origin;
 db.exec(`CREATE TABLE IF NOT EXISTS sct_supplier_onboarding(user_id TEXT PRIMARY KEY,user_email TEXT NOT NULL,
  mode TEXT NOT NULL,platform_account TEXT NOT NULL,entity_type TEXT NOT NULL,payload TEXT NOT NULL,digest TEXT NOT NULL,
  request_key TEXT NOT NULL UNIQUE,created_ms INTEGER NOT NULL,account_id TEXT UNIQUE,status TEXT NOT NULL)`);
 function owner(user){const row=db.prepare('SELECT user_id,email,role,display_name,business_name FROM app_users WHERE user_id=?').get(user?.userId);
  if(!row||row.email.toLowerCase()!==user.email?.toLowerCase()||!['supplier','admin'].includes(row.role))fail('SCT_ONBOARDING_AUTHENTICATED_OWNER_REQUIRED');return row;}
 function command(user){const u=owner(user),r=db.prepare('SELECT * FROM sct_supplier_onboarding WHERE user_id=?').get(u.user_id);
  if(r&&(r.mode!==mode||r.platform_account!==platform.id||r.user_email.toLowerCase()!==u.email.toLowerCase()||r.digest!==hash(r.payload)))fail('SCT_ONBOARDING_IMMUTABLE_BINDING_CONFLICT');return r;}
 function verify(account,r){
  if(account?.id!==r.account_id||account.livemode!==live||account.dashboard!=='express'||account.identity?.country!=='LT'||account.identity?.entity_type!==r.entity_type||
   !account.configuration?.recipient||account.configuration?.merchant||account.defaults?.responsibilities?.fees_collector!=='application'||account.defaults?.responsibilities?.losses_collector!=='application'||
   !(account.configuration.recipient.capabilities?.stripe_balance?.stripe_transfers?.requested===true||
     ['active','restricted','pending'].includes(account.configuration.recipient.capabilities?.stripe_balance?.stripe_transfers?.status)&&account.configuration.recipient.capabilities.stripe_balance.stripe_transfers.requested!==false))fail('SCT_ONBOARDING_PROVIDER_BINDING_MISMATCH');
  return account;
 }
 function connect(user,r){
  const existing=db.prepare('SELECT * FROM stripe_connections WHERE user_id=?').get(user.userId);
  if(existing&&(existing.stripe_account_id!==r.account_id||existing.connect_api!==connectApi))fail('SCT_ONBOARDING_EXISTING_CONNECTION_REQUIRES_REVIEW');
  const at=new Date(now()).toISOString();
  db.prepare(`INSERT INTO stripe_connections(user_id,user_email,stripe_account_id,created_at,updated_at,connect_api,transfer_capability_status,requirements_json)
   VALUES(?,?,?,?,?,?,'unknown','[]') ON CONFLICT(user_id) DO UPDATE SET updated_at=excluded.updated_at`).run(user.userId,user.email,r.account_id,at,at,connectApi);
 }
 async function trustedPrivateTestPin(user){
  const u=owner(user);if(live||env.PRIVATE_TEST_ENABLED!=='true'||u.role!=='admin'||u.email.toLowerCase()!==String(env.PRIVATE_TEST_OWNER_EMAIL||'').toLowerCase())return null;
  let mapped;try{mapped=runtime.newBookingRecipient(u.email);}catch{return null;}
  if(mapped.account_id!==env.PRIVATE_TEST_RECIPIENT_ID)return null;
  const a=await stripe.v2.core.accounts.retrieve(mapped.account_id,{include}),r={account_id:mapped.account_id,entity_type:a.identity?.entity_type};
  if(!['individual','company'].includes(r.entity_type))fail('SCT_ONBOARDING_PROVIDER_BINDING_MISMATCH');verify(a,r);return r;
 }
 async function status(user){const r=command(user)||await trustedPrivateTestPin(user);if(!r)return {state:'not_created',connectApi,detailsSubmitted:false,payoutsEnabled:false,recipientTransfersReady:false,bankPayoutsReady:false};
  if(!r.account_id)return {state:'reconciliation_required',connectApi,detailsSubmitted:false,payoutsEnabled:false,recipientTransfersReady:false,bankPayoutsReady:false};
  const a=verify(await stripe.v2.core.accounts.retrieve(r.account_id,{include}),r);
  const checked=inspectIsolatedSctRecipientAccount(a,{expectedAccountId:r.account_id,expectedCountry:'LT',expectedEntityType:r.entity_type});
  const requirements=Array.isArray(a.requirements?.entries)?a.requirements.entries:Array.isArray(a.requirements?.currently_due)?a.requirements.currently_due:[];
  if(!checked.blocked){connect(user,r);await runtime.registerRecipient(user.email,r.account_id,r.entity_type);}
  return {state:checked.blocked?'needs_information':'active',accountId:r.account_id,connectApi,
   recipientTransfersReady:!checked.blocked,detailsSubmitted:!checked.blocked,payoutsEnabled:false,bankPayoutsReady:false,
   currentlyDue:requirements.map(x=>typeof x==='string'?x:x.description||x.reference||x.type||'Stripe review required')};
 }
 async function create(user,{country,legalEntityType,onboardingRequested}={}){
  const u=owner(user);if(country!=='LT'||!['individual','company'].includes(legalEntityType)||onboardingRequested!==true)fail('SCT_ONBOARDING_EXPLICIT_LT_REQUEST_REQUIRED');
  let r=command(user);if(!r){const pinned=await trustedPrivateTestPin(user);if(pinned){if(pinned.entity_type!==legalEntityType)fail('SCT_ONBOARDING_ENTITY_IMMUTABLE');return status(user);}}if(r&&r.entity_type!==legalEntityType)fail('SCT_ONBOARDING_ENTITY_IMMUTABLE');
  if(!r){
   if(db.prepare('SELECT 1 FROM stripe_connections WHERE user_id=?').get(u.user_id))fail('SCT_ONBOARDING_EXISTING_CONNECTION_REQUIRES_REVIEW');
   // A pre-existing TEST runtime pin is not silently replaced, and LIVE has no adoption shortcut.
   let mapped;try{mapped=runtime.newBookingRecipient(u.email);}catch{}
   if(mapped)fail('SCT_ONBOARDING_EXISTING_RECIPIENT_REQUIRES_REVIEW');
   const payload={contact_email:u.email,display_name:String(u.business_name||u.display_name||'RentInOrbit supplier').slice(0,120),dashboard:'express',
    identity:{country:'LT',entity_type:legalEntityType},configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{requested:true}}}}},
    defaults:{currency:'eur',responsibilities:{fees_collector:'application',losses_collector:'application'}},
    metadata:{rentinorbitUserId:u.user_id,platformAccount:platform.id,paymentFlow:'separate_charges_and_transfers'},include};
   const serialized=JSON.stringify(payload),key='sct-recipient:'+mode+':'+platform.id+':'+u.user_id+':v1';
   db.prepare("INSERT OR IGNORE INTO sct_supplier_onboarding VALUES(?,?,?,?,?,?,?,?,?,NULL,'uncertain')").run(u.user_id,u.email,mode,platform.id,legalEntityType,serialized,hash(serialized),key,now());
   r=command(user);
  }
  if(r.account_id)return status(user);
  if(now()-r.created_ms<0||now()-r.created_ms>=23*3600000)fail('SCT_ONBOARDING_RECONCILIATION_REQUIRED');
  const a=await stripe.v2.core.accounts.create(JSON.parse(r.payload),{idempotencyKey:r.request_key});
  if(!/^acct_[A-Za-z0-9]+$/.test(a?.id||''))fail('SCT_ONBOARDING_RECONCILIATION_REQUIRED');
  const verified=verify(await stripe.v2.core.accounts.retrieve(a.id,{include}),{...r,account_id:a.id});
  if(verified.metadata?.rentinorbitUserId!==u.user_id||verified.metadata?.platformAccount!==platform.id)fail('SCT_ONBOARDING_PROVIDER_OWNERSHIP_MISMATCH');
  db.transaction(()=>{const current=command(user);if(current.account_id&&current.account_id!==a.id)fail('SCT_ONBOARDING_ACCOUNT_CONFLICT');
   db.prepare("UPDATE sct_supplier_onboarding SET account_id=?,status='created' WHERE user_id=? AND account_id IS NULL").run(a.id,u.user_id);
   connect(user,{...r,account_id:a.id});}).immediate();
  return status(user);
 }
 async function account(user){const r=command(user)||await trustedPrivateTestPin(user);if(!r?.account_id)fail('SCT_ONBOARDING_CREATE_ACCOUNT_FIRST');
  verify(await stripe.v2.core.accounts.retrieve(r.account_id,{include}),r);return r;}
 async function hostedLink(user){const r=await account(user);
  const link=await stripe.v2.core.accountLinks.create({account:r.account_id,use_case:{type:'account_onboarding',account_onboarding:{configurations:['recipient'],collection_options:{fields:'currently_due'},
   refresh_url:origin+'/?view=supplier-payouts&stripe_onboarding=refresh',return_url:origin+'/?view=supplier-payouts&stripe_onboarding=return'}}});
  const url=new URL(link.url);if(link.livemode!==live||link.account!==r.account_id||url.protocol!=='https:'||url.hostname!=='connect.stripe.com'||url.username||url.password)fail('SCT_ONBOARDING_UNTRUSTED_LINK');
  return {url:url.toString(),expiresAt:link.expires_at,mode:'hosted',connectApi};
 }
 async function session(user){const r=await account(user),s=await stripe.accountSessions.create({account:r.account_id,components:{account_onboarding:{enabled:true},notification_banner:{enabled:true}}});
  if(s.account!==r.account_id||typeof s.client_secret!=='string'||!s.client_secret.startsWith('acs_'))fail('SCT_ONBOARDING_SESSION_INVALID');
  return {accountId:r.account_id,clientSecret:s.client_secret,mode:'embedded',connectApi};}
 async function dashboard(user){const r=await account(user),link=await stripe.accounts.createLoginLink(r.account_id),url=new URL(link.url);
  if(url.protocol!=='https:'||!['connect.stripe.com','dashboard.stripe.com'].includes(url.hostname)||url.username||url.password)fail('SCT_ONBOARDING_UNTRUSTED_LINK');return {url:url.toString()};}
 return {create,status,hostedLink,session,dashboard};
}
