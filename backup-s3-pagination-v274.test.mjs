import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pruneBackupObjects} from './ops/backup-s3.js';

// Mock AWS SDK requests; this test cannot touch an actual bucket or /data.
const objects=Array.from({length:1205},(_,i)=>({
  Key:`sqlite/rentinorbit-${String(i).padStart(4,'0')}.db`,
  LastModified:new Date(Date.UTC(2026,0,1,0,0,0)+i*1000)
}));
const protectedKey=objects[0].Key;
const deleted=[];
const listedTokens=[];
const mock={
  async send(command){
    if(command.constructor.name==='ListObjectsV2Command'){
      const token=command.input.ContinuationToken;
      listedTokens.push(token||'FIRST');
      const start=token?Number(token):0;
      return {Contents:objects.slice(start,start+600),IsTruncated:start+600<objects.length,
        NextContinuationToken:start+600<objects.length?String(start+600):undefined};
    }
    if(command.constructor.name==='DeleteObjectsCommand'){
      const keys=command.input.Delete.Objects.map(item=>item.Key);
      assert.ok(keys.length<=1000,'S3 delete batch limit must be respected');
      deleted.push(...keys);
      return {};
    }
    throw new Error('Unexpected S3 command '+command.constructor.name);
  }
};
const outcome=await pruneBackupObjects(mock,'test-bucket','sqlite/',2,{protectedKeys:[protectedKey]});
assert.equal(outcome.listed,1205,'Every paginated backup must be included');
assert.deepEqual(listedTokens,['FIRST','600','1200']);
assert.equal(outcome.deleted,1202,'Only two newest plus protected oldest should survive');
assert.ok(!deleted.includes(protectedKey),'Latest verified backup pointer must never be pruned');
assert.ok(!deleted.includes(objects[1204].Key));
assert.ok(!deleted.includes(objects[1203].Key));
assert.equal(new Set(deleted).size,1202,'No repeated delete keys');

const stuck={async send(command){
  if(command.constructor.name!=='ListObjectsV2Command')throw Error('Must not delete on incomplete listing');
  return {Contents:[],IsTruncated:true,NextContinuationToken:'stuck'};
}};
await assert.rejects(()=>pruneBackupObjects(stuck,'bucket','sqlite/',2),/pagination is incomplete/);

const partial={async send(command){
  if(command.constructor.name==='ListObjectsV2Command')return {Contents:objects.slice(0,4),IsTruncated:false};
  return {Errors:[{Key:objects[0].Key,Code:'AccessDenied'}]};
}};
await assert.rejects(()=>pruneBackupObjects(partial,'bucket','sqlite/',2),/failed keys/);

const backup=fs.readFileSync('ops/backup-and-verify.js','utf8');
assert.ok(backup.includes('protectedKeys:[backupKey]'),'Backup creator must protect published pointer during retention');
console.log('PASS S3 retention 1205 objects: pagination, protected backup, 1000-key batches, incomplete pages and deletion errors');
