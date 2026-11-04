import fs from 'node:fs';
import {DeleteObjectsCommand,GetObjectCommand,ListObjectsV2Command,PutObjectCommand,S3Client} from '@aws-sdk/client-s3';

export function s3BackupEnabled(env=process.env){
  return String(env.BACKUP_S3_ENABLED||'').toLowerCase()==='true';
}

export function createBackupS3(env=process.env){
  const required=['BACKUP_S3_ACCESS_KEY_ID','BACKUP_S3_SECRET_ACCESS_KEY','BACKUP_S3_BUCKET','BACKUP_S3_ENDPOINT','BACKUP_S3_REGION'];
  const missing=required.filter(key=>!env[key]);
  if(missing.length) throw new Error(`Missing backup bucket configuration: ${missing.join(', ')}`);
  return {
    bucket:env.BACKUP_S3_BUCKET,
    client:new S3Client({
      region:env.BACKUP_S3_REGION,
      endpoint:env.BACKUP_S3_ENDPOINT,
      forcePathStyle:String(env.BACKUP_S3_URL_STYLE||'path').toLowerCase()==='path',
      credentials:{accessKeyId:env.BACKUP_S3_ACCESS_KEY_ID,secretAccessKey:env.BACKUP_S3_SECRET_ACCESS_KEY}
    })
  };
}

export async function uploadBackupObject(client,bucket,key,filePath,contentType){
  await client.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:fs.createReadStream(filePath),ContentType:contentType}));
}

export async function downloadBackupObject(client,bucket,key,filePath){
  const response=await client.send(new GetObjectCommand({Bucket:bucket,Key:key}));
  const bytes=await response.Body.transformToByteArray();
  fs.writeFileSync(filePath,bytes,{flag:'wx'});
}

export async function pruneBackupObjects(client,bucket,prefix,retention){
  const listed=await client.send(new ListObjectsV2Command({Bucket:bucket,Prefix:prefix}));
  const stale=(listed.Contents||[])
    .filter(object=>object.Key?.endsWith('.db'))
    .sort((a,b)=>new Date(b.LastModified||0)-new Date(a.LastModified||0))
    .slice(retention)
    .map(object=>({Key:object.Key}));
  if(stale.length) await client.send(new DeleteObjectsCommand({Bucket:bucket,Delete:{Objects:stale,Quiet:true}}));
  return {listed:(listed.Contents||[]).filter(object=>object.Key?.endsWith('.db')).length,deleted:stale.length};
}

export async function readBackupEvidence(client,bucket,key){
  const response=await client.send(new GetObjectCommand({Bucket:bucket,Key:key}));
  return JSON.parse(await response.Body.transformToString());
}
