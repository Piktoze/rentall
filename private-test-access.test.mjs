import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import crypto from 'node:crypto';
import express from 'express';
import {installPrivateTestAccess} from './modules/private-test-access.js';
import {privateTestSettings,preparePrivateTestEnvironment,assertPrivatePath} from './modules/private-test-mode.js';
import {resolveDatabaseConfig,productionConfigReport,productionStorageReport} from './config.js';
const env={NODE_ENV:'production',PRIVATE_TEST_ENABLED:'true',PRIVATE_TEST_REQUIRED:'true',PRIVATE_TEST_RUN_ID:crypto.randomBytes(16).toString('hex'),
 PRIVATE_TEST_ALLOWED_EMAILS:'owner@example.test',PRIVATE_TEST_OWNER_EMAIL:'owner@example.test',
 RENTINORBIT_STAGING:'true',RENTINORBIT_CATALOG_ONLY:'false',RENTINORBIT_SCT_TEST_RUNTIME:'true',RENTINORBIT_DEMO_PAYMENTS:'false',
 STRIPE_MODE:'test',STRIPE_SECRET_KEY:'sk_test_synthetic_placeholder_123456',STRIPE_PUBLISHABLE_KEY:'pk_test_synthetic_placeholder_123456',
 APP_URL:'https://rentinorbit.com',PUBLIC_BASE_URL:'https://rentinorbit.com',TRUST_PROXY_HOPS:'1',SESSION_SECRET:'Synthetic-private-test-session-secret-123456789',
 DB_PATH:'/data/do-not-open.sqlite',UPLOADS_DIR:'/data/do-not-open-uploads',RAILWAY_VOLUME_MOUNT_PATH:'/data',
 DB_BACKUP_ENABLED:'false',BACKUP_SCHEDULER_ENABLED:'false',BACKUP_S3_ENABLED:'false'};
test('private storage ignores existing mounted paths; invalid TEST mode never falls back; symlinks rejected',()=>{
 assert.equal(privateTestSettings(env).valid,true);preparePrivateTestEnvironment(env);
 const db=resolveDatabaseConfig(env);assert.equal(db.source,'private-test');assert.ok(db.path.startsWith('/tmp/'));assert.equal(db.volumeRoot,null);
 assert.equal(productionStorageReport(env).ready,true);assert.equal(productionConfigReport(env).database.persistent,false);
 for(const overrides of [{STRIPE_MODE:'live'},{STRIPE_SECRET_KEY:'sk_live_invalid'},{RENTINORBIT_STAGING:'false'},{RENTINORBIT_DEMO_PAYMENTS:'true'},{PRIVATE_TEST_RUN_ID:'../data'}]){
  const bad={...env,...overrides};assert.equal(resolveDatabaseConfig(bad).ok,false);assert.throws(()=>preparePrivateTestEnvironment(bad));
 }
 assert.throws(()=>assertPrivatePath('/data/blocked'));
 const link=privateTestSettings(env).root+'/link';fs.symlinkSync('/data',link);assert.throws(()=>assertPrivatePath(link+'/db'));fs.unlinkSync(link);
 const normal=productionConfigReport({...env,PRIVATE_TEST_ENABLED:'false',PRIVATE_TEST_REQUIRED:'false',RAILWAY_VOLUME_MOUNT_PATH:''});assert.ok(normal.blocking.includes('database_volume_configured'));
 fs.rmSync(privateTestSettings(env).root,{recursive:true,force:true});
});
test('server gate protects every asset/API; allowlist OTP one-use, expiry, limits, host-only cookie and logout',async()=>{
 let clock=100000,mail=[];const app=express();installPrivateTestAccess(app,{env,now:()=>clock,send:async m=>mail.push(m)});
 app.get('/healthz',(req,res)=>res.json({ok:true}));app.post('/api/stripe/webhook',(req,res)=>res.status(400).send('Signature required'));
 app.get('/api/listings',(req,res)=>res.json({identity:req.privateTestIdentity}));app.get('/app.js',(req,res)=>res.send('app'));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const origin='http://127.0.0.1:'+server.address().port;
 const get=(p,cookie)=>fetch(origin+p,{headers:{Accept:'application/json',...(cookie?{cookie}:{})},redirect:'manual'});
 const post=(p,data={},cookie,requestOrigin=env.APP_URL)=>fetch(origin+p,{method:'POST',headers:{'Content-Type':'application/json',Origin:requestOrigin,...(cookie?{cookie}:{})},body:JSON.stringify(data)});
 try{
  for(const p of ['/api/listings','/uploads/secret.jpg','/app.js','/api/auth/me'])assert.equal((await get(p)).status,401,p);
  assert.equal((await fetch(origin+'/',{redirect:'manual'})).status,303);
  assert.equal((await get('/healthz')).status,200);assert.equal((await post('/api/stripe/webhook')).status,400);
  assert.equal((await get('/api/stripe/webhook')).status,401);
  assert.equal((await get('/__test-access')).status,200);
  assert.equal((await post('/__test-access/request',{email:'owner@example.test'},null,'https://evil.test')).status,403);
  const unknown=await post('/__test-access/request',{email:'stranger@example.test'});assert.equal(unknown.status,202);await unknown.json();assert.equal(mail.length,0);
  const r=await post('/__test-access/request',{email:'owner@example.test'});const {challenge}=await r.json();assert.equal(r.status,202);assert.equal(mail.length,1);
  assert.equal((await post('/__test-access/verify',{challenge,code:'wrong'})).status,400);
  const ok=await post('/__test-access/verify',{challenge,code:mail[0].payload.code});assert.equal(ok.status,200);
  const fullCookie=ok.headers.get('set-cookie');for(const flag of ['Secure','HttpOnly','SameSite=Lax','Path=/'])assert.ok(fullCookie.includes(flag));assert.ok(!fullCookie.includes('Domain='));
  const cookie=fullCookie.split(';')[0];assert.equal((await post('/__test-access/verify',{challenge,code:mail[0].payload.code})).status,400);
  const authorized=await get('/api/listings',cookie);assert.equal(authorized.status,200);assert.equal((await authorized.json()).identity.email,'owner@example.test');assert.equal(authorized.headers.get('cache-control'),'private, no-store');
  assert.equal((await get('/app.js',cookie)).status,200);assert.ok((await (await get('/service-worker.js',cookie)).text()).includes('unregister'));
  await post('/__test-access/logout',{},cookie);assert.equal((await get('/api/listings',cookie)).status,401);
  const second=await (await post('/__test-access/request',{email:'owner@example.test'})).json();clock+=600001;
  assert.equal((await post('/__test-access/verify',{challenge:second.challenge,code:mail[1].payload.code})).status,400);
  for(let i=0;i<5;i++)await post('/__test-access/request',{email:'stranger@example.test'});
  assert.equal((await post('/__test-access/request',{email:'stranger@example.test'})).status,429);
 }finally{await new Promise(r=>server.close(r));}
});
