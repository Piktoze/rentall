// Rehearsal only: every path is freshly allocated below OS temp, never /data.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';import Database from 'better-sqlite3';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'rio-persistent-rehearsal-'));
Object.assign(process.env,{NODE_ENV:'test',DB_PATH:path.join(root,'fresh','app.sqlite'),UPLOADS_DIR:path.join(root,'fresh','uploads'),PRIVATE_TEST_ENABLED:'false',PRIVATE_TEST_REQUIRED:'false',DB_BACKUP_ENABLED:'false',BACKUP_SCHEDULER_ENABLED:'false',BACKUP_S3_ENABLED:'false',RENTALL_SEED_DEMO_USERS:'false'});
for(const k of ['DATABASE_URL','RENTINORBIT_DB_PATH','RAILWAY_VOLUME_MOUNT_PATH','PERSISTENT_DATA_DIR','RAILWAY_ENVIRONMENT_ID','RAILWAY_PROJECT_ID','RAILWAY_SERVICE_ID'])delete process.env[k];
const d=await import('./db.js');const {resolveDatabaseConfig,resolveUploadsConfig}=await import('./config.js');
test('fresh canonical SQLite, separate uploads, close/reopen and restored copy preserve synthetic data',async()=>{
 try{
  assert.ok(d.db.name.startsWith(root+path.sep));
  d.createAppUser({email:'synthetic-rehearsal@example.test',password:'SyntheticStorage123!',role:'customer'});
  fs.mkdirSync(process.env.UPLOADS_DIR,{recursive:true});const image=Buffer.from('synthetic-file-only');const file=path.join(process.env.UPLOADS_DIR,'synthetic.bin');fs.writeFileSync(file,image);
  const hash=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const backup=path.join(root,'restored.sqlite');await d.db.backup(backup);d.closeDatabase();
  for(const filename of [process.env.DB_PATH,backup]){const reopened=new Database(filename,{readonly:true});
   assert.equal(reopened.pragma('integrity_check',{simple:true}),'ok');
   assert.equal(reopened.prepare('SELECT role FROM app_users WHERE email=?').get('synthetic-rehearsal@example.test').role,'customer');
   assert.equal(reopened.prepare('SELECT MAX(version) AS v FROM schema_migrations').get().v,d.REQUIRED_SCHEMA_VERSION);reopened.close();}
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),hash);
  const persistent={NODE_ENV:'production',PRIVATE_TEST_ENABLED:'false',PERSISTENT_DATA_DIR:path.join(root,'fresh'),DB_PATH:process.env.DB_PATH,UPLOADS_DIR:process.env.UPLOADS_DIR};
  assert.equal(resolveDatabaseConfig(persistent).volumeRoot,path.join(root,'fresh'));
  assert.equal(resolveUploadsConfig(persistent).volumeRoot,path.join(root,'fresh'));
  assert.equal(resolveDatabaseConfig({...persistent,DATABASE_URL:'postgres://unsupported'}).ok,false);
 }finally{if(d.db.open)d.closeDatabase();fs.rmSync(root,{recursive:true,force:true});}
});
