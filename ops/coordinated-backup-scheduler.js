import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';
import {ListObjectsV2Command,DeleteObjectsCommand} from '@aws-sdk/client-s3';
import {createBackupS3,uploadBackupObject,downloadBackupObject} from './backup-s3.js';
import {sha256File} from '../modules/encrypted-backup-bundle.js';
import {coordinatedEncryptedBackup} from '../modules/coordinated-encrypted-backup.js';
export const encryptedBackupReviewSettings=Object.freeze({enabled:false,intervalHours:6,maxCopies:28,maxAgeDays:7,prefix:'bundles-v1/'});
export function selectExpiredBundles(objects,now=Date.now()){
 const sorted=objects.filter(x=>/^bundles-v1\/\d{4}-\d{2}-\d{2}T[0-9-]+Z-[0-9a-f]+\.enc$/.test(x.Key||'')&&Number.isFinite(new Date(x.LastModified).getTime())).sort((a,b)=>new Date(b.LastModified)-new Date(a.LastModified)||b.Key.localeCompare(a.Key));
 return sorted.filter((x,i)=>i>=28||now-new Date(x.LastModified).getTime()>7*86400000).map(x=>({Key:x.Key}));
}
async function prune(client,bucket){let token;const objects=[];do{const p=await client.send(new ListObjectsV2Command({Bucket:bucket,Prefix:'bundles-v1/',...(token?{ContinuationToken:token}:{})}));objects.push(...p.Contents||[]);if(p.IsTruncated&&!p.NextContinuationToken)throw Error('ENCRYPTED_RETENTION_LIST_INCOMPLETE');token=p.IsTruncated?p.NextContinuationToken:null;}while(token);
 const stale=selectExpiredBundles(objects);for(let i=0;i<stale.length;i+=1000){const r=await client.send(new DeleteObjectsCommand({Bucket:bucket,Delete:{Objects:stale.slice(i,i+1000)}}));if(r.Errors?.length)throw Error('ENCRYPTED_RETENTION_DELETE_FAILED');}return stale.length;
}
export function startCoordinatedBackupScheduler({coordinator,db,uploads,env=process.env}){
 if(env.ENCRYPTED_BACKUP_SCHEDULER_ENABLED!=='true')return null;
 if(env.ENCRYPTED_BACKUP_SINGLE_WRITER_CONFIRMED!=='true'||env.BACKUP_SCHEDULER_ENABLED==='true'||env.PRIVATE_TEST_ENABLED==='true')throw Error('ENCRYPTED_BACKUP_SINGLE_WRITER_REQUIRED');
 const publicKey=env.ENCRYPTED_BACKUP_PUBLIC_KEY_PEM;if(!publicKey||/PRIVATE KEY/.test(publicKey))throw Error('ENCRYPTED_BACKUP_PUBLIC_KEY_ONLY');
 const key=crypto.createPublicKey(publicKey);if(key.asymmetricKeyType!=='rsa'||key.asymmetricKeyDetails.modulusLength<3072)throw Error('ENCRYPTED_BACKUP_RSA_3072_REQUIRED');
 let running=false,stopped=false;const {client,bucket}=createBackupS3(env);
 const run=async()=>{if(running||stopped)return {skipped:true};running=true;let root;
  try{root=fs.mkdtempSync(path.join(os.tmpdir(),'rio-coordinated-'));const output=path.join(root,'bundle.enc');const proof=await coordinatedEncryptedBackup({coordinator,db,uploads,output,publicKey});
   // The read/write pause ends before upload and retention; local bundle is immutable.
   const objectKey='bundles-v1/'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(8).toString('hex')+'.enc';
   await uploadBackupObject(client,bucket,objectKey,output,'application/octet-stream');
   const downloaded=path.join(root,'downloaded.enc');await downloadBackupObject(client,bucket,objectKey,downloaded);
   if(fs.statSync(downloaded).size!==proof.bytes||await sha256File(downloaded)!==proof.sha256)throw Error('ENCRYPTED_BACKUP_DOWNLOAD_HASH_MISMATCH');
   const deleted=await prune(client,bucket);return {ok:true,objectKey,...proof,deleted};
  }finally{try{if(root)fs.rmSync(root,{recursive:true,force:true});}finally{running=false;if(stopped)client.destroy();}}
 };
 const tick=()=>run().then(r=>console.log(JSON.stringify({type:'coordinated_encrypted_backup',...r,output:undefined}))).catch(e=>console.error(JSON.stringify({type:'coordinated_encrypted_backup',ok:false,code:e.code||'BACKUP_FAILED'})));
 // No immediate/startup run: first interval is six hours after explicit activation.
 const timer=setInterval(tick,6*3600000);timer.unref?.();return {run,stop(){stopped=true;clearInterval(timer);if(!running)client.destroy();}};
}
