import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectPersistentTestStorage} from './sct-persistent-storage.js';

export const privateTestRequested=(env=process.env)=>env.PRIVATE_TEST_ENABLED==='true';
export function privateTestSettings(env=process.env){
 const requested=privateTestRequested(env);
 const emails=String(env.PRIVATE_TEST_ALLOWED_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 const owner=String(env.PRIVATE_TEST_OWNER_EMAIL||'').trim().toLowerCase();
 const run=String(env.PRIVATE_TEST_RUN_ID||'');
 const valid=requested&&env.RENTINORBIT_STAGING==='true'&&env.STRIPE_MODE==='test'&&
 /^[sr]k_test_/.test(env.STRIPE_SECRET_KEY||'')&&/^pk_test_/.test(env.STRIPE_PUBLISHABLE_KEY||'')&&
 env.RENTINORBIT_CATALOG_ONLY==='false'&&env.RENTINORBIT_SCT_TEST_RUNTIME==='true'&&
 env.RENTINORBIT_DEMO_PAYMENTS==='false'&&/^[a-f0-9]{32}$/.test(run)&&
 emails.length>0&&emails.length<=5&&emails.every(e=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))&&emails.includes(owner);
 const persistent=env.PRIVATE_TEST_STORAGE_MODE==='persistent';
 if(env.PRIVATE_TEST_STORAGE_MODE&&!['temporary','persistent'].includes(env.PRIVATE_TEST_STORAGE_MODE))throw new Error('PRIVATE_TEST_STORAGE_MODE_INVALID');
 const selected=persistent?inspectPersistentTestStorage(env):null;
 const root=selected?.root||(/^[a-f0-9]{32}$/.test(run)?path.join(os.tmpdir(),'rentinorbit-private-test',run):null);
 return {requested,valid,emails,owner,root,db:root?path.join(root,'test.sqlite'):null,uploads:root?path.join(root,'uploads'):null};
}
export function assertPrivatePath(target){
 const base=path.resolve(os.tmpdir());
 if(!path.resolve(target).startsWith(base+path.sep))throw new Error('PRIVATE_TEST_STORAGE_OUTSIDE_TEMP');
 let current=base;
 for(const segment of path.relative(base,target).split(path.sep)){
  current=path.join(current,segment);
  try{if(fs.lstatSync(current).isSymbolicLink())throw new Error('PRIVATE_TEST_STORAGE_SYMLINK');}
  catch(e){if(e.code!=='ENOENT')throw e;}
 }
}
export function preparePrivateTestEnvironment(env=process.env){
 const s=privateTestSettings(env);
 if(!s.requested)return;
 if(!s.valid)throw Object.assign(new Error('PRIVATE_TEST_CONFIGURATION_INVALID'),{code:'PRIVATE_TEST_CONFIGURATION_INVALID'});
 if(env.PRIVATE_TEST_STORAGE_MODE!=='persistent')for(const p of [s.root,s.db,s.uploads])assertPrivatePath(p);
 fs.mkdirSync(s.root,{recursive:true,mode:0o700});fs.mkdirSync(s.uploads,{recursive:true,mode:0o700});
 // No copying, migrating, opening or checkpointing the existing mounted database.
 for(const k of ['DB_BACKUP_ENABLED','BACKUP_SCHEDULER_ENABLED','BACKUP_S3_ENABLED','RENTINORBIT_ISOLATED_RECOVERY_PROBE'])env[k]='false';
 env.BACKUP_DIR=path.join(s.root,'backups');env.DB_BACKUP_EVIDENCE_PATH=path.join(s.root,'backup-evidence.json');
}
