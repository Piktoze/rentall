import {spawn} from 'node:child_process';
import path from 'node:path';
import {resolveDatabaseConfig} from '../config.js';

let running=false;
let timer=null;

function backupPaths(){
  const dbConfig=resolveDatabaseConfig();
  if(!dbConfig.ok || !dbConfig.path || dbConfig.path===':memory:') throw new Error('Cannot resolve persistent SQLite database for backup');
  const dbPath=path.resolve(dbConfig.path);
  const backupDir=path.resolve(process.env.BACKUP_DIR||path.join(path.dirname(dbPath),'backups'));
  return {dbPath,backupDir};
}

export function assertSeparateBackupPath(){
  const {dbPath,backupDir}=backupPaths();
  const databaseDir=path.dirname(dbPath);
  const remoteEnabled=String(process.env.BACKUP_S3_ENABLED||'').toLowerCase()==='true';
  // In Railway, the durable backup is in S3. The local directory is only
  // temporary staging space, even when it is under the database volume.
  if(process.env.RAILWAY_ENVIRONMENT_ID && !remoteEnabled){
    const error=new Error('Railway backups require separate S3-compatible storage');
    error.code='BACKUP_REMOTE_STORAGE_REQUIRED';
    throw error;
  }
  // Without remote storage, a local copy within the database directory is
  // not an independent backup and must never be accepted by the scheduler.
  if(!remoteEnabled && (backupDir===databaseDir || backupDir.startsWith(databaseDir+path.sep))){
    const error=new Error('BACKUP_DIR must be on storage separate from the primary database directory');
    error.code='BACKUP_STORAGE_NOT_SEPARATE';
    throw error;
  }
  return {dbPath,backupDir};
}

export async function runScheduledBackup(){
  if(running) return {ok:false,skipped:'already_running'};
  const paths=assertSeparateBackupPath();
  running=true;
  try{
    const result=await new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,['ops/backup-and-verify.js'],{
        cwd:path.resolve('.'),
        env:process.env,
        stdio:['ignore','pipe','pipe']
      });
      let stdout='',stderr='';
      child.stdout.on('data',chunk=>{stdout+=chunk});
      child.stderr.on('data',chunk=>{stderr+=chunk});
      child.on('error',reject);
      child.on('close',code=>{
        if(code!==0) return reject(new Error(`Backup process failed (${code}): ${stderr.trim().slice(-500)}`));
        try{resolve(JSON.parse(stdout.trim().split('\n').at(-1)))}catch(error){reject(error)}
      });
    });
    // Prove remote backup can actually be downloaded and opened; never replace live /data.
    const restore=await new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,['ops/test-backup-restore.js'],{
        cwd:path.resolve('.'),env:process.env,stdio:['ignore','pipe','pipe']
      });
      let stdout='',stderr='';
      child.stdout.on('data',chunk=>{stdout+=chunk});
      child.stderr.on('data',chunk=>{stderr+=chunk});
      child.on('error',reject);
      child.on('close',code=>{
        if(code!==0) return reject(new Error(`Backup restore verification failed (${code}): ${stderr.trim().slice(-500)}`));
        try {
          const verified=JSON.parse(stdout.trim().split('\n').at(-1));
          if(!verified.ok||verified.integrity!=='ok'||verified.bytes!==result.bytes) throw new Error('Backup restore verification incomplete');
          resolve(verified);
        } catch(error){reject(error)}
      });
    });
    console.log(JSON.stringify({type:'database_backup_restore_check',ok:true,storage:restore.storage,bytes:restore.bytes,integrity:restore.integrity,tableCount:restore.tableCount,migrationVersion:restore.migrationVersion}));
    console.log(JSON.stringify({type:'database_backup',ok:true,backupDir:paths.backupDir,bytes:result.bytes,integrity:result.integrity,restoreVerified:true}));
    return {...result,restoreVerified:true};
  }finally{
    running=false;
  }
}

export function startBackupScheduler(){
  if(timer) return timer;
  assertSeparateBackupPath();
  const hours=Math.max(1,Math.min(24,Number(process.env.BACKUP_INTERVAL_HOURS)||6));
  const intervalMs=hours*60*60*1000;
  const first=setTimeout(()=>runScheduledBackup().catch(error=>console.error(JSON.stringify({type:'database_backup',ok:false,code:error.code||'BACKUP_FAILED',message:error.message}))),5000);
  first.unref?.();
  timer=setInterval(()=>runScheduledBackup().catch(error=>console.error(JSON.stringify({type:'database_backup',ok:false,code:error.code||'BACKUP_FAILED',message:error.message}))),intervalMs);
  timer.unref?.();
  console.log(JSON.stringify({type:'database_backup_scheduler',enabled:true,intervalHours:hours}));
  return timer;
}
