import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
const dbPath=path.resolve(process.env.RENTALL_DB_PATH||process.env.DB_PATH||'rentall.sqlite');
const backupDir=path.resolve(process.env.BACKUP_DIR||path.join(path.dirname(dbPath),'backups'));
if(!fs.existsSync(dbPath))throw new Error(`Database not found: ${dbPath}`);
fs.mkdirSync(backupDir,{recursive:true});
const stamp=new Date().toISOString().replace(/[:.]/g,'-'),output=path.join(backupDir,`rentall-${stamp}.db`);
const source=new Database(dbPath,{readonly:true,fileMustExist:true});try{await source.backup(output);}finally{source.close();}
const verify=new Database(output,{readonly:true,fileMustExist:true});let integrity;try{integrity=verify.pragma('integrity_check',{simple:true});}finally{verify.close();}
if(String(integrity).toLowerCase()!=='ok')throw new Error(`SQLite integrity_check failed: ${integrity}`);
const stat=fs.statSync(output),evidence={ok:true,verifiedAt:new Date().toISOString(),backupFile:path.basename(output),bytes:stat.size,integrity:'ok'};
fs.writeFileSync(path.join(backupDir,'last-verified-backup.json'),JSON.stringify(evidence,null,2));
console.log(JSON.stringify({ok:true,backup:output,bytes:stat.size,integrity:'ok'}));
