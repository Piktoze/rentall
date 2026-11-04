import {spawn} from 'node:child_process';
import path from 'node:path';

let running=false;
let timer=null;

function backupPaths(){
  const dbPath=path.resolve(process.env.RENTINORBIT_DB_PATH||process.env.DB_PATH||'rentinorbit.sqlite');
  const backupDir=path.resolve(process.env.BACKUP_DIR||path.join(path.dirname(dbPath),'backups'));
  return {dbPath,backupDir};
}

function assertSeparateBackupPath(){
  const {dbPath,backupDir}=backupPaths();
  const databaseDir=path.dirname(dbPath);
  if(backupDir===databaseDir || backupDir.startsWith(databaseDir+path.sep)){
    const error=new Error('BACKUP_DIR must be on storage separate from the primary database directory');
    error.code='BACKUP_STORAGE_NOT_SEPARATE';
    throw error;
  }
  if(process.env.RAILWAY_ENVIRONMENT_ID && String(process.env.BACKUP_S3_ENABLED||'').toLowerCase()!=='true'){
    const error=new Error('Railway backups require separate S3-compatible storage');
    error.code='BACKUP_REMOTE_STORAGE_REQUIRED';
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
    console.log(JSON.stringify({type:'database_backup',ok:true,backupDir:paths.backupDir,bytes:result.bytes,integrity:result.integrity}));
    return result;
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
