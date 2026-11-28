import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';import Database from 'better-sqlite3';
import {createEncryptedBundle,restoreEncryptedBundle} from './modules/encrypted-backup-bundle.js';
test('encrypted SQLite+photo manifest restores exact contents; wrong key and tampering cannot extract files',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rio-encrypted-test-')),db=new Database(path.join(root,'source.sqlite'));
 try{
  db.exec("CREATE TABLE synthetic(id TEXT PRIMARY KEY,value TEXT);INSERT INTO synthetic VALUES('one','synthetic-private-value')");
  const uploads=path.join(root,'uploads');fs.mkdirSync(uploads);fs.writeFileSync(path.join(uploads,'photo.png'),Buffer.from('synthetic-photo-bytes'));
  const keys=crypto.generateKeyPairSync('rsa',{modulusLength:2048}),bundle=path.join(root,'copy.enc');
  const result=await createEncryptedBundle({db,uploads,output:bundle,publicKey:keys.publicKey,quiesced:true});assert.equal(result.fileCount,2);
  assert.equal(fs.readFileSync(bundle).includes(Buffer.from('synthetic-private-value')),false);
  const target=path.join(root,'restored');await restoreEncryptedBundle({bundle,privateKey:keys.privateKey,target});
  const restored=new Database(path.join(target,'database.sqlite'),{readonly:true});assert.equal(restored.pragma('integrity_check',{simple:true}),'ok');assert.equal(restored.prepare('SELECT value FROM synthetic').get().value,'synthetic-private-value');restored.close();
  assert.equal(fs.readFileSync(path.join(target,'uploads','photo.png'),'utf8'),'synthetic-photo-bytes');
  const tampered=path.join(root,'bad.enc'),data=fs.readFileSync(bundle);data[data.length-1]^=1;fs.writeFileSync(tampered,data);
  await assert.rejects(restoreEncryptedBundle({bundle:tampered,privateKey:keys.privateKey,target:path.join(root,'bad-target')}));assert.equal(fs.existsSync(path.join(root,'bad-target')),false);
  const other=crypto.generateKeyPairSync('rsa',{modulusLength:2048});await assert.rejects(restoreEncryptedBundle({bundle,privateKey:other.privateKey,target:path.join(root,'wrong-key')}));
  await assert.rejects(restoreEncryptedBundle({bundle,privateKey:keys.privateKey,target}),/FRESH_TARGET/);
  await assert.rejects(createEncryptedBundle({db,uploads,output:path.join(root,'no-pause.enc'),publicKey:keys.publicKey,quiesced:false}));
 }finally{db.close();fs.rmSync(root,{recursive:true,force:true});}
});

import {Readable} from 'node:stream';
import {r2BackupConfig,verifyEncryptedReplica,startCoordinatedBackupScheduler} from './ops/coordinated-backup-scheduler.js';
test('R2 replica is opt-in, EU-only and does not replace primary configuration',()=>{
 const env={BACKUP_R2_ENABLED:'true',BACKUP_R2_ACCESS_KEY_ID:'synthetic-id',BACKUP_R2_SECRET_ACCESS_KEY:'synthetic-secret',BACKUP_R2_BUCKET:'rentinorbit-backups-eu',BACKUP_R2_ENDPOINT:'https://'+'a'.repeat(32)+'.eu.r2.cloudflarestorage.com',BACKUP_S3_BUCKET:'primary'};
 assert.equal(r2BackupConfig({...env,BACKUP_R2_ENABLED:'false'}),null);
 const result=r2BackupConfig(env);assert.equal(result.BACKUP_S3_BUCKET,'rentinorbit-backups-eu');assert.equal(result.BACKUP_S3_REGION,'auto');assert.equal(env.BACKUP_S3_BUCKET,'primary');
 for(const endpoint of [env.BACKUP_R2_ENDPOINT.replace('.eu.','.'),env.BACKUP_R2_ENDPOINT+'/bucket',env.BACKUP_R2_ENDPOINT.replace('https:','http:'),env.BACKUP_R2_ENDPOINT+'?x=1'])assert.throws(()=>r2BackupConfig({...env,BACKUP_R2_ENDPOINT:endpoint}),/BACKUP_R2_EU_ENDPOINT_REQUIRED/);
 assert.throws(()=>r2BackupConfig({...env,BACKUP_R2_BUCKET:'other'}));assert.throws(()=>r2BackupConfig({...env,BACKUP_R2_SECRET_ACCESS_KEY:''}));
 assert.equal(startCoordinatedBackupScheduler({env:{...env,ENCRYPTED_BACKUP_SCHEDULER_ENABLED:'false'}}),null);
});
test('replica requires downloaded bytes to match encrypted source hash',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rio-r2-replica-'));
 try{
 const bytes=Buffer.from('synthetic encrypted bytes'),output=path.join(root,'source.enc');fs.writeFileSync(output,bytes);
 const proof={bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
 let stored;const calls=[];
 const client={async send(command){calls.push(command.constructor.name);if(command.constructor.name==='PutObjectCommand'){const chunks=[];for await(const chunk of command.input.Body)chunks.push(chunk);stored=Buffer.concat(chunks);return {};}return {Body:Readable.from([stored])};}};
 await verifyEncryptedReplica({client,bucket:'synthetic',objectKey:'bundles-v1/test.enc',output,downloaded:path.join(root,'verified.enc'),proof});
 assert.deepEqual(calls,['PutObjectCommand','GetObjectCommand']);assert.deepEqual(stored,bytes);
 const tampered={async send(command){if(command.constructor.name==='PutObjectCommand'){for await(const chunk of command.input.Body){}return {};}const wrong=Buffer.from(bytes);wrong[0]^=1;return {Body:Readable.from([wrong])};}};
 await assert.rejects(verifyEncryptedReplica({client:tampered,bucket:'synthetic',objectKey:'bundles-v1/test.enc',output,downloaded:path.join(root,'tampered.enc'),proof}),/ENCRYPTED_BACKUP_DOWNLOAD_HASH_MISMATCH/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
