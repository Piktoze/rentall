import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

dotenv.config();

const rootDir=path.dirname(fileURLToPath(import.meta.url));
const packageVersion=JSON.parse(fs.readFileSync(path.join(rootDir,'package.json'),'utf8')).version;
const value=name=>String(process.env[name]||'').trim();
const enabled=name=>value(name).toLowerCase()==='true';
const inside=(child,parent)=>child===parent||child.startsWith(parent+path.sep);

function sqlitePathFromUrl(raw){
  if(raw.startsWith('file:')) return fileURLToPath(new URL(raw));
  if(raw.startsWith('sqlite:///')) return path.resolve('/',raw.slice('sqlite:///'.length));
  if(raw.startsWith('sqlite://')) return path.resolve('/',raw.slice('sqlite://'.length));
  return null;
}

export function resolveDatabaseConfig(env=process.env){
  const databaseUrl=String(env.DATABASE_URL||'').trim();
  const volumeRoot=String(env.RAILWAY_VOLUME_MOUNT_PATH||env.PERSISTENT_DATA_DIR||'').trim();
  if(databaseUrl){
    const filePath=sqlitePathFromUrl(databaseUrl);
    if(!filePath) return {ok:false,driver:'unsupported',source:'DATABASE_URL',error:'Only file: or sqlite:/// DATABASE_URL values are supported in RC44. Configure a Railway volume and RENTALL_DB_PATH; PostgreSQL requires a future adapter.'};
    return {ok:true,driver:'sqlite',source:'DATABASE_URL',path:path.resolve(filePath),volumeRoot:volumeRoot?path.resolve(volumeRoot):null};
  }
  const explicit=String(env.RENTALL_DB_PATH||env.DB_PATH||'').trim();
  const filePath=explicit?path.resolve(explicit):(volumeRoot?path.join(path.resolve(volumeRoot),'rentall.sqlite'):path.join(rootDir,'rentall.sqlite'));
  return {ok:true,driver:'sqlite',source:explicit?(env.RENTALL_DB_PATH?'RENTALL_DB_PATH':'DB_PATH'):(volumeRoot?'RAILWAY_VOLUME_MOUNT_PATH':'default-local'),path:filePath,volumeRoot:volumeRoot?path.resolve(volumeRoot):null};
}

function stripeModeFor(secret){
  if(/^[sr]k_live_/.test(secret)) return 'live';
  if(/^[sr]k_test_/.test(secret)) return 'test';
  return 'unknown';
}

export function productionConfigReport(env=process.env){
  const production=String(env.NODE_ENV||'development')==='production';
  const dbConfig=resolveDatabaseConfig(env);
  const appUrl=String(env.APP_URL||'').trim();
  const sessionSecret=String(env.SESSION_SECRET||'');
  const stripeSecret=String(env.STRIPE_SECRET_KEY||'').trim();
  const stripeMode=String(env.STRIPE_MODE||'').trim().toLowerCase();
  const detectedStripeMode=stripeModeFor(stripeSecret);
  const publishable=String(env.STRIPE_PUBLISHABLE_KEY||'').trim();
  const emailProvider=String(env.EMAIL_PROVIDER||'').trim().toLowerCase();
  const checks=[
    {id:'app_url_https',required:production,ready:/^https:\/\//i.test(appUrl)&&!/^https:\/\/(localhost|127\.0\.0\.1)(?:[:/]|$)/i.test(appUrl)},
    {id:'session_secret',required:production,ready:sessionSecret.length>=32&&!/replace|changeme|secret/i.test(sessionSecret)},
    {id:'database_supported',required:true,ready:dbConfig.ok},
    {id:'database_explicit',required:production,ready:dbConfig.ok&&dbConfig.source!=='default-local'},
    {id:'database_absolute',required:production,ready:dbConfig.ok&&path.isAbsolute(dbConfig.path||'')},
    {id:'database_not_ephemeral',required:production,ready:dbConfig.ok&&!inside(dbConfig.path||'',rootDir)},
    {id:'database_on_volume',required:production&&Boolean(dbConfig.volumeRoot),ready:dbConfig.ok&&(!dbConfig.volumeRoot||inside(dbConfig.path,dbConfig.volumeRoot))},
    {id:'stripe_mode',required:production,ready:['test','live'].includes(stripeMode)},
    {id:'stripe_secret',required:production,ready:Boolean(stripeSecret)&&detectedStripeMode===stripeMode},
    {id:'stripe_publishable',required:production,ready:Boolean(publishable)&&publishable.startsWith(`pk_${stripeMode}_`)},
    {id:'stripe_webhook',required:production,ready:/^whsec_[A-Za-z0-9_\-]{12,}$/.test(String(env.STRIPE_WEBHOOK_SECRET||''))},
    {id:'connect_v2',required:production,ready:String(env.STRIPE_CONNECT_V2_PROVISIONING||'')==='true'},
    {id:'email_provider',required:production,ready:emailProvider==='resend'},
    {id:'email_from',required:production,ready:Boolean(String(env.EMAIL_FROM||'').trim())},
    {id:'email_api_key',required:production,ready:emailProvider==='resend'&&Boolean(String(env.RESEND_API_KEY||'').trim())},
    {id:'email_worker',required:production,ready:String(env.EMAIL_WORKER_ENABLED||'')==='true'},
    {id:'email_worker_token',required:production,ready:String(env.EMAIL_WORKER_TOKEN||'').length>=32},
    {id:'support_email',required:production,ready:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(env.SUPPORT_EMAIL||''))}
  ];
  const blocking=checks.filter(check=>check.required&&!check.ready).map(check=>check.id);
  return {ready:blocking.length===0,production,checks,blocking,database:{driver:dbConfig.driver,source:dbConfig.source,persistent:dbConfig.source!=='default-local'},stripe:{configured:Boolean(stripeSecret),mode:stripeMode||'unset',keyType:stripeSecret.startsWith('rk_')?'restricted':stripeSecret.startsWith('sk_')?'secret':'unset'},email:{provider:emailProvider||'unset',workerEnabled:String(env.EMAIL_WORKER_ENABLED||'')==='true'}};
}

export function assertProductionConfig(env=process.env){
  const report=productionConfigReport(env);
  if(report.production&&!report.ready){
    const error=new Error(`Production configuration blocked: ${report.blocking.join(', ')}`);
    error.code='PRODUCTION_CONFIG_INVALID';
    error.blocking=report.blocking;
    throw error;
  }
  return report;
}

export const runtimeConfig=Object.freeze({
  rootDir,
  nodeEnv:value('NODE_ENV')||'development',
  production:value('NODE_ENV')==='production',
  port:Number(value('PORT')||4242),
  host:value('HOST')||'0.0.0.0',
  appUrl:value('APP_URL')||`http://localhost:${value('PORT')||4242}`,
  appVersion:value('APP_VERSION')||packageVersion,
  stripeMode:value('STRIPE_MODE')||'unset',
  emailWorkerEnabled:enabled('EMAIL_WORKER_ENABLED'),
  database:resolveDatabaseConfig()
});
