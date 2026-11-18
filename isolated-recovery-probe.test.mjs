import test from 'node:test';import assert from 'node:assert/strict';
import express from 'express';
import {installIsolatedRecoveryProbe} from './modules/isolated-recovery-probe.js';
import {decodeResetMail} from './modules/password-recovery.js';
test('opt-in recovery probe uses only a synthetic memory account and one email; token is single-use',async()=>{
 const app=express();app.use(express.json());let item,count=0;
 const env={RENTINORBIT_ISOLATED_RECOVERY_PROBE:'true',RENTINORBIT_STAGING:'true',STRIPE_MODE:'test',
 STRIPE_SECRET_KEY:'sk_test_synthetic_never_network',RECOVERY_PROBE_RUN_ID:'1234567890abcdef1234567890abcdef',
 EMAIL_PROVIDER:'resend',RESEND_API_KEY:'synthetic-not-network',SESSION_SECRET:'SyntheticProbeEncryptionSecret-1234567890'};
 assert.equal(installIsolatedRecoveryProbe({app,env:{},deliver:()=>{},limit:(q,s,n)=>n()}),null);
 assert.throws(()=>installIsolatedRecoveryProbe({app,env:{...env,STRIPE_MODE:'live'}}));
 const p=installIsolatedRecoveryProbe({app,env,deliver:async mail=>{item=mail;count++;},limit:(q,s,n)=>n()});
 await p.send();await p.send();assert.equal(count,1);assert.equal(item.recipient,'ieva.zalpyte@gmail.com');
 const mail=decodeResetMail(item.payload,env.SESSION_SECRET),link=new URL(mail.url),token=link.hash.slice(7);
 assert.equal(link.origin,'https://rentall-staging.up.railway.app');assert.equal(JSON.stringify(item).includes(token),false);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));
 const base='http://127.0.0.1:'+server.address().port+link.pathname;
 const post=(origin)=>fetch(base+'/consume',{method:'POST',headers:{'content-type':'application/json',...(origin?{origin}:{})},body:JSON.stringify({token,password:'SyntheticNewPassword123'})});
 try{
  assert.equal((await fetch(base)).status,200);
  assert.equal((await post('https://untrusted.example')).status,403);
  assert.equal((await post()).status,200);assert.equal((await post()).status,400);
  assert.deepEqual(await (await fetch(base+'/status')).json(),{synthetic:true,storage:'memory',deliveryStatus:'provider_accepted',consumed:true});
 }finally{await new Promise(r=>server.close(r));p.close();}
});
