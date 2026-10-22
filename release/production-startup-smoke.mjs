import {spawn,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'rentall-production-smoke-'));
const port=Number(process.env.RENTALL_PRODUCTION_SMOKE_PORT||4397);
const base=`http://127.0.0.1:${port}`;
const secrets={
  session:'Sm0ke!A7bC9dE2fG4hJ6kL8mN3pQ5rT1vX',
  stripe:'rk_test_production_smoke_restricted',
  webhook:'whsec_production_smoke_signature',
  resend:'re_production_smoke_secret',
  worker:'W0rkerToken-2026-RentAll-RC45-!@#-ghijkl'
};
const env={...process.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(port),APP_URL:'https://rentall.example',PUBLIC_BASE_URL:'https://rentall.example',SESSION_SECRET:secrets.session,TRUST_PROXY_HOPS:'1',RENTALL_DB_PATH:path.join(temp,'rentall.sqlite'),UPLOADS_DIR:path.join(temp,'uploads'),DB_PATH:'',DATABASE_URL:'',RAILWAY_VOLUME_MOUNT_PATH:temp,STRIPE_MODE:'test',STRIPE_SECRET_KEY:secrets.stripe,STRIPE_PUBLISHABLE_KEY:'pk_test_production_smoke_public',STRIPE_WEBHOOK_SECRET:secrets.webhook,STRIPE_CONNECT_V2_PROVISIONING:'true',EMAIL_PROVIDER:'resend',EMAIL_FROM:'RentAll <bookings@rentall.example>',RESEND_API_KEY:secrets.resend,EMAIL_WORKER_ENABLED:'true',EMAIL_WORKER_TOKEN:secrets.worker,SUPPORT_EMAIL:'support@rentall.example',MAPS_PROVIDER:'stub',SMS_PROVIDER:'disabled',PUSH_PROVIDER:'disabled'};
const child=spawn(process.execPath,['ops/start.js'],{cwd:process.cwd(),env,stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',chunk=>logs+=chunk);child.stderr.on('data',chunk=>logs+=chunk);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

try{
  let health=null;
  for(let attempt=0;attempt<60;attempt++){
    if(child.exitCode!==null)throw new Error(`production server exited early: ${logs.slice(-1000)}`);
    try{health=await fetch(`${base}/healthz`);if(health.ok)break}catch{}
    await sleep(100);
  }
  if(!health?.ok)throw new Error(`production health check failed: ${logs.slice(-1000)}`);
  const publicSmoke=spawnSync(process.execPath,['release/smoke-production.mjs',base],{cwd:process.cwd(),env:process.env,encoding:'utf8',timeout:20000});
  if(publicSmoke.status!==0)throw new Error(`public smoke failed: ${(publicSmoke.stderr+publicSmoke.stdout).slice(-1000)}`);
  const checks={};let readinessBody=null;
  for(const pathname of ['/','/healthz','/api/readiness','/api/ops/status','/api/integrations/capabilities']){
    const response=await fetch(base+pathname,{cache:'no-store'}),text=await response.text();
    if(response.status!==200)throw new Error(`${pathname} returned ${response.status}: ${text.slice(0,500)}`);
    for(const secret of Object.values(secrets))if((text+logs).includes(secret))throw new Error(`secret leaked at ${pathname}`);
    if(pathname==='/api/readiness')readinessBody=JSON.parse(text);
    checks[pathname]=response.status;
  }
  if(!readinessBody?.ready||readinessBody.database?.migrationVersion<147||!readinessBody.database?.volumeConfigured)throw new Error('production migration/storage/readiness contract failed');
  child.kill('SIGTERM');
  await Promise.race([new Promise((resolve,reject)=>child.once('exit',code=>code===0?resolve():reject(new Error(`shutdown exit ${code}: ${logs.slice(-1000)}`)))),sleep(5000).then(()=>{throw new Error('graceful shutdown timed out')})]);
  console.log(JSON.stringify({ok:true,checks,migrationVersion:readinessBody.database.migrationVersion,gracefulShutdown:true}));
}finally{
  if(child.exitCode===null)child.kill('SIGKILL');
  fs.rmSync(temp,{recursive:true,force:true});
}
