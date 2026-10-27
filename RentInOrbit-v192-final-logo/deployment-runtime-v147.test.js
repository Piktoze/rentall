import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {productionConfigReport,productionStorageReport,resolveDatabaseConfig} from './config.js';
import railwayProgram from './.railway/railway.ts';
import {createRailwayContext,project} from 'railway/iac';

const ok=(value,message)=>{if(!value)throw new Error(message)};
const pkg=JSON.parse(fs.readFileSync('./package.json','utf8'));
const server=fs.readFileSync('./server.js','utf8');
const db=fs.readFileSync('./db.js','utf8');
const start=fs.readFileSync('./ops/start.js','utf8');
const publicSmoke=fs.readFileSync('./release/smoke-production.mjs','utf8');
const railway=fs.readFileSync('./railway.toml','utf8');
const railwayIac=fs.readFileSync('./.railway/railway.ts','utf8');
const runbook=fs.readFileSync('./release/RAILWAY_DEPLOYMENT.md','utf8');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'rentinorbit-v147-'));
const base={NODE_ENV:'production',APP_URL:'https://rentinorbit.example',PUBLIC_BASE_URL:'https://rentinorbit.example',SESSION_SECRET:'R4nD0m!aB3cD4eF5gH6iJ7kL8mN9pQ2rS',TRUST_PROXY_HOPS:'1',RENTINORBIT_DB_PATH:path.join(temp,'rentinorbit.sqlite'),UPLOADS_DIR:path.join(temp,'uploads'),RAILWAY_VOLUME_MOUNT_PATH:temp,DATABASE_URL:'',DB_PATH:'',STRIPE_MODE:'test',STRIPE_SECRET_KEY:'rk_test_deployment_restricted',STRIPE_PUBLISHABLE_KEY:'pk_test_deployment_public',STRIPE_WEBHOOK_SECRET:'whsec_deployment_signature',STRIPE_CONNECT_V2_PROVISIONING:'true',EMAIL_PROVIDER:'resend',EMAIL_FROM:'RentInOrbit <bookings@rentinorbit.example>',RESEND_API_KEY:'re_deployment_secret',EMAIL_WORKER_ENABLED:'true',EMAIL_WORKER_TOKEN:'V4lid-Worker-Token-2026-RentInOrbit-ghijkl!',SUPPORT_EMAIL:'support@rentinorbit.example',MAPS_PROVIDER:'stub',SMS_PROVIDER:'disabled',PUSH_PROVIDER:'disabled'};

try{
  ok(pkg.version==='1.0.0-rc.45','RC45 version');
  ok(pkg.devDependencies.railway.startsWith('^3.16.'),'current Railway IaC SDK');
  ok(pkg.scripts.start==='node ops/start.js','validated startup command');
  ok(productionConfigReport(base).ready,'valid deployment configuration');
  ok(productionStorageReport(base).ready,'mounted writable storage configuration');
  ok(!productionConfigReport({...base,NODE_ENV:'',RAILWAY_ENVIRONMENT_ID:'railway-env'}).ready,'Railway cannot run outside production mode');
  ok(!productionConfigReport({...base,PUBLIC_BASE_URL:'https://wrong.example'}).ready,'public origin mismatch blocked');
  ok(!productionConfigReport({...base,SESSION_SECRET:'weak-secret'}).ready,'weak session secret blocked');
  ok(!productionConfigReport({...base,STRIPE_SECRET_KEY:'rk_live_wrong_mode'}).ready,'Stripe key mode mismatch blocked');
  ok(!productionConfigReport({...base,EMAIL_FROM:'not-an-email'}).ready,'invalid sender blocked');
  ok(!productionConfigReport({...base,MAPS_PROVIDER:'mapbox',MAPS_PUBLIC_TOKEN:''}).ready,'live maps without public token blocked');
  ok(!productionConfigReport({...base,UPLOADS_DIR:path.join(os.tmpdir(),'outside-volume')}).ready,'ephemeral uploads blocked');
  ok(!resolveDatabaseConfig({...base,DATABASE_URL:'sqlite:///data/other.sqlite'}).ok,'ambiguous database settings blocked');
  ok(!productionStorageReport({...base,RAILWAY_VOLUME_MOUNT_PATH:'/missing-rentinorbit-volume',RENTINORBIT_DB_PATH:'/missing-rentinorbit-volume/rentinorbit.sqlite',UPLOADS_DIR:'/missing-rentinorbit-volume/uploads'}).ready,'missing volume blocked');

  ok(railway.includes('builder = "RAILPACK"'),'Railpack builder');
  ok(railway.includes('healthcheckPath = "/api/readiness"'),'Railway readiness healthcheck');
  ok(railwayIac.includes("github('Piktoze/rentinorbit',{branch:'main'})"),'GitHub main deployment source');
  ok(railwayIac.includes("volumeMounts:{'/data':data}")&&railwayIac.includes("replicas:{'europe-west4':1}"),'single-replica persistent volume');
  ok(railwayIac.includes("RENTINORBIT_DB_PATH:'/data/rentinorbit.sqlite'")&&railwayIac.includes("UPLOADS_DIR:'/data/uploads'"),'persistent runtime paths');
  const railwayDefinition=await railwayProgram(createRailwayContext({environment:'production',environmentName:'production'}),project);
  ok(railwayDefinition.name==='rentinorbit'&&railwayDefinition.resources.some(resource=>resource.type==='service'&&resource.name==='rentinorbit')&&railwayDefinition.resources.some(resource=>resource.type==='volume'&&resource.name==='rentinorbit-data'),'Railway IaC evaluates to service and volume');
  ok(start.includes('assertProductionConfig')&&start.includes('assertProductionStorage')&&start.includes("await import('../server.js')"),'fail-closed startup orchestration');
  ok(db.includes('REQUIRED_SCHEMA_VERSION=172')&&db.includes('v172-marketplace-trust-foundation'),'migration 172');
  ok(server.includes('runtimeConfig.uploadsDir'),'persistent uploads');
  ok(server.includes('stripe.webhooks.constructEvent'),'signed Stripe webhooks');
  ok(server.includes('verifyBookingPaymentToken'),'guest booking token protection');
  ok(server.includes('requireSupplierTransferCapability'),'server payout capability gate');
  ok(server.includes('calculateAuthoritativeRentalPrice'),'server pricing authority');
  ok(server.includes('recoverInterruptedTransactionalEmails')&&server.includes('emailWorkerPromise'),'restart-safe transactional email worker');
  ok(publicSmoke.includes("await request('/')")&&publicSmoke.includes("'/api/readiness'")&&publicSmoke.includes("'/api/ops/status'")&&publicSmoke.includes("'/api/integrations/capabilities'"),'public deployment smoke surface');
  ok(publicSmoke.includes('Secret leakage detected'),'public secret leakage gate');
  ok(runbook.includes('RAILWAY_VOLUME_MOUNT_PATH=/data')&&runbook.includes('migration 172'),'exact volume and migration runbook');

  const blockedSecret='NeverPrintThis-Session-Secret-abcdef123456';
  const blocked=spawnSync(process.execPath,['ops/start.js'],{cwd:process.cwd(),env:{PATH:process.env.PATH,NODE_ENV:'production',SESSION_SECRET:blockedSecret},encoding:'utf8',timeout:5000});
  ok(blocked.status!==0,'invalid production startup exits');
  ok((blocked.stdout+blocked.stderr).includes('startup_blocked'),'startup emits safe block record');
  ok(!(blocked.stdout+blocked.stderr).includes(blockedSecret),'startup never logs secret value');

  const initialized=spawnSync(process.execPath,['ops/init-db.js'],{cwd:process.cwd(),env:{...process.env,...base},encoding:'utf8',timeout:10000});
  ok(initialized.status===0,`production database init failed: ${initialized.stderr}`);
  const result=JSON.parse(initialized.stdout.trim().split('\n').at(-1));
  ok(result.ok&&result.persistent&&result.migrationVersion>=172,'production migration 172 initialized on volume');

  const emailDb=path.join(temp,'email-recovery.sqlite');
  const emailEnv={...process.env,NODE_ENV:'test',RENTINORBIT_DB_PATH:emailDb,DATABASE_URL:'',DB_PATH:''};
  const claimScript="import {enqueueTransactionalEmail,claimTransactionalEmails,closeDatabase} from './db.js';enqueueTransactionalEmail({recipient:'customer@rentinorbit.example',templateKey:'booking_received',subject:'Booking',payload:{}});console.log(JSON.stringify({claimed:claimTransactionalEmails().length}));closeDatabase();";
  const interrupted=spawnSync(process.execPath,['--input-type=module','-e',claimScript],{cwd:process.cwd(),env:emailEnv,encoding:'utf8',timeout:10000});
  ok(interrupted.status===0&&JSON.parse(interrupted.stdout.trim()).claimed===1,'email enters sending state before interruption');
  const recoverScript="import {recoverInterruptedTransactionalEmails,claimTransactionalEmails,closeDatabase} from './db.js';const recovered=recoverInterruptedTransactionalEmails();const claimed=claimTransactionalEmails();console.log(JSON.stringify({recovered,claimed:claimed.length}));closeDatabase();";
  const restarted=spawnSync(process.execPath,['--input-type=module','-e',recoverScript],{cwd:process.cwd(),env:emailEnv,encoding:'utf8',timeout:10000});
  const recovered=JSON.parse(restarted.stdout.trim());
  ok(restarted.status===0&&recovered.recovered===1&&recovered.claimed===1,'interrupted email is recovered after restart');
}finally{
  fs.rmSync(temp,{recursive:true,force:true});
}

console.log('PASS V147 Railway deployment runtime');
