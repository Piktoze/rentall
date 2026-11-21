// Explicit future cutover only. This module never creates/migrates/copies a database.
import fs from 'node:fs';
import path from 'node:path';
const fail=code=>{throw Object.assign(new Error(code),{code});};
export function inspectPersistentTestStorage(env){
 if(env.PRIVATE_TEST_STORAGE_MODE!=='persistent'||env.PRIVATE_TEST_ENABLED!=='true'||
  env.RENTINORBIT_STAGING!=='true'||env.STRIPE_MODE!=='test'||env.RENTINORBIT_SCT_TEST_RUNTIME!=='true')fail('SCT_PERSISTENT_TEST_ONLY');
 const requested=env.PRIVATE_TEST_PERSISTENT_ROOT;
 if(typeof requested!=='string'||!path.isAbsolute(requested)||path.resolve(requested)!==requested||
  requested==='/data'||(requested.startsWith('/data/')&&requested!=='/data/launch-v1'))fail('SCT_PERSISTENT_ROOT_INVALID');
 // Reject every symlink component, including a parent of the selected root.
 let current=path.parse(requested).root;
 for(const segment of requested.slice(current.length).split(path.sep)){
  current=path.join(current,segment);if(fs.lstatSync(current).isSymbolicLink())fail('SCT_PERSISTENT_SYMLINK');
 }
 const root=fs.realpathSync(requested),markerFile=path.join(root,'.rentinorbit-storage.json');
 if(fs.lstatSync(markerFile).isSymbolicLink())fail('SCT_PERSISTENT_SYMLINK');
 const marker=JSON.parse(fs.readFileSync(markerFile,'utf8'));
 if(marker.version!==1||marker.purpose!=='fresh-private-stripe-test'||marker.runId!==env.PRIVATE_TEST_RUN_ID||
  !/^[a-f0-9]{32}$/.test(marker.runId)||marker.database!=='test.sqlite'||marker.uploads!=='uploads')fail('SCT_PERSISTENT_MARKER_INVALID');
 const db=path.join(root,marker.database),uploads=path.join(root,marker.uploads);
 for(const target of [db,uploads]){
  if(fs.lstatSync(target).isSymbolicLink()||fs.realpathSync(target)!==target)fail('SCT_PERSISTENT_SYMLINK');
 }
 if(!fs.statSync(db).isFile()||!fs.statSync(uploads).isDirectory())fail('SCT_PERSISTENT_LAYOUT_INVALID');
 return {root,db,uploads};
}
export function assertPersistentTestDatabase(db,env){
 const storage=inspectPersistentTestStorage(env);
 if(db.name===':memory:'||fs.realpathSync(db.name)!==storage.db)fail('SCT_PERSISTENT_DATABASE_MISMATCH');
 // An opt-in marker cannot silently enroll historical financial records.
 const hasEnrollment=!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sct_test_enrollments'").get();
 const history="(b.stripe_payment_intent_id IS NOT NULL AND b.stripe_payment_intent_id!='')";
 const old=db.prepare(`SELECT 1 FROM rental_bookings b WHERE
  ${history} ${hasEnrollment?'AND NOT EXISTS (SELECT 1 FROM sct_test_enrollments e WHERE e.booking_id=b.booking_id)':''} LIMIT 1`).get();
 if(old)fail('SCT_UNENROLLED_FINANCIAL_HISTORY');
 return storage;
}
