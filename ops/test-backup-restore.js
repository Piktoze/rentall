import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

const backupDir=path.resolve(process.env.BACKUP_DIR||'backups');
const evidencePath=path.resolve(process.env.DB_BACKUP_EVIDENCE_PATH||path.join(backupDir,'last-verified-backup.json'));
const evidence=JSON.parse(fs.readFileSync(evidencePath,'utf8'));
if(!evidence.ok || evidence.integrity!=='ok') throw new Error('Latest backup evidence is not verified');
const source=path.join(backupDir,path.basename(String(evidence.backupFile||'')));
if(!fs.existsSync(source)) throw new Error('Verified backup file is missing');
const restoreDir=fs.mkdtempSync(path.join(os.tmpdir(),'rentinorbit-restore-test-'));
const restored=path.join(restoreDir,'restored.sqlite');
fs.copyFileSync(source,restored,fs.constants.COPYFILE_EXCL);
const db=new Database(restored,{readonly:true,fileMustExist:true});
let integrity,tableCount,migrationVersion;
try{
  integrity=db.pragma('integrity_check',{simple:true});
  tableCount=db.prepare("SELECT COUNT(*) count FROM sqlite_master WHERE type='table'").get().count;
  migrationVersion=db.prepare("SELECT COALESCE(MAX(version),0) version FROM schema_migrations").get().version;
}finally{db.close()}
if(String(integrity).toLowerCase()!=='ok') throw new Error(`Restored SQLite integrity_check failed: ${integrity}`);
console.log(JSON.stringify({ok:true,source:path.basename(source),restored,integrity:'ok',tableCount,migrationVersion}));
