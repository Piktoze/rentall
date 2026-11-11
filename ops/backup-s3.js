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

export async function pruneBackupObjects(client,bucket,prefix,retention,{protectedKeys=[]}={}){
  // S3 ListObjectsV2 returns at most 1,000 objects per page. Only prune after
  // listing ALL pages; otherwise the oldest backups may never be considered.
  const objects=[];
  let continuationToken;
  const seenTokens=new Set();
  do{
    const page=await client.send(new ListObjectsV2Command({
      Bucket:bucket,Prefix:prefix,...(continuationToken?{ContinuationToken:continuationToken}:{})
    }));
    objects.push(...(page.Contents||[]));
    if(!page.IsTruncated)break;
    const next=String(page.NextContinuationToken||'');
    if(!next||seenTokens.has(next))throw new Error('Backup listing pagination is incomplete');
    seenTokens.add(next);
    continuationToken=next;
  }while(true);
  const protectedSet=new Set(protectedKeys.map(String));
  const backups=objects.filter(object=>object.Key?.startsWith(prefix)&&object.Key.endsWith('.db'))
    .sort((a,b)=>new Date(b.LastModified||0)-new Date(a.LastModified||0));
  const retain=Math.max(2,Math.trunc(Number(retention)||2));
  const stale=backups.slice(retain)
    .filter(object=>!protectedSet.has(object.Key))
    .map(object=>({Key:object.Key}));
  // Batch deletes; S3 DeleteObjects accepts up to 1,000 keys per request.
  for(let i=0;i<stale.length;i+=1000){
    const batch=stale.slice(i,i+1000);
    const response=await client.send(new DeleteObjectsCommand({Bucket:bucket,Delete:{Objects:batch,Quiet:true}}));
    if(response.Errors?.length)throw new Error('Backup retention delete had failed keys');
  }
  return {listed:backups.length,deleted:stale.length};
}

export async function readBackupEvidence(client,bucket,key){
  const response=await client.send(new GetObjectCommand({Bucket:bucket,Key:key}));
  return JSON.parse(await response.Body.transformToString());
}

export async function loadVerifiedBackupEvidence({remote,evidencePath,client,bucket}){
  // In remote mode the bucket metadata pointer wins, even if local evidence
  // exists. Never fall back to a stale local file after an S3 failure.
  if(remote) return readBackupEvidence(client,bucket,'metadata/last-verified-backup.json');
  return JSON.parse(fs.readFileSync(evidencePath,'utf8'));
}
