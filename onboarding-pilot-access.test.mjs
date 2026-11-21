import test from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';import express from 'express';
import {onboardingPilotAccess,onboardingPilotSupplierAllowed} from './modules/onboarding-pilot-access.js';
import {installSctOnboardingRoutes} from './modules/sct-onboarding-routes.js';
test('future LIVE onboarding pilot remains private; only health bypasses gate and allowlisted authenticated owner gets form',async()=>{
 const password='SYNTHETIC_PRIVATE_PILOT_NOT_REAL_123456789',env={CONNECT_ONBOARDING_ONLY_ENABLED:'true',CONNECT_ONBOARDING_ACCESS_SHA256:crypto.createHash('sha256').update(password).digest('hex'),CONNECT_ONBOARDING_ALLOWED_EMAILS:'owner@example.test'};
 assert.throws(()=>onboardingPilotAccess({...env,CONNECT_ONBOARDING_ACCESS_SHA256:''}),/PRIVATE_ACCESS_REQUIRED/);
 const app=express();app.use(onboardingPilotAccess(env));app.get('/healthz',(req,res)=>res.sendStatus(200));app.get('/',(req,res)=>res.send('private app'));
 let providerCalls=0;const auth=(...roles)=>(req,res,next)=>{if(!req.headers['x-user'])return res.sendStatus(401);req.appUser={email:req.headers['x-user'],role:'supplier'};next();};
 installSctOnboardingRoutes(app,{enabled:()=>true,allowed:req=>onboardingPilotSupplierAllowed(req,env),requireRole:auth,getService:async()=>{providerCalls++;return {hostedLink:async u=>({owner:u.email})};}});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port,authorization='Basic '+Buffer.from('rentinorbit:'+password).toString('base64');
 try{assert.equal((await fetch(base+'/healthz')).status,200);const denied=await fetch(base+'/');assert.equal(denied.status,401);assert.match(denied.headers.get('www-authenticate'),/Basic/);assert.equal((await fetch(base+'/',{headers:{authorization}})).status,200);
  const url=base+'/api/stripe/connect/hosted-onboarding-link';assert.equal((await fetch(url,{method:'POST',headers:{authorization,'x-user':'stranger@example.test'}})).status,403);assert.equal(providerCalls,0);
  const r=await fetch(url,{method:'POST',headers:{authorization,'x-user':'owner@example.test'}});assert.equal(r.status,200);assert.equal((await r.json()).owner,'owner@example.test');assert.equal(providerCalls,1);
  assert.equal(onboardingPilotSupplierAllowed({appUser:{email:'owner@example.test'}},{...env,CONNECT_ONBOARDING_ALLOWED_EMAILS:''}),false);
 }finally{await new Promise(r=>server.close(r));}
});

test('capacity review reads only filesystem counters on the exact staging service',async()=>{
 const {stagingCapacityReview}=await import('./modules/staging-capacity-review.js');let touched=false;assert.equal(stagingCapacityReview({},()=>{touched=true;}),null);assert.equal(touched,false);
 const report=stagingCapacityReview({RAILWAY_PROJECT_ID:'a9cc79be-565a-4b5b-a237-09d91977f68b',RAILWAY_ENVIRONMENT_ID:'ca5aa000-83a9-40b9-b9b6-74b3602f3dde',RAILWAY_SERVICE_ID:'dc5bb7ad-5e0c-4c52-81b1-4fe9700f7b77'},p=>{assert.equal(p,'/data');return {blocks:100,bavail:80,bfree:90,bsize:4096};});assert.equal(report.availableBytes,327680);assert.equal(report.legacySchedulerEnabled,false);assert.equal(report.encryptedSchedulerEnabled,false);assert.equal(report.readOnly,true);
});
