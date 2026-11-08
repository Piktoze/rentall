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
 assert.match(evidence.sha256,/^[a-f0-9]{64}$/);
 // A different SQLite file can have identical byte length and pass SQLite integrity.
 // It must still fail restoration against the original backup hash.
 const alteredFile=path.join(backupDir,evidence.backupFile);
 const alteredDb=new Database(alteredFile);
 alteredDb.exec("UPDATE source_records SET value='different!!' WHERE value='safe-backup'");
 alteredDb.close();
 const alteredRestore=spawnSync(process.execPath,['ops/test-backup-restore.js'],{env,encoding:'utf8',timeout:15000});
 assert.notEqual(alteredRestore.status,0,'Modified backup must fail restore integrity fingerprint');
 assert.match(alteredRestore.stderr,/SHA-256 mismatch/);

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
 // The server's configured DB_BACKUP_EVIDENCE_PATH must also be where the
 // backup command publishes evidence, including when outside BACKUP_DIR.
 const customEvidence=path.join(root,'ops-evidence','latest.json');
 const customEnv={...env,DB_BACKUP_EVIDENCE_PATH:customEvidence};
 const customBackup=spawnSync(process.execPath,['ops/backup-and-verify.js'],{env:customEnv,encoding:'utf8',timeout:15000});
 assert.equal(customBackup.status,0,'Custom evidence backup must succeed: '+customBackup.stderr);
 assert.ok(fs.existsSync(customEvidence),'Custom backup evidence must be written at configured path');
 const customRestore=spawnSync(process.execPath,['ops/test-backup-restore.js'],{env:customEnv,encoding:'utf8',timeout:15000});
 assert.equal(customRestore.status,0,'Custom evidence restore must succeed: '+customRestore.stderr);
 const customRestored=JSON.parse(customRestore.stdout.trim().split('\n').at(-1));
 assert.equal(customRestored.integrity,'ok');
 // Real deployments may resolve DB through RAILWAY_VOLUME_MOUNT_PATH alone.
 // Backups and restore must use that same database, never a working-directory DB.
 const volumeRoot=path.join(root,'volume');
 fs.mkdirSync(volumeRoot);
 fs.copyFileSync(dbPath,path.join(volumeRoot,'rentinorbit.sqlite'));
 const volumeEnv={...env,RAILWAY_VOLUME_MOUNT_PATH:volumeRoot};
 for(const key of ['RENTINORBIT_DB_PATH','RENTALL_DB_PATH','DB_PATH','DATABASE_URL','PERSISTENT_DATA_DIR','BACKUP_DIR','DB_BACKUP_EVIDENCE_PATH'])delete volumeEnv[key];
 const volumeBackup=spawnSync(process.execPath,['ops/backup-and-verify.js'],{env:volumeEnv,encoding:'utf8',timeout:15000});
 assert.equal(volumeBackup.status,0,'Volume-path backup must succeed: '+volumeBackup.stderr);
 const volumeEvidence=path.join(volumeRoot,'backups','last-verified-backup.json');
 assert.ok(fs.existsSync(volumeEvidence),'Volume backup evidence must match application DB path');
 const volumeRestore=spawnSync(process.execPath,['ops/test-backup-restore.js'],{env:volumeEnv,encoding:'utf8',timeout:15000});
 assert.equal(volumeRestore.status,0,'Volume-path restore must succeed: '+volumeRestore.stderr);
 const verifiedVolume=JSON.parse(volumeRestore.stdout.trim().split('\n').at(-1));
 assert.equal(verifiedVolume.integrity,'ok');
 assert.equal(verifiedVolume.migrationVersion,1);
 // A failed remote upload must never replace an earlier verified checkpoint.
 // Railway S3 backup must permit a temporary staging path on the DB volume.
 // Without S3 the same path must be rejected as not independently durable.
 const schedulerProbe="import {assertSeparateBackupPath} from './ops/backup-scheduler.js';try{assertSeparateBackupPath();console.log('ALLOWED')}catch(e){console.error(e.code);process.exit(2)}";
 const stagingEnv={...volumeEnv,RAILWAY_ENVIRONMENT_ID:'staging-isolated',BACKUP_S3_ENABLED:'true'};
 const remoteProbe=spawnSync(process.execPath,['--input-type=module','-e',schedulerProbe],{env:stagingEnv,encoding:'utf8',timeout:15000});
 assert.equal(remoteProbe.status,0,'Remote S3 scheduler must accept local temporary staging folder: '+remoteProbe.stderr);
 const noRemoteProbe=spawnSync(process.execPath,['--input-type=module','-e',schedulerProbe],{env:{...stagingEnv,BACKUP_S3_ENABLED:'false'},encoding:'utf8',timeout:15000});
 assert.equal(noRemoteProbe.status,2,'Railway without remote S3 must refuse backup scheduler');
 assert.match(noRemoteProbe.stderr,/BACKUP_REMOTE_STORAGE_REQUIRED/);
 const localProbe=spawnSync(process.execPath,['--input-type=module','-e',schedulerProbe],{env:{...stagingEnv,BACKUP_S3_ENABLED:'false',RAILWAY_ENVIRONMENT_ID:''},encoding:'utf8',timeout:15000});
 assert.equal(localProbe.status,2,'Local-only backup on DB volume must be rejected');
 assert.match(localProbe.stderr,/BACKUP_STORAGE_NOT_SEPARATE/);
 // Scheduler must publish independent restore proof only for the same tested backup.
 const schedulerRoot=path.join(root,'scheduler-isolated');
 const schedulerData=path.join(schedulerRoot,'data');
 const schedulerBackup=path.join(schedulerRoot,'backup');
 fs.mkdirSync(schedulerData,{recursive:true});
 const schedulerDb=path.join(schedulerData,'test.sqlite');
 fs.copyFileSync(dbPath,schedulerDb);
 const scheduledEnv={...env,RENTINORBIT_DB_PATH:schedulerDb,DB_PATH:schedulerDb,
   BACKUP_DIR:schedulerBackup,DB_BACKUP_EVIDENCE_PATH:path.join(schedulerBackup,'last-verified-backup.json'),
   BACKUP_S3_ENABLED:'false',RAILWAY_ENVIRONMENT_ID:''};
 const scheduled=spawnSync(process.execPath,['--input-type=module','-e',
   "import {runScheduledBackup} from './ops/backup-scheduler.js';await runScheduledBackup();"],{
     env:scheduledEnv,encoding:'utf8',timeout:20000});
 assert.equal(scheduled.status,0,'Isolated scheduled backup and restore must succeed: '+scheduled.stderr);
 const uploadedProof=JSON.parse(fs.readFileSync(path.join(schedulerBackup,'last-verified-backup.json'),'utf8'));
 const restoreProof=JSON.parse(fs.readFileSync(path.join(schedulerBackup,'last-restored-backup.json'),'utf8'));
 assert.equal(restoreProof.ok,true);
 assert.equal(restoreProof.backupKey,uploadedProof.backupKey);
 assert.equal(restoreProof.backupFile,uploadedProof.backupFile);
 assert.equal(restoreProof.bytes,uploadedProof.bytes);
 assert.equal(restoreProof.sha256,uploadedProof.sha256);
 assert.match(restoreProof.sha256,/^[a-f0-9]{64}$/);
 assert.ok(Date.parse(restoreProof.restoreVerifiedAt)>=Date.parse(uploadedProof.verifiedAt));
 // The launch gate must reject evidence without corresponding restore proof.
 const serverSource=fs.readFileSync('./server.js','utf8');
 assert.ok(serverSource.includes("id:'database_backup_restore_verified'")&&
   serverSource.includes('backup.evidenceValid&&backup.restoreVerified'));
 const oldEvidence=fs.readFileSync(evidencePath,'utf8');
 const failingEnv={...env,BACKUP_S3_ENABLED:'true',BACKUP_S3_ACCESS_KEY_ID:'',BACKUP_S3_SECRET_ACCESS_KEY:'',BACKUP_S3_BUCKET:'',BACKUP_S3_ENDPOINT:'',BACKUP_S3_REGION:''};
 const failure=spawnSync(process.execPath,['ops/backup-and-verify.js'],{env:failingEnv,encoding:'utf8',timeout:15000});
 assert.notEqual(failure.status,0,'Incomplete remote configuration must fail');
 assert.equal(fs.readFileSync(evidencePath,'utf8'),oldEvidence,'Old verified evidence must remain unchanged on S3 failure');
 console.log('PASS isolated SQLite backup and failure-safe evidence publication');
}finally{fs.rmSync(root,{recursive:true,force:true})}
