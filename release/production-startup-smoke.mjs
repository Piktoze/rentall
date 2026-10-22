import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'rentall-production-smoke-'));
const port=Number(process.env.RENTALL_PRODUCTION_SMOKE_PORT||4397);
const base=`http://127.0.0.1:${port}`;
const env={...process.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(port),APP_URL:'https://rentall.example',PUBLIC_BASE_URL:'https://rentall.example',SESSION_SECRET:'session_'+('x'.repeat(48)),RENTALL_DB_PATH:path.join(temp,'rentall.sqlite'),RAILWAY_VOLUME_MOUNT_PATH:temp,STRIPE_MODE:'test',STRIPE_SECRET_KEY:'rk_test_production_smoke_restricted',STRIPE_PUBLISHABLE_KEY:'pk_test_production_smoke_public',STRIPE_WEBHOOK_SECRET:'whsec_production_smoke_signature',STRIPE_CONNECT_V2_PROVISIONING:'true',EMAIL_PROVIDER:'resend',EMAIL_FROM:'RentAll <bookings@example.com>',RESEND_API_KEY:'re_production_smoke',EMAIL_WORKER_ENABLED:'true',EMAIL_WORKER_TOKEN:'worker_'+('y'.repeat(48)),SUPPORT_EMAIL:'support@example.com'};
const child=spawn(process.execPath,['server.js'],{cwd:process.cwd(),env,stdio:['ignore','pipe','pipe']});
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
  const readiness=await fetch(`${base}/api/readiness`,{cache:'no-store'}),text=await readiness.text();
  if(readiness.status!==200)throw new Error(`production readiness ${readiness.status}: ${text}`);
  if(/rk_test_production|whsec_production|re_production|session_x|worker_y/.test(text+logs))throw new Error('secret leaked from production diagnostics');
  const body=JSON.parse(text);
  if(!body.ready||body.database?.migrationVersion<146)throw new Error('production migration/readiness contract failed');
  child.kill('SIGTERM');
  await Promise.race([new Promise((resolve,reject)=>child.once('exit',code=>code===0?resolve():reject(new Error(`shutdown exit ${code}: ${logs.slice(-1000)}`)))),sleep(5000).then(()=>{throw new Error('graceful shutdown timed out')})]);
  console.log(JSON.stringify({ok:true,health:health.status,readiness:readiness.status,migrationVersion:body.database.migrationVersion}));
}finally{
  if(child.exitCode===null)child.kill('SIGKILL');
  fs.rmSync(temp,{recursive:true,force:true});
}
