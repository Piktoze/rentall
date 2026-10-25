import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const dbPath=path.resolve(process.env.RENTALL_DB_PATH||process.env.DB_PATH||'rentall.sqlite');
const backupDir=path.resolve(process.env.BACKUP_DIR||path.join(path.dirname(dbPath),'backups'));
if(!fs.existsSync(dbPath))throw new Error(`Database not found: ${dbPath}`);
fs.mkdirSync(backupDir,{recursive:true});
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const output=path.join(backupDir,`rentall-${stamp}.db`);
const db=new Database(dbPath,{readonly:true,fileMustExist:true});
try{await db.backup(output);}finally{db.close();}
const stat=fs.statSync(output);if(stat.size<100)throw new Error('Backup is empty or incomplete');
const evidence={ok:true,createdAt:new Date().toISOString(),backupFile:path.basename(output),bytes:stat.size};
fs.writeFileSync(path.join(backupDir,'last-backup.json'),JSON.stringify(evidence,null,2));
console.log(JSON.stringify({ok:true,backup:output,bytes:stat.size}));
