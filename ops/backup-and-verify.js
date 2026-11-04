import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import {createBackupS3,pruneBackupObjects,s3BackupEnabled,uploadBackupObject} from './backup-s3.js';
const dbPath=path.resolve(process.env.RENTINORBIT_DB_PATH||process.env[['RENT','ALL','_DB_PATH'].join('')]||process.env.DB_PATH||'rentinorbit.sqlite');
const backupDir=path.resolve(process.env.BACKUP_DIR||path.join(path.dirname(dbPath),'backups'));
if(!fs.existsSync(dbPath))throw new Error(`Database not found: ${dbPath}`);
fs.mkdirSync(backupDir,{recursive:true});
const stamp=new Date().toISOString().replace(/[:.]/g,'-'),output=path.join(backupDir,`rentinorbit-${stamp}.db`);
const source=new Database(dbPath,{readonly:true,fileMustExist:true});try{await source.backup(output);}finally{source.close();}
const verify=new Database(output,{readonly:true,fileMustExist:true});let integrity;try{integrity=verify.pragma('integrity_check',{simple:true});}finally{verify.close();}
if(String(integrity).toLowerCase()!=='ok')throw new Error(`SQLite integrity_check failed: ${integrity}`);
const stat=fs.statSync(output),backupFile=path.basename(output),backupKey=`sqlite/${backupFile}`;
const evidence={ok:true,verifiedAt:new Date().toISOString(),backupFile,backupKey,bytes:stat.size,integrity:'ok',storage:s3BackupEnabled()?'s3':'filesystem'};
fs.writeFileSync(path.join(backupDir,'last-verified-backup.json'),JSON.stringify(evidence,null,2));
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
  await uploadBackupObject(client,bucket,'metadata/last-verified-backup.json',path.join(backupDir,'last-verified-backup.json'),'application/json');
  remote=await pruneBackupObjects(client,bucket,'sqlite/',retention);
  fs.unlinkSync(output);
}
console.log(JSON.stringify({ok:true,backup:backupFile,backupKey,storage:evidence.storage,bytes:stat.size,integrity:'ok',retention,retained:remote?Math.min(remote.listed,retention):Math.min(backups.length,retention)}));
