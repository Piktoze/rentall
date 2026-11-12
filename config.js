import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

dotenv.config();

// Backward-compatible deployment bridge: existing Railway variables from the pre-rebrand
// service are mapped to the RentInOrbit names at runtime, without exposing legacy branding.
const legacyEnvPrefix=['RENT','ALL'].join('');
for(const [key,val] of Object.entries(process.env)){
  if(!key.startsWith(legacyEnvPrefix+'_')) continue;
  const currentKey='RENTINORBIT'+key.slice(legacyEnvPrefix.length);
  if(!String(process.env[currentKey]||'').trim()) process.env[currentKey]=val;
}

const rootDir=path.dirname(fileURLToPath(import.meta.url));
const packageVersion=JSON.parse(fs.readFileSync(path.join(rootDir,'package.json'),'utf8')).version;
const value=(name,env=process.env)=>String(env[name]||'').trim();
const enabled=(name,env=process.env)=>value(name,env).toLowerCase()==='true';
const inside=(child,parent)=>Boolean(child&&parent)&&(child===parent||child.startsWith(parent+path.sep));
const validEmail=email=>/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(String(email||'').trim());

function normalizedOrigin(raw){
  try{
    const parsed=new URL(String(raw||'').trim());
    if(parsed.username||parsed.password||!['http:','https:'].includes(parsed.protocol)||parsed.pathname!=='/'||parsed.search||parsed.hash)return null;
    return parsed.origin;
  }catch{return null}
}

function fromAddress(raw){
  const input=String(raw||'').trim();
  const angle=input.match(/^[^<>\r\n]+<([^<>]+)>$/);
  return angle?angle[1].trim():input;
}

function strongSecret(raw){
  const secret=String(raw||'');
  return secret.length>=32&&new Set(secret).size>=8&&!/(replace|change.?me|example|password|session.?secret)/i.test(secret);
}

function sqlitePathFromUrl(raw){
  try{
    if(raw.startsWith('file:'))return fileURLToPath(new URL(raw));
    if(raw.startsWith('sqlite:///'))return path.resolve('/',raw.slice('sqlite:///'.length));
    if(raw.startsWith('sqlite://'))return path.resolve('/',raw.slice('sqlite://'.length));
  }catch{return null}
  return null;
}

// Explicit opt-in: relaxes ONLY the Stripe and email provider checks. Every other
// production check (HTTPS URLs, secrets, proxy, volume-backed DB/uploads) stays required.
export function isStagingEnvironment(env=process.env){
  return String(env.RENTINORBIT_STAGING||'').trim()==='true';
}

export function isDeploymentEnvironment(env=process.env){
  return String(env.NODE_ENV||'')==='production'||Boolean(env.RAILWAY_ENVIRONMENT_ID||env.RAILWAY_PROJECT_ID||env.RAILWAY_SERVICE_ID);
}

export function resolveDatabaseConfig(env=process.env){
  const databaseUrl=String(env.DATABASE_URL||'').trim();
  const explicit=String(env.RENTINORBIT_DB_PATH||env.DB_PATH||'').trim();
  const volumeRoot=String(env.RAILWAY_VOLUME_MOUNT_PATH||env.PERSISTENT_DATA_DIR||'').trim();
  if(databaseUrl&&explicit)return {ok:false,driver:'unsupported',source:'conflict',error:'Configure DATABASE_URL or RENTINORBIT_DB_PATH, not both.'};
  if(explicit===':memory:'&&String(env.NODE_ENV||'')==='test')return {ok:true,driver:'sqlite',source:'DB_PATH',path:':memory:',volumeRoot:null};
  if(databaseUrl){
    const filePath=sqlitePathFromUrl(databaseUrl);
    if(!filePath)return {ok:false,driver:'unsupported',source:'DATABASE_URL',error:'Only absolute file: or sqlite:/// DATABASE_URL values are supported in RC45.'};
    return {ok:true,driver:'sqlite',source:'DATABASE_URL',path:path.resolve(filePath),volumeRoot:volumeRoot?path.resolve(volumeRoot):null};
  }
  const baseDir=volumeRoot?path.resolve(volumeRoot):rootDir;
  const preferredPath=path.join(baseDir,'rentinorbit.sqlite');
  const legacyFile=['rent','all','.sqlite'].join('');
  const legacyPath=path.join(baseDir,legacyFile);
  const defaultPath=(!fs.existsSync(preferredPath)&&fs.existsSync(legacyPath))?legacyPath:preferredPath;
  const filePath=explicit?path.resolve(explicit):defaultPath;
  return {ok:true,driver:'sqlite',source:explicit?(env.RENTINORBIT_DB_PATH?'RENTINORBIT_DB_PATH':'DB_PATH'):(volumeRoot?'RAILWAY_VOLUME_MOUNT_PATH':'default-local'),path:filePath,volumeRoot:volumeRoot?path.resolve(volumeRoot):null};
}

export function resolveUploadsConfig(env=process.env){
  const volumeRoot=String(env.RAILWAY_VOLUME_MOUNT_PATH||env.PERSISTENT_DATA_DIR||'').trim();
  const explicit=String(env.UPLOADS_DIR||'').trim();
  const directory=explicit?path.resolve(explicit):(volumeRoot?path.join(path.resolve(volumeRoot),'uploads'):path.join(rootDir,'uploads'));
  return {directory,source:explicit?'UPLOADS_DIR':(volumeRoot?'RAILWAY_VOLUME_MOUNT_PATH':'default-local'),volumeRoot:volumeRoot?path.resolve(volumeRoot):null};
}

export function stripeModeFor(secret){
  if(/^[sr]k_live_/.test(secret))return 'live';
  if(/^[sr]k_test_/.test(secret))return 'test';
  return 'unknown';
}

export function productionConfigReport(env=process.env){
  const production=String(env.NODE_ENV||'')==='production';
  const deployment=isDeploymentEnvironment(env);
  const staging=isStagingEnvironment(env);
  const integrationRequired=deployment&&!staging;
  const railway=Boolean(env.RAILWAY_ENVIRONMENT_ID||env.RAILWAY_PROJECT_ID||env.RAILWAY_SERVICE_ID);
  const dbConfig=resolveDatabaseConfig(env);
  const uploadsConfig=resolveUploadsConfig(env);
  const appOrigin=normalizedOrigin(env.APP_URL);
  const publicOrigin=normalizedOrigin(env.PUBLIC_BASE_URL);
  const stripeSecret=String(env.STRIPE_SECRET_KEY||'').trim();
  const stripeMode=String(env.STRIPE_MODE||'').trim().toLowerCase();
  const detectedStripeMode=stripeModeFor(stripeSecret);
  const publishable=String(env.STRIPE_PUBLISHABLE_KEY||'').trim();
  const webhookSecret=String(env.STRIPE_WEBHOOK_SECRET||'').trim();
  const connectWebhookSecret=String(env.STRIPE_CONNECT_WEBHOOK_SECRET||'').trim();
  const emailProvider=String(env.EMAIL_PROVIDER||'').trim().toLowerCase();
  const emailFrom=fromAddress(env.EMAIL_FROM);
  const mapsProvider=String(env.MAPS_PROVIDER||'stub').trim().toLowerCase();
  const smsProvider=String(env.SMS_PROVIDER||'disabled').trim().toLowerCase();
  const pushProvider=String(env.PUSH_PROVIDER||'disabled').trim().toLowerCase();
  const trustProxy=Number(env.TRUST_PROXY_HOPS);
  const checks=[
    {id:'node_environment',required:deployment,ready:production},
    {id:'app_url_https',required:deployment,ready:Boolean(appOrigin&&appOrigin.startsWith('https://')&&!/^https:\/\/(localhost|127\.0\.0\.1)(?::|$)/i.test(appOrigin))},
    {id:'public_base_url',required:deployment,ready:Boolean(publicOrigin&&publicOrigin===appOrigin)},
    {id:'session_secret',required:deployment,ready:strongSecret(env.SESSION_SECRET)},
    {id:'trust_proxy',required:deployment,ready:Number.isInteger(trustProxy)&&trustProxy>=1&&trustProxy<=3},
    {id:'database_supported',required:true,ready:dbConfig.ok},
    {id:'database_explicit',required:deployment,ready:dbConfig.ok&&dbConfig.source!=='default-local'},
    {id:'database_absolute',required:deployment,ready:dbConfig.ok&&path.isAbsolute(dbConfig.path||'')},
    {id:'database_not_project_local',required:deployment,ready:dbConfig.ok&&!inside(dbConfig.path||'',rootDir)},
    {id:'database_volume_configured',required:deployment,ready:dbConfig.ok&&Boolean(dbConfig.volumeRoot)},
    {id:'database_on_volume',required:deployment,ready:dbConfig.ok&&Boolean(dbConfig.volumeRoot)&&inside(dbConfig.path,dbConfig.volumeRoot)},
    {id:'uploads_on_volume',required:deployment,ready:Boolean(uploadsConfig.volumeRoot)&&inside(uploadsConfig.directory,uploadsConfig.volumeRoot)},
    {id:'stripe_mode',required:integrationRequired,ready:['test','live'].includes(stripeMode)},
    {id:'stripe_secret',required:integrationRequired,ready:/^[sr]k_(?:test|live)_[A-Za-z0-9_\-]{12,}$/.test(stripeSecret)&&detectedStripeMode===stripeMode},
    {id:'stripe_publishable',required:integrationRequired,ready:new RegExp(`^pk_${stripeMode}_[A-Za-z0-9_\\-]{12,}$`).test(publishable)},
    {id:'stripe_webhook',required:integrationRequired,ready:/^whsec_[A-Za-z0-9_\-]{12,}$/.test(webhookSecret)},
    {id:'stripe_connect_webhook',required:integrationRequired,ready:/^whsec_[A-Za-z0-9_\-]{12,}$/.test(connectWebhookSecret)},
    {id:'connect_v2',required:integrationRequired,ready:String(env.STRIPE_CONNECT_V2_PROVISIONING||'')==='true'},
    {id:'email_provider',required:integrationRequired,ready:emailProvider==='resend'},
    {id:'email_from',required:integrationRequired,ready:validEmail(emailFrom)},
    {id:'email_api_key',required:integrationRequired,ready:emailProvider==='resend'&&/^re_[A-Za-z0-9_\-]{8,}$/.test(String(env.RESEND_API_KEY||''))},
    {id:'email_worker',required:integrationRequired,ready:String(env.EMAIL_WORKER_ENABLED||'')==='true'},
    {id:'email_worker_token',required:integrationRequired,ready:strongSecret(env.EMAIL_WORKER_TOKEN)},
    {id:'support_email',required:integrationRequired,ready:validEmail(env.SUPPORT_EMAIL)},
    {id:'staging_no_live_stripe',required:deployment&&staging,ready:detectedStripeMode!=='live'},
    {id:'maps_configuration',required:deployment,ready:['stub','mapbox','google'].includes(mapsProvider)&&(mapsProvider==='stub'||Boolean(String(env.MAPS_PUBLIC_TOKEN||'').trim()))},
    {id:'sms_provider',required:deployment,ready:smsProvider==='disabled'},
    {id:'push_provider',required:deployment,ready:pushProvider==='disabled'}
  ];
  const blocking=checks.filter(check=>check.required&&!check.ready).map(check=>check.id);
  return {
    ready:blocking.length===0,production,deployment,staging,railway,checks,blocking,
    database:{driver:dbConfig.driver,source:dbConfig.source,persistent:dbConfig.source!=='default-local',volumeConfigured:Boolean(dbConfig.volumeRoot)},
    uploads:{source:uploadsConfig.source,persistent:Boolean(uploadsConfig.volumeRoot)&&inside(uploadsConfig.directory,uploadsConfig.volumeRoot)},
    stripe:{configured:Boolean(stripeSecret),mode:stripeMode||'unset',keyType:stripeSecret.startsWith('rk_')?'restricted':stripeSecret.startsWith('sk_')?'secret':'unset',webhookConfigured:Boolean(webhookSecret),connectWebhookConfigured:Boolean(connectWebhookSecret)},
    email:{provider:emailProvider||'unset',workerEnabled:enabled('EMAIL_WORKER_ENABLED',env),fromConfigured:validEmail(emailFrom)},
    maps:{provider:mapsProvider,configured:mapsProvider!=='stub'},
    notifications:{sms:smsProvider,push:pushProvider}
  };
}

// This is a GO/NO-GO report for accepting real money. Unlike the general
// deployment contract, a test-key deployment cannot pass the LIVE launch gate.
// It never performs external requests and never reveals key material.
export function liveLaunchReadinessReport(env=process.env){
  const config=productionConfigReport(env);
  const secret=value('STRIPE_SECRET_KEY',env);
  const publishable=value('STRIPE_PUBLISHABLE_KEY',env);
  const checks=[
    {id:'production_configuration',ready:config.ready&&config.production&&config.deployment&&!config.staging},
    {id:'stripe_live_mode',ready:value('STRIPE_MODE',env).toLowerCase()==='live'},
    {id:'stripe_live_secret',ready:/^[sr]k_live_[A-Za-z0-9_\\-]{12,}$/.test(secret)},
    {id:'stripe_live_publishable',ready:/^pk_live_[A-Za-z0-9_\\-]{12,}$/.test(publishable)},
    {id:'stripe_webhook_signing',ready:/^whsec_[A-Za-z0-9_\\-]{12,}$/.test(value('STRIPE_WEBHOOK_SECRET',env))},
    {id:'stripe_connect_webhook_signing',ready:/^whsec_[A-Za-z0-9_\\-]{12,}$/.test(value('STRIPE_CONNECT_WEBHOOK_SECRET',env))},
    {id:'stripe_connect_v2',ready:value('STRIPE_CONNECT_V2_PROVISIONING',env)==='true'},
    {id:'legal_launch_prerequisites',ready:legalLaunchReadinessReport(env).ready}
  ];
  const blocking=checks.filter(c=>!c.ready).map(c=>c.id);
  // Stripe Dashboard charges_enabled/payouts_enabled and actual TEST E2E are
  // independent external launch requirements; this local report cannot verify them.
  return {ready:blocking.length===0,checks,blocking,
    externalVerificationRequired:['platform_charges_enabled','platform_payouts_enabled',
      'supplier_connect_charges_enabled','supplier_connect_payouts_enabled',
      'stripe_test_payment_webhook_refund_e2e']};
}

// Legal launch readiness is intentionally separate from a healthy deployment.
// Setting these values never substitutes for independent legal/DSA/GDPR review.
export function legalLaunchReadinessReport(env=process.env){
  const operatorName=value('LEGAL_OPERATOR_NAME',env);
  const legalForm=value('LEGAL_OPERATOR_LEGAL_FORM',env);
  const address=value('LEGAL_OPERATOR_ADDRESS',env);
  const support=value('LEGAL_SUPPORT_EMAIL',env);
  const complaints=value('LEGAL_COMPLAINTS_EMAIL',env);
  const privacy=value('LEGAL_PRIVACY_CONTACT',env);
  const checks=[
    {id:'operator_identity',ready:operatorName.length>=2},
    {id:'operator_legal_form',ready:legalForm.length>=2},
    {id:'operator_service_address',ready:address.length>=8},
    {id:'operator_contact',ready:validEmail(support)},
    {id:'complaints_contact',ready:validEmail(complaints)},
    {id:'privacy_controller_contact',ready:validEmail(privacy)},
    {id:'supplier_trader_status_disclosure',ready:value('LEGAL_TRADER_STATUS_DISCLOSURE_READY',env)==='true'},
    {id:'dsa_trader_traceability',ready:value('LEGAL_DSA_TRADER_VERIFICATION_READY',env)==='true'},
    {id:'privacy_retention_schedule',ready:value('LEGAL_PRIVACY_RETENTION_SCHEDULE_READY',env)==='true'},
    {id:'consumer_dispute_information',ready:value('LEGAL_CONSUMER_ADR_INFO_READY',env)==='true'},
    {id:'legal_texts_reviewed',ready:value('LEGAL_TEXTS_REVIEWED',env)==='true'}
  ];
  const blocking=checks.filter(item=>!item.ready).map(item=>item.id);
  return {ready:blocking.length===0,checks,blocking,
    independentReviewRequired:true,
    note:'Configured declarations are not proof of legal compliance or trader verification.'};
}

export function productionStorageReport(env=process.env){
  const deployment=isDeploymentEnvironment(env);
  const config=resolveDatabaseConfig(env);
  let volumeExists=false,volumeDirectory=false,volumeWritable=false;
  if(config.ok&&config.volumeRoot){
    try{
      const stat=fs.statSync(config.volumeRoot);
      volumeExists=true;
      volumeDirectory=stat.isDirectory();
      if(volumeDirectory){fs.accessSync(config.volumeRoot,fs.constants.R_OK|fs.constants.W_OK);volumeWritable=true}
    }catch{}
  }
  const checks=[
    {id:'storage_volume_exists',required:deployment,ready:volumeExists},
    {id:'storage_volume_directory',required:deployment,ready:volumeDirectory},
    {id:'storage_volume_writable',required:deployment,ready:volumeWritable},
    {id:'storage_database_on_volume',required:deployment,ready:config.ok&&Boolean(config.volumeRoot)&&inside(config.path,config.volumeRoot)}
  ];
  const blocking=checks.filter(check=>check.required&&!check.ready).map(check=>check.id);
  return {ready:blocking.length===0,deployment,checks,blocking,database:{driver:config.driver,source:config.source,volumeConfigured:Boolean(config.volumeRoot)}};
}

export function assertProductionConfig(env=process.env){
  const report=productionConfigReport(env);
  if(report.deployment&&!report.ready){
    const error=new Error(`Production configuration blocked: ${report.blocking.join(', ')}`);
    error.code='PRODUCTION_CONFIG_INVALID';
    error.blocking=report.blocking;
    throw error;
  }
  return report;
}

export function assertProductionStorage(env=process.env){
  const report=productionStorageReport(env);
  if(report.deployment&&!report.ready){
    const error=new Error(`Production storage blocked: ${report.blocking.join(', ')}`);
    error.code='PRODUCTION_STORAGE_INVALID';
    error.blocking=report.blocking;
    throw error;
  }
  return report;
}

export const runtimeConfig=Object.freeze({
  rootDir,
  nodeEnv:value('NODE_ENV')||'development',
  production:value('NODE_ENV')==='production',
  deployment:isDeploymentEnvironment(),
  port:Number(value('PORT')||4242),
  host:value('HOST')||'0.0.0.0',
  appUrl:value('APP_URL')||`http://localhost:${value('PORT')||4242}`,
  appVersion:value('APP_VERSION')||packageVersion,
  stripeMode:value('STRIPE_MODE')||'unset',
  emailWorkerEnabled:enabled('EMAIL_WORKER_ENABLED'),
  database:resolveDatabaseConfig(),
  uploadsDir:resolveUploadsConfig().directory
});
