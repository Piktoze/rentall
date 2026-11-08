import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import {createBackupS3,downloadBackupObject,readBackupEvidence,s3BackupEnabled} from './backup-s3.js';

const dbPath=path.resolve(process.env.RENTINORBIT_DB_PATH||process.env.DB_PATH||'rentinorbit.sqlite');
const backupDir=path.resolve(process.env.BACKUP_DIR||path.join(path.dirname(dbPath),'backups'));
const evidencePath=path.resolve(process.env.DB_BACKUP_EVIDENCE_PATH||path.join(backupDir,'last-verified-backup.json'));
const remote=s3BackupEnabled();
const s3=remote?createBackupS3():null;
const evidence=fs.existsSync(evidencePath)
  ?JSON.parse(fs.readFileSync(evidencePath,'utf8'))
  :await readBackupEvidence(s3.client,s3.bucket,'metadata/last-verified-backup.json');
if(!evidence.ok || evidence.integrity!=='ok') throw new Error('Latest backup evidence is not verified');
const source=path.join(backupDir,path.basename(String(evidence.backupFile||'')));
const restoreDir=fs.mkdtempSync(path.join(os.tmpdir(),'rentinorbit-restore-test-'));
const restored=path.join(restoreDir,'restored.sqlite');
try {
  if(remote) await downloadBackupObject(s3.client,s3.bucket,String(evidence.backupKey||''),restored);
  else {
    if(!fs.existsSync(source)) throw new Error('Verified backup file is missing');
    fs.copyFileSync(source,restored,fs.constants.COPYFILE_EXCL);
  }
  const sourceBytes=Number(evidence.bytes);
  const restoredBytes=fs.statSync(restored).size;
  if(!Number.isSafeInteger(sourceBytes)||sourceBytes<=0||restoredBytes!==sourceBytes) {
    throw new Error(`Restored backup size mismatch: expected ${sourceBytes}, received ${restoredBytes}`);
  }
  const db=new Database(restored,{readonly:true,fileMustExist:true});
  let integrity,tableCount,migrationVersion;
  try {
    integrity=db.pragma('integrity_check',{simple:true});
    tableCount=db.prepare("SELECT COUNT(*) count FROM sqlite_master WHERE type='table'").get().count;
    migrationVersion=db.prepare("SELECT COALESCE(MAX(version),0) version FROM schema_migrations").get().version;
  } finally {db.close()}
  if(String(integrity).toLowerCase()!=='ok'||tableCount<1||migrationVersion<1) {
    throw new Error(`Restored SQLite invalid: integrity=${integrity}, tables=${tableCount}, migration=${migrationVersion}`);
  }
  console.log(JSON.stringify({ok:true,source:remote?evidence.backupKey:path.basename(source),storage:remote?'s3':'filesystem',bytes:restoredBytes,integrity:'ok',tableCount,migrationVersion,verifiedAt:new Date().toISOString()}));
} finally {
  fs.rmSync(restoreDir,{recursive:true,force:true});
}
