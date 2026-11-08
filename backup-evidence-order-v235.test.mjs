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
 db.exec('CREATE TABLE source_records (value TEXT); INSERT INTO source_records(value) VALUES (\'safe-backup\'); CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY); INSERT INTO schema_migrations(version) VALUES(1)');
 db.close();
 const env={...process.env,RENTINORBIT_DB_PATH:dbPath,DB_PATH:dbPath,BACKUP_DIR:backupDir,DB_BACKUP_EVIDENCE_PATH:path.join(backupDir,'last-verified-backup.json'),BACKUP_S3_ENABLED:'false'};
 const ok=spawnSync(process.execPath,['ops/backup-and-verify.js'],{env,encoding:'utf8',timeout:15000});
 assert.equal(ok.status,0,'Local backup must succeed: '+ok.stderr);
 const evidencePath=path.join(backupDir,'last-verified-backup.json');
 const evidence=JSON.parse(fs.readFileSync(evidencePath,'utf8'));
 assert.equal(evidence.integrity,'ok');
 assert.ok(fs.existsSync(path.join(backupDir,evidence.backupFile)));
 // Verify the remote/local backup restore path resolves alongside the source database
 // when BACKUP_DIR is omitted (the production scripts must agree).
 const defaultBackupEnv={...env};
 delete defaultBackupEnv.BACKUP_DIR;
 const defaultBackup=spawnSync(process.execPath,['ops/backup-and-verify.js'],{env:defaultBackupEnv,encoding:'utf8',timeout:15000});
 assert.equal(defaultBackup.status,0,'Default-path backup must succeed: '+defaultBackup.stderr);
 const defaultRestore=spawnSync(process.execPath,['ops/test-backup-restore.js'],{env:defaultBackupEnv,encoding:'utf8',timeout:15000});
 assert.equal(defaultRestore.status,0,'Default-path restore must succeed: '+defaultRestore.stderr);
 const restored=JSON.parse(defaultRestore.stdout.trim().split('\n').at(-1));
 assert.equal(restored.integrity,'ok');
 assert.equal(restored.migrationVersion,1);
 // A failed remote upload must never replace an earlier verified checkpoint.
 const oldEvidence=fs.readFileSync(evidencePath,'utf8');
 const failingEnv={...env,BACKUP_S3_ENABLED:'true',BACKUP_S3_ACCESS_KEY_ID:'',BACKUP_S3_SECRET_ACCESS_KEY:'',BACKUP_S3_BUCKET:'',BACKUP_S3_ENDPOINT:'',BACKUP_S3_REGION:''};
 const failure=spawnSync(process.execPath,['ops/backup-and-verify.js'],{env:failingEnv,encoding:'utf8',timeout:15000});
 assert.notEqual(failure.status,0,'Incomplete remote configuration must fail');
 assert.equal(fs.readFileSync(evidencePath,'utf8'),oldEvidence,'Old verified evidence must remain unchanged on S3 failure');
 console.log('PASS isolated SQLite backup and failure-safe evidence publication');
}finally{fs.rmSync(root,{recursive:true,force:true})}
