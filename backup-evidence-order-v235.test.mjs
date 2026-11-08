import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import Database from 'better-sqlite3';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'rentinorbit-backup-evidence-'));
try{
 const dbPath=path.join(root,'test.sqlite');
 const backupDir=path.join(root,'backups');
 const db=new Database(dbPath);
 db.exec('CREATE TABLE source_records (value TEXT); INSERT INTO source_records(value) VALUES (\'safe-backup\')');
 db.close();
 const env={...process.env,RENTINORBIT_DB_PATH:dbPath,DB_PATH:dbPath,BACKUP_DIR:backupDir,BACKUP_S3_ENABLED:'false'};
 const ok=spawnSync(process.execPath,['ops/backup-and-verify.js'],{env,encoding:'utf8',timeout:15000});
 assert.equal(ok.status,0,'Local backup must succeed: '+ok.stderr);
 const evidencePath=path.join(backupDir,'last-verified-backup.json');
 const evidence=JSON.parse(fs.readFileSync(evidencePath,'utf8'));
 assert.equal(evidence.integrity,'ok');
 assert.ok(fs.existsSync(path.join(backupDir,evidence.backupFile)));
 // A failed remote upload must never replace an earlier verified checkpoint.
 const oldEvidence=fs.readFileSync(evidencePath,'utf8');
 const failingEnv={...env,BACKUP_S3_ENABLED:'true',BACKUP_S3_ACCESS_KEY_ID:'',BACKUP_S3_SECRET_ACCESS_KEY:'',BACKUP_S3_BUCKET:'',BACKUP_S3_ENDPOINT:'',BACKUP_S3_REGION:''};
 const failure=spawnSync(process.execPath,['ops/backup-and-verify.js'],{env:failingEnv,encoding:'utf8',timeout:15000});
 assert.notEqual(failure.status,0,'Incomplete remote configuration must fail');
 assert.equal(fs.readFileSync(evidencePath,'utf8'),oldEvidence,'Old verified evidence must remain unchanged on S3 failure');
 console.log('PASS isolated SQLite backup and failure-safe evidence publication');
}finally{fs.rmSync(root,{recursive:true,force:true})}
