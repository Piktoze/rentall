import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {productionConfigReport,resolveDatabaseConfig} from './config.js';

const ok=(value,message)=>{if(!value)throw new Error(message)};
const pkg=JSON.parse(fs.readFileSync('./package.json','utf8'));
const server=fs.readFileSync('./server.js','utf8');
const db=fs.readFileSync('./db.js','utf8');
const railway=fs.readFileSync('./railway.toml','utf8');
const runbook=fs.readFileSync('./release/RAILWAY_DEPLOYMENT.md','utf8');

ok(Number(pkg.version.split('.').at(-1))>=44,'RC44 or newer version');
ok(pkg.dependencies.stripe.startsWith('^22.6.'),'current Stripe SDK');
ok(/healthcheckPath = "\/(healthz|api\/readiness)"/.test(railway),'Railway health check');
ok(railway.includes('restartPolicyType = "ON_FAILURE"'),'Railway restart policy');
ok(db.includes('schema_migrations')&&db.includes("146,'rc44-production-foundation'"),'migration 146');
ok(db.includes("wal_checkpoint(TRUNCATE)")&&db.includes('closeDatabase'),'restart-safe database close');
ok(server.includes("apiVersion:'2026-08-26.dahlia'"),'Stripe API version');
ok(server.includes('stripe.webhooks.constructEvent'),'webhook verification');
ok(server.includes('verifyBookingPaymentToken'),'guest token protection');
ok(server.includes('requireSupplierTransferCapability'),'payout capability gate');
ok(server.includes('server.closeIdleConnections?.()'),'graceful HTTP drain');
ok(!server.includes("version:'1.0.0-rc.24'")&&!server.includes("version:'1.0.0-rc.33'"),'no stale readiness versions');
ok(runbook.includes('RENTINORBIT_DB_PATH=/data/rentinorbit.sqlite'),'volume instructions');
ok(runbook.includes('Never place a Stripe secret'),'secret handling');

const valid={NODE_ENV:'production',APP_URL:'https://rentinorbit.example',PUBLIC_BASE_URL:'https://rentinorbit.example',SESSION_SECRET:'R4nD0m!aB3cD4eF5gH6iJ7kL8mN9pQ2rS',TRUST_PROXY_HOPS:'1',RENTINORBIT_DB_PATH:'/data/rentinorbit.sqlite',UPLOADS_DIR:'/data/uploads',RAILWAY_VOLUME_MOUNT_PATH:'/data',STRIPE_MODE:'test',STRIPE_SECRET_KEY:'rk_test_example_restricted',STRIPE_PUBLISHABLE_KEY:'pk_test_example_public',STRIPE_WEBHOOK_SECRET:'whsec_example_signature',STRIPE_CONNECT_V2_PROVISIONING:'true',EMAIL_PROVIDER:'resend',EMAIL_FROM:'RentInOrbit <bookings@example.com>',RESEND_API_KEY:'re_example_key',EMAIL_WORKER_ENABLED:'true',EMAIL_WORKER_TOKEN:'V4lid-Worker-Token-2026-RentInOrbit-ghijkl!',SUPPORT_EMAIL:'support@example.com',MAPS_PROVIDER:'stub',SMS_PROVIDER:'disabled',PUSH_PROVIDER:'disabled'};
ok(productionConfigReport(valid).ready,'valid production contract');
ok(!productionConfigReport({...valid,STRIPE_SECRET_KEY:'rk_live_wrong_mode'}).ready,'Stripe mode mismatch fails');
ok(!productionConfigReport({...valid,RENTINORBIT_DB_PATH:'./rentinorbit.sqlite',RAILWAY_VOLUME_MOUNT_PATH:''}).ready,'ephemeral database fails');
ok(!resolveDatabaseConfig({...valid,DATABASE_URL:'postgresql://example/db'}).ok,'unsupported database URL fails');

const cleanEnv={PATH:process.env.PATH,NODE_ENV:'production'};
const blocked=spawnSync(process.execPath,['server.js'],{cwd:process.cwd(),env:cleanEnv,encoding:'utf8',timeout:5000});
ok(blocked.status!==0,'invalid production startup must exit');
ok((blocked.stderr+blocked.stdout).includes('Production configuration blocked'),'startup identifies configuration block');

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'rentinorbit-rc44-'));
const initialized=spawnSync(process.execPath,['ops/init-db.js'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'test',RENTINORBIT_DB_PATH:path.join(tmp,'rentinorbit.sqlite'),DATABASE_URL:''},encoding:'utf8',timeout:10000});
try{
  ok(initialized.status===0,`database init failed: ${initialized.stderr}`);
  const result=JSON.parse(initialized.stdout.trim());
  ok(result.ok&&result.migrationVersion>=146,'database migration result');
}finally{fs.rmSync(tmp,{recursive:true,force:true})}

ok(fs.existsSync('./release/production-startup-smoke.mjs'),'production startup smoke');
ok(pkg.scripts['smoke:production-startup'],'production startup smoke script');

console.log('PASS V146 production foundation');
