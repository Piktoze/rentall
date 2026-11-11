import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {resolveDatabaseConfig} from '../config.js';
import Database from 'better-sqlite3';
import {createBackupS3,pruneBackupObjects,s3BackupEnabled,uploadBackupObject} from './backup-s3.js';
const dbConfig=resolveDatabaseConfig();
if(!dbConfig.ok || !dbConfig.path || dbConfig.path===':memory:') throw new Error('Cannot resolve persistent SQLite database for backup');
const dbPath=path.resolve(dbConfig.path);
const backupDir=path.resolve(process.env.BACKUP_DIR||path.join(path.dirname(dbPath),'backups'));
if(!fs.existsSync(dbPath))throw new Error(`Database not found: ${dbPath}`);
fs.mkdirSync(backupDir,{recursive:true});
const stamp=new Date().toISOString().replace(/[:.]/g,'-'),output=path.join(backupDir,`rentinorbit-${stamp}.db`);
const source=new Database(dbPath,{readonly:true,fileMustExist:true});try{await source.backup(output);}finally{source.close();}
const verify=new Database(output,{readonly:true,fileMustExist:true});let integrity;try{integrity=verify.pragma('integrity_check',{simple:true});}finally{verify.close();}
if(String(integrity).toLowerCase()!=='ok')throw new Error(`SQLite integrity_check failed: ${integrity}`);
const stat=fs.statSync(output),backupFile=path.basename(output),backupKey=`sqlite/${backupFile}`;
const sha256=crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex');
const evidence={ok:true,verifiedAt:new Date().toISOString(),backupFile,backupKey,bytes:stat.size,sha256,integrity:'ok',storage:s3BackupEnabled()?'s3':'filesystem'};
// Publish verified evidence only AFTER the remote backup and its metadata succeed.
// A failed S3 upload must leave the previous verified evidence untouched.
const evidencePath=path.resolve(process.env.DB_BACKUP_EVIDENCE_PATH||path.join(backupDir,'last-verified-backup.json'));
fs.mkdirSync(path.dirname(evidencePath),{recursive:true});
const tempEvidencePath=path.join(path.dirname(evidencePath),`last-verified-backup-${process.pid}-${stamp}.tmp`);
const retention=Math.max(2,Math.min(365,Number(process.env.BACKUP_RETENTION_COUNT)||28));
const backups=fs.readdirSync(backupDir)
  .filter(name=>/^rentinorbit-.*\.db$/.test(name))
  .map(name=>({name,mtime:fs.statSync(path.join(backupDir,name)).mtimeMs}))
  .sort((a,b)=>b.mtime-a.mtime);
for(const stale of backups.slice(retention)) fs.unlinkSync(path.join(backupDir,stale.name));
let remote=null;
if(s3BackupEnabled()){
  const {client,bucket}=createBackupS3();
  await uploadBackupObject(client,bucket,backupKey,output,'application/vnd.sqlite3');
  // Never prune a backup referenced by the last verified pointer before
  // the replacement pointer has been durably published. A failed metadata
  // upload must leave the previous backup and evidence recoverable.
  fs.writeFileSync(tempEvidencePath,JSON.stringify(evidence,null,2),{flag:'wx'});
  try {
    await uploadBackupObject(client,bucket,'metadata/last-verified-backup.json',tempEvidencePath,'application/json');
    fs.renameSync(tempEvidencePath,evidencePath);
  } finally {
    if(fs.existsSync(tempEvidencePath))fs.unlinkSync(tempEvidencePath);
  }
  // Retention is best-effort housekeeping after the new verified pointer exists.
  // Do not report the backup as failed if pruning is temporarily unavailable.
  try{
    remote=await pruneBackupObjects(client,bucket,'sqlite/',retention,{protectedKeys:[backupKey]});
  }catch(error){
    console.warn(JSON.stringify({type:'backup_retention',ok:false,code:String(error?.code||'PRUNE_FAILED')}));
  }
  fs.unlinkSync(output);
}else{
  fs.writeFileSync(tempEvidencePath,JSON.stringify(evidence,null,2),{flag:'wx'});
  fs.renameSync(tempEvidencePath,evidencePath);
}
console.log(JSON.stringify({ok:true,backup:backupFile,backupKey,storage:evidence.storage,bytes:stat.size,sha256,integrity:'ok',retention,retained:remote?Math.min(remote.listed,retention):Math.min(backups.length,retention)}));
