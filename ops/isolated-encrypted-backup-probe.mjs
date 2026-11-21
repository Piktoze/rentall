// One-shot staging build probe. NEVER imports the deployed DB or reads /data.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';import Database from 'better-sqlite3';
import {DeleteObjectCommand} from '@aws-sdk/client-s3';
import {createBackupS3,uploadBackupObject,downloadBackupObject} from './backup-s3.js';
import {createEncryptedBundle,restoreEncryptedBundle,sha256File} from '../modules/encrypted-backup-bundle.js';
const run=process.env.RENTINORBIT_ENCRYPTED_BACKUP_PROBE_RUN_ID;
if(!/^[a-f0-9]{32}$/.test(run||'')||process.env.RENTINORBIT_STAGING!=='true'||process.env.STRIPE_MODE!=='test'||process.env.RAILWAY_ENVIRONMENT_ID!=='ca5aa000-83a9-40b9-b9b6-74b3602f3dde')throw Error('ISOLATED_BACKUP_PROBE_STAGING_ONLY');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'rio-bucket-probe-')),source=path.join(root,'source.sqlite'),uploads=path.join(root,'uploads');let db,client,bucket,uploaded=false,removed=false;
const objectKey='isolated-probes/backup/'+run+'/bundle.enc';
try{
 const env={...process.env,NODE_ENV:'test',PRIVATE_TEST_ENABLED:'false',PRIVATE_TEST_REQUIRED:'false',DB_PATH:source,UPLOADS_DIR:uploads,DATABASE_URL:'',RENTINORBIT_DB_PATH:'',RAILWAY_VOLUME_MOUNT_PATH:'',PERSISTENT_DATA_DIR:'',RAILWAY_ENVIRONMENT_ID:'',RAILWAY_PROJECT_ID:'',RAILWAY_SERVICE_ID:'',DB_BACKUP_ENABLED:'false',BACKUP_SCHEDULER_ENABLED:'false',BACKUP_S3_ENABLED:'false',EMAIL_PROVIDER:'disabled',EMAIL_WORKER_ENABLED:'false',NODE_OPTIONS:''};
 const init=spawnSync(process.execPath,['--input-type=module','-e',"const d=await import('./db.js');d.createAppUser({email:'isolated-backup@example.test',password:'SyntheticBackup123!',role:'customer'});d.closeDatabase();"],{env,encoding:'utf8',timeout:30000});
 if(init.status!==0)throw Error('ISOLATED_SCHEMA_INIT_FAILED');
 fs.mkdirSync(uploads,{recursive:true,mode:0o700});const photo=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGZkAAAAASUVORK5CYII=','base64');fs.writeFileSync(path.join(uploads,'synthetic.png'),photo);
 db=new Database(source,{readonly:true});
 const keys=crypto.generateKeyPairSync('rsa',{modulusLength:3072}),bundle=path.join(root,'bundle.enc');
 const encrypted=await createEncryptedBundle({db,uploads,output:bundle,publicKey:keys.publicKey,quiesced:true});db.close();db=null;
 ({client,bucket}=createBackupS3(process.env));await uploadBackupObject(client,bucket,objectKey,bundle,'application/octet-stream');uploaded=true;
 const downloaded=path.join(root,'downloaded.enc');await downloadBackupObject(client,bucket,objectKey,downloaded);
 if(await sha256File(downloaded)!==encrypted.sha256)throw Error('BUCKET_DOWNLOAD_HASH_MISMATCH');
 const restored=path.join(root,'restored');await restoreEncryptedBundle({bundle:downloaded,privateKey:keys.privateKey,target:restored});
 const verified=new Database(path.join(restored,'database.sqlite'),{readonly:true});const integrity=verified.pragma('integrity_check',{simple:true});
 if(integrity!=='ok'||verified.prepare('SELECT count(*) n FROM app_users WHERE email=?').get('isolated-backup@example.test').n!==1)throw Error('RESTORE_CANONICAL_DB_MISMATCH');verified.close();
 if(!fs.readFileSync(path.join(restored,'uploads','synthetic.png')).equals(photo))throw Error('RESTORE_PHOTO_MISMATCH');
 await client.send(new DeleteObjectCommand({Bucket:bucket,Key:objectKey}));removed=true;
 console.log(JSON.stringify({type:'isolated_encrypted_backup_probe',runId:run,status:'PASS',bucket,objectKey,encryptedBytes:encrypted.bytes,encryptedSha256:encrypted.sha256,canonicalDatabase:true,sqliteIntegrity:integrity,photoHashVerified:true,manifestVerified:true,downloadVerified:true,privateKeyPublished:false,probeObjectRemoved:removed,existingDataTouched:false}));
}catch(error){console.error(JSON.stringify({type:'isolated_encrypted_backup_probe',runId:run,status:'FAIL',code:/^[A-Z0-9_]+$/.test(error.message||'')?error.message:String(error.name||'PROVIDER_ERROR')}));process.exitCode=1;
}finally{
 if(db?.open)db.close();if(uploaded&&!removed&&client){try{await client.send(new DeleteObjectCommand({Bucket:bucket,Key:objectKey}));}catch{}}
 client?.destroy();fs.rmSync(root,{recursive:true,force:true});
}
