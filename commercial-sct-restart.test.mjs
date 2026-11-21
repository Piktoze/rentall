import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
for(const kind of ['payment','transfer','refund'])test(`commercial LIVE-shaped offline journal: SIGKILL after ${kind}, repeated recovery creates no second operation`,()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rio-commercial-restart-'));
 try{
  const child=(action,kill='')=>spawnSync(process.execPath,['e2e/commercial-sct-restart-fixture.mjs',action,kind],{env:{...process.env,COMMERCIAL_RESTART_ROOT:root,SCT_KILL_KIND:kill,PRIVATE_TEST_ENABLED:'false',PRIVATE_TEST_REQUIRED:'false',EMAIL_PROVIDER:'disabled',EMAIL_WORKER_ENABLED:'false',DB_BACKUP_ENABLED:'false',BACKUP_SCHEDULER_ENABLED:'false'},encoding:'utf8',timeout:15000});
  const crashed=child('crash',kind);assert.equal(crashed.signal,'SIGKILL',crashed.stderr+crashed.stdout);
  for(let n=0;n<2;n++){
   const recovered=child('recover');assert.equal(recovered.status,0,recovered.stderr+recovered.stdout);
   const result=JSON.parse(recovered.stdout.trim().split('\n').at(-1));
   assert.equal(result.journalSynchronous,2);assert.equal(result.calls[kind],1);assert.equal(result.result.status,'already_reconciled');
   if(kind==='transfer'){assert.equal(result.booking.payout,'transferred');assert.equal(result.booking.amount,85);}
   if(kind==='refund'){assert.equal(result.booking.payment,'refunded');assert.equal(result.booking.refund,100);}
  }
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
