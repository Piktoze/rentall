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
