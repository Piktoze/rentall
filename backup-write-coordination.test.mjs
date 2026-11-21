import test from 'node:test';import assert from 'node:assert/strict';import Database from 'better-sqlite3';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';
import {createBackupWriteCoordinator} from './modules/backup-write-coordinator.js';
import {coordinatedEncryptedBackup} from './modules/coordinated-encrypted-backup.js';
import {selectExpiredBundles,encryptedBackupReviewSettings} from './ops/coordinated-backup-scheduler.js';
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const turn=()=>new Promise(r=>setImmediate(r));
function fixture(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'rio-coordination-')),uploads=path.join(root,'photos');fs.mkdirSync(uploads);const coordinator=createBackupWriteCoordinator(),db=coordinator.guardDatabase(new Database(path.join(root,'source.sqlite')));db.exec('CREATE TABLE state(version INTEGER);INSERT INTO state VALUES(0)');fs.writeFileSync(path.join(uploads,'synthetic.png'),'photo-0');return {root,uploads,coordinator,db,close(){db.close();fs.rmSync(root,{recursive:true,force:true});}};}
const {publicKey}=crypto.generateKeyPairSync('rsa',{modulusLength:3072,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
test('snapshot drains a real in-flight DB/photo writer, queues a new writer, and copies one coherent generation',async()=>{
 const f=fixture(),gate=defer(),entered=defer(),copyGate=defer(),copyEntered=defer();try{
 const old=f.coordinator.writer(async()=>{f.db.prepare('UPDATE state SET version=1').run();entered.resolve();await gate.promise;fs.writeFileSync(path.join(f.uploads,'synthetic.png'),'photo-1');});await entered.promise;
 let newRan=false;const backup=coordinatedEncryptedBackup({...f,output:path.join(f.root,'bundle.enc'),publicKey,buildBundle:async options=>{
  assert.equal(options.coordinationProof(),true);assert.equal(f.db.prepare('SELECT version FROM state').get().version,1);assert.equal(fs.readFileSync(path.join(f.uploads,'synthetic.png'),'utf8'),'photo-1');
  assert.throws(()=>f.db.prepare('UPDATE state SET version=99').run(),/BACKUP_WRITES_PAUSED/);assert.throws(()=>f.coordinator.assertWritable(),/BACKUP_WRITES_PAUSED/);
  copyEntered.resolve();await copyGate.promise;
  const {createEncryptedBundle}=await import('./modules/encrypted-backup-bundle.js');return createEncryptedBundle(options);
 }});await turn();assert.equal(f.coordinator.state().pending,true);assert.equal(f.coordinator.state().paused,false);
 const next=f.coordinator.writer(async()=>{newRan=true;f.db.prepare('UPDATE state SET version=2').run();fs.writeFileSync(path.join(f.uploads,'synthetic.png'),'photo-2');});
 await turn();assert.equal(newRan,false);gate.resolve();await old;await copyEntered.promise;assert.equal(newRan,false);copyGate.resolve();const proof=await backup;assert.ok(proof.bytes>100);await next;
 assert.equal(f.db.prepare('SELECT version FROM state').get().version,2);assert.equal(fs.readFileSync(path.join(f.uploads,'synthetic.png'),'utf8'),'photo-2');assert.deepEqual(f.coordinator.state(),{active:0,paused:false,pending:false,waiting:0});
 }finally{f.close();}
});
test('failed SQLite snapshot removes incomplete output and resumes queued DB/photo writes',async()=>{
 const f=fixture(),entered=defer(),failGate=defer(),backup=f.db.backup.bind(f.db);try{
 f.db.backup=async()=>{entered.resolve();await failGate.promise;throw Error('SYNTHETIC_BACKUP_FAILURE');};
 const output=path.join(f.root,'failed.enc');const copy=coordinatedEncryptedBackup({...f,output,publicKey});await entered.promise;
 let resumed=false;const next=f.coordinator.writer(async()=>{f.db.prepare('UPDATE state SET version=3').run();fs.writeFileSync(path.join(f.uploads,'synthetic.png'),'photo-3');resumed=true;});await turn();assert.equal(resumed,false);failGate.resolve();await assert.rejects(copy,/SYNTHETIC_BACKUP_FAILURE/);await next;
 assert.equal(fs.existsSync(output),false);assert.equal(resumed,true);assert.equal(f.db.prepare('SELECT version FROM state').get().version,3);f.db.backup=backup;
 const later=await coordinatedEncryptedBackup({...f,output:path.join(f.root,'later.enc'),publicKey});assert.ok(later.bytes>100);
 }finally{f.close();}
});
test('in-flight async handler is drained even after client aborts the HTTP response',async()=>{
 const {default:express}=await import('express');const f=fixture(),gate=defer(),entered=defer(),finished=defer();const app=express();app.use(f.coordinator.http());f.coordinator.guardRoutes(app);
 app.post('/write',async(req,res)=>{entered.resolve();await gate.promise;f.db.prepare('UPDATE state SET version=4').run();finished.resolve();res.end('ok');});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const controller=new AbortController(),request=fetch('http://127.0.0.1:'+server.address().port+'/write',{method:'POST',signal:controller.signal}).catch(()=>{});
 try{await entered.promise;controller.abort();await request;await turn();let copied=false;const copy=f.coordinator.snapshot(async()=>{copied=true;assert.equal(f.db.prepare('SELECT version FROM state').get().version,4);});await turn();assert.equal(copied,false);gate.resolve();await finished.promise;await copy;assert.equal(copied,true);}finally{gate.resolve();await new Promise(r=>server.close(r));f.close();}
});
test('retention has both count and age caps and never selects unrelated bucket objects',()=>{
 const now=Date.parse('2026-11-21T12:00:00Z');const objects=Array.from({length:30},(_,i)=>({Key:`bundles-v1/2026-11-21T12-00-00-000Z-${i.toString(16).padStart(16,'0')}.enc`,LastModified:new Date(now-i*3600000)}));objects.push({Key:'historical/old.db',LastModified:new Date(0)},{Key:'bundles-v1/unknown.txt',LastModified:new Date(0)});
 const selected=selectExpiredBundles(objects,now);assert.equal(selected.length,2);assert.ok(selected.every(x=>x.Key.endsWith('.enc')));assert.equal(selectExpiredBundles([{Key:objects[0].Key,LastModified:new Date(now-8*86400000)}],now).length,1);assert.equal(encryptedBackupReviewSettings.enabled,false);
});

test('drain timeout releases admission and never starts copying over a busy writer',async()=>{
 const f=fixture(),gate=defer(),entered=defer();try{const old=f.coordinator.writer(async()=>{entered.resolve();await gate.promise;});await entered.promise;
 // Keep a test timer referenced while the production coordinator timer is unref'ed.
 const keep=setTimeout(()=>{},1000);await assert.rejects(f.coordinator.snapshot(()=>assert.fail('copy must not start'),{drainTimeoutMs:10}),/BACKUP_DRAIN_TIMEOUT/);clearTimeout(keep);
 assert.equal(f.coordinator.state().pending,false);let admitted=false;await f.coordinator.writer(async()=>{admitted=true;});assert.equal(admitted,true);gate.resolve();await old;
 }finally{gate.resolve();f.close();}
});
