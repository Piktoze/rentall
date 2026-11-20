import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';
import {installPrivateTestRecipientOnboarding} from './modules/private-test-recipient-onboarding.js';
const env={PRIVATE_TEST_ENABLED:'true',PRIVATE_TEST_RUN_ID:'a'.repeat(32),PRIVATE_TEST_ALLOWED_EMAILS:'owner@example.test,other@example.test',PRIVATE_TEST_OWNER_EMAIL:'owner@example.test',PRIVATE_TEST_RECIPIENT_ID:'acct_synthetic',RENTINORBIT_STAGING:'true',RENTINORBIT_CATALOG_ONLY:'false',RENTINORBIT_SCT_TEST_RUNTIME:'true',RENTINORBIT_DEMO_PAYMENTS:'false',STRIPE_MODE:'test',STRIPE_SECRET_KEY:'sk_test_synthetic',STRIPE_PUBLISHABLE_KEY:'pk_test_synthetic',APP_URL:'https://rentinorbit.com'};
test('TEST onboarding is owner-only, fixed-account, POST/origin protected and rejects LIVE/real account/link',async()=>{
 let reads=0,links=0,variant='good',payload;
 const app=express();app.use((req,res,next)=>{if(req.get('x-synthetic-identity'))req.privateTestIdentity={email:req.get('x-synthetic-identity')};next();});
 const account=()=>({id:'acct_synthetic',livemode:variant==='live',contact_email:variant==='real'?'actual-owner@example.test':'synthetic-sct-'+('a'.repeat(32))+'@example.test',display_name:'RentInOrbit synthetic TEST fixture'});
 const stripe={v2:{core:{accounts:{retrieve:async id=>{reads++;assert.equal(id,'acct_synthetic');return account();}},accountLinks:{create:async p=>{links++;payload=p;return {account:'acct_synthetic',livemode:false,url:variant==='evil'?'https://evil.example/private':'https://connect.stripe.com/setup/synthetic-only'};}}}}};
 installPrivateTestRecipientOnboarding(app,{env,getStripe:()=>stripe});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url='http://127.0.0.1:'+server.address().port+'/__test-access/stripe-recipient';
 const post=(identity='owner@example.test',origin=env.APP_URL)=>fetch(url,{method:'POST',headers:{Origin:origin,'x-synthetic-identity':identity},redirect:'manual'});
 try{
  assert.equal((await fetch(url)).status,404);
  assert.equal((await post('')).status,403);assert.equal((await post('other@example.test')).status,403);
  assert.equal((await post('owner@example.test','https://untrusted.test')).status,403);assert.equal(reads,0);assert.equal(links,0);
  for(const bad of ['live','real']){variant=bad;assert.equal((await post()).status,409);assert.equal(links,0);}
  variant='evil';assert.equal((await post()).status,503);
  variant='good';const good=await post();assert.equal(good.status,303);assert.equal(good.headers.get('location'),'https://connect.stripe.com/setup/synthetic-only');
  assert.equal(good.headers.get('cache-control'),'private, no-store');assert.equal(good.headers.get('referrer-policy'),'no-referrer');
  assert.equal(payload.account,'acct_synthetic');assert.equal(payload.use_case.account_onboarding.return_url,env.APP_URL+'/');
  assert.ok(!JSON.stringify(payload).includes('tos_acceptance'));
  env.STRIPE_MODE='live';assert.equal((await post()).status,503);
 }finally{await new Promise(r=>server.close(r));}
});
