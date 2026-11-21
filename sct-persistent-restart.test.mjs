import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {inspectPersistentTestStorage} from './modules/sct-persistent-storage.js';
const runId='a'.repeat(32);
for(const kind of ['payment','transfer','refund'])test(`disk journal survives SIGKILL after provider ${kind}; restarted worker never creates twice`,()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rio-sct-restart-'));
 try{
  fs.writeFileSync(path.join(root,'test.sqlite'),'');fs.mkdirSync(path.join(root,'uploads'));
  fs.writeFileSync(path.join(root,'.rentinorbit-storage.json'),JSON.stringify({version:1,purpose:'fresh-private-stripe-test',runId,database:'test.sqlite',uploads:'uploads'}));
  const child=(action,kill='')=>spawnSync(process.execPath,['e2e/sct-restart-fixture.mjs',action,kind],{env:{...process.env,SCT_RESTART_ROOT:root,SCT_KILL_KIND:kill,PRIVATE_TEST_ENABLED:'false',PRIVATE_TEST_REQUIRED:'false',EMAIL_PROVIDER:'disabled',EMAIL_WORKER_ENABLED:'false',DB_BACKUP_ENABLED:'false',BACKUP_SCHEDULER_ENABLED:'false'},encoding:'utf8',timeout:15000});
  const crashed=child('crash',kind);assert.equal(crashed.signal,'SIGKILL',crashed.stderr+crashed.stdout);
  for(let n=0;n<2;n++){
   const recovered=child('recover');assert.equal(recovered.status,0,recovered.stderr+recovered.stdout);
   const result=JSON.parse(recovered.stdout.trim().split('\n').at(-1));
   assert.equal(result.calls[kind],1);assert.equal(result.result.status,'already_reconciled');
   if(kind==='transfer'){assert.equal(result.booking.payout,'transferred');assert.equal(result.booking.amount,85);}
   if(kind==='refund'){assert.equal(result.booking.payment,'refunded');assert.equal(result.booking.refund,100);}
  }
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('persistent storage refuses LIVE, existing /data root, missing ownership marker and symlinks',()=>{
 const base={PRIVATE_TEST_STORAGE_MODE:'persistent',PRIVATE_TEST_ENABLED:'true',RENTINORBIT_STAGING:'true',STRIPE_MODE:'test',RENTINORBIT_SCT_TEST_RUNTIME:'true',PRIVATE_TEST_RUN_ID:runId};
 assert.throws(()=>inspectPersistentTestStorage({...base,STRIPE_MODE:'live'}),{code:'SCT_PERSISTENT_TEST_ONLY'});
 assert.throws(()=>inspectPersistentTestStorage({...base,PRIVATE_TEST_PERSISTENT_ROOT:'/data'}),{code:'SCT_PERSISTENT_ROOT_INVALID'});
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rio-marker-'));
 try{assert.throws(()=>inspectPersistentTestStorage({...base,PRIVATE_TEST_PERSISTENT_ROOT:root}));
 fs.symlinkSync(root,root+'-link');assert.throws(()=>inspectPersistentTestStorage({...base,PRIVATE_TEST_PERSISTENT_ROOT:root+'-link'}),{code:'SCT_PERSISTENT_SYMLINK'});
 }finally{fs.rmSync(root+'-link',{force:true});fs.rmSync(root,{recursive:true,force:true});}
});

test('marked storage still refuses historical financial rows before installing runtime tables',async()=>{
 const {default:Database}=await import('better-sqlite3');
 const {createPersistentSctTestRuntime}=await import('./modules/sct-test-runtime.js');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rio-history-')),db=new Database(path.join(root,'test.sqlite'));
 try{
  fs.mkdirSync(path.join(root,'uploads'));fs.writeFileSync(path.join(root,'.rentinorbit-storage.json'),JSON.stringify({version:1,purpose:'fresh-private-stripe-test',runId,database:'test.sqlite',uploads:'uploads'}));
  db.exec("CREATE TABLE rental_bookings(booking_id TEXT,stripe_payment_intent_id TEXT);INSERT INTO rental_bookings VALUES('synthetic-history','pi_oldSynthetic')");
  const env={PRIVATE_TEST_STORAGE_MODE:'persistent',PRIVATE_TEST_PERSISTENT_ROOT:root,PRIVATE_TEST_ENABLED:'true',RENTINORBIT_STAGING:'true',STRIPE_MODE:'test',RENTINORBIT_SCT_TEST_RUNTIME:'true',PRIVATE_TEST_RUN_ID:runId};
  assert.throws(()=>createPersistentSctTestRuntime({db,stripe:{},env}),{code:'SCT_UNENROLLED_FINANCIAL_HISTORY'});
  assert.equal(db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table'").get().n,1);
 }finally{db.close();fs.rmSync(root,{recursive:true,force:true});}
});
