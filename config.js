import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

dotenv.config();

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

export function isDeploymentEnvironment(env=process.env){
  return String(env.NODE_ENV||'')==='production'||Boolean(env.RAILWAY_ENVIRONMENT_ID||env.RAILWAY_PROJECT_ID||env.RAILWAY_SERVICE_ID);
}

export function resolveDatabaseConfig(env=process.env){
  const databaseUrl=String(env.DATABASE_URL||'').trim();
  const explicit=String(env.RENTALL_DB_PATH||env.DB_PATH||'').trim();
  const volumeRoot=String(env.RAILWAY_VOLUME_MOUNT_PATH||env.PERSISTENT_DATA_DIR||'').trim();
  if(databaseUrl&&explicit)return {ok:false,driver:'unsupported',source:'conflict',error:'Configure DATABASE_URL or RENTALL_DB_PATH, not both.'};
  if(databaseUrl){
    const filePath=sqlitePathFromUrl(databaseUrl);
    if(!filePath)return {ok:false,driver:'unsupported',source:'DATABASE_URL',error:'Only absolute file: or sqlite:/// DATABASE_URL values are supported in RC45.'};
    return {ok:true,driver:'sqlite',source:'DATABASE_URL',path:path.resolve(filePath),volumeRoot:volumeRoot?path.resolve(volumeRoot):null};
  }
  const filePath=explicit?path.resolve(explicit):(volumeRoot?path.join(path.resolve(volumeRoot),'rentall.sqlite'):path.join(rootDir,'rentall.sqlite'));
  return {ok:true,driver:'sqlite',source:explicit?(env.RENTALL_DB_PATH?'RENTALL_DB_PATH':'DB_PATH'):(volumeRoot?'RAILWAY_VOLUME_MOUNT_PATH':'default-local'),path:filePath,volumeRoot:volumeRoot?path.resolve(volumeRoot):null};
}

export function resolveUploadsConfig(env=process.env){
  const volumeRoot=String(env.RAILWAY_VOLUME_MOUNT_PATH||env.PERSISTENT_DATA_DIR||'').trim();
  const explicit=String(env.UPLOADS_DIR||'').trim();
  const directory=explicit?path.resolve(explicit):(volumeRoot?path.join(path.resolve(volumeRoot),'uploads'):path.join(rootDir,'uploads'));
  return {directory,source:explicit?'UPLOADS_DIR':(volumeRoot?'RAILWAY_VOLUME_MOUNT_PATH':'default-local'),volumeRoot:volumeRoot?path.resolve(volumeRoot):null};
}

function stripeModeFor(secret){
  if(/^[sr]k_live_/.test(secret))return 'live';
  if(/^[sr]k_test_/.test(secret))return 'test';
  return 'unknown';
}

export function productionConfigReport(env=process.env){
  const production=String(env.NODE_ENV||'')==='production';
  const deployment=isDeploymentEnvironment(env);
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
    {id:'stripe_mode',required:deployment,ready:['test','live'].includes(stripeMode)},
    {id:'stripe_secret',required:deployment,ready:/^[sr]k_(?:test|live)_[A-Za-z0-9_\-]{12,}$/.test(stripeSecret)&&detectedStripeMode===stripeMode},
    {id:'stripe_publishable',required:deployment,ready:new RegExp(`^pk_${stripeMode}_[A-Za-z0-9_\\-]{12,}$`).test(publishable)},
    {id:'stripe_webhook',required:deployment,ready:/^whsec_[A-Za-z0-9_\-]{12,}$/.test(webhookSecret)},
    {id:'connect_v2',required:deployment,ready:String(env.STRIPE_CONNECT_V2_PROVISIONING||'')==='true'},
    {id:'email_provider',required:deployment,ready:emailProvider==='resend'},
    {id:'email_from',required:deployment,ready:validEmail(emailFrom)},
    {id:'email_api_key',required:deployment,ready:emailProvider==='resend'&&/^re_[A-Za-z0-9_\-]{8,}$/.test(String(env.RESEND_API_KEY||''))},
    {id:'email_worker',required:deployment,ready:String(env.EMAIL_WORKER_ENABLED||'')==='true'},
    {id:'email_worker_token',required:deployment,ready:strongSecret(env.EMAIL_WORKER_TOKEN)},
    {id:'support_email',required:deployment,ready:validEmail(env.SUPPORT_EMAIL)},
    {id:'maps_configuration',required:deployment,ready:['stub','mapbox','google'].includes(mapsProvider)&&(mapsProvider==='stub'||Boolean(String(env.MAPS_PUBLIC_TOKEN||'').trim()))},
    {id:'sms_provider',required:deployment,ready:smsProvider==='disabled'},
    {id:'push_provider',required:deployment,ready:pushProvider==='disabled'}
  ];
  const blocking=checks.filter(check=>check.required&&!check.ready).map(check=>check.id);
  return {
    ready:blocking.length===0,production,deployment,railway,checks,blocking,
    database:{driver:dbConfig.driver,source:dbConfig.source,persistent:dbConfig.source!=='default-local',volumeConfigured:Boolean(dbConfig.volumeRoot)},
    uploads:{source:uploadsConfig.source,persistent:Boolean(uploadsConfig.volumeRoot)&&inside(uploadsConfig.directory,uploadsConfig.volumeRoot)},
    stripe:{configured:Boolean(stripeSecret),mode:stripeMode||'unset',keyType:stripeSecret.startsWith('rk_')?'restricted':stripeSecret.startsWith('sk_')?'secret':'unset',webhookConfigured:Boolean(webhookSecret)},
    email:{provider:emailProvider||'unset',workerEnabled:enabled('EMAIL_WORKER_ENABLED',env),fromConfigured:validEmail(emailFrom)},
    maps:{provider:mapsProvider,configured:mapsProvider!=='stub'},
    notifications:{sms:smsProvider,push:pushProvider}
  };
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
