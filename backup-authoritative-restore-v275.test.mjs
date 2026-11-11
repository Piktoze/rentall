import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {loadVerifiedBackupEvidence} from './ops/backup-s3.js';

const folder=fs.mkdtempSync(path.join(os.tmpdir(),'rentinorbit-evidence-source-'));
try{
  const file=path.join(folder,'cached-old-evidence.json');
  fs.writeFileSync(file,JSON.stringify({ok:true,backupKey:'sqlite/old.db',sha256:'old'}));
  const current={ok:true,backupKey:'sqlite/current.db',sha256:'current'};
  let remoteReads=0;
  const client={async send(cmd){
    assert.equal(cmd.constructor.name,'GetObjectCommand');
    assert.equal(cmd.input.Key,'metadata/last-verified-backup.json');
    remoteReads++;
    return {Body:{async transformToString(){return JSON.stringify(current);}}};
  }};
  const evidence=await loadVerifiedBackupEvidence({remote:true,evidencePath:file,client,bucket:'synthetic'});
  assert.deepEqual(evidence,current,'Remote backup metadata must override stale local file');
  assert.equal(remoteReads,1);
  const local=await loadVerifiedBackupEvidence({remote:false,evidencePath:file});
  assert.equal(local.backupKey,'sqlite/old.db','Local backup mode uses local evidence only');
  const failingClient={async send(){throw new Error('Synthetic S3 outage')}};
  await assert.rejects(
    ()=>loadVerifiedBackupEvidence({remote:true,evidencePath:file,client:failingClient,bucket:'synthetic'}),
    /Synthetic S3 outage/,'Remote outage must never silently return local stale metadata');
  assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).backupKey,'sqlite/old.db','Test must not overwrite local evidence');
  const restore=fs.readFileSync('ops/test-backup-restore.js','utf8');
  assert.ok(restore.includes('loadVerifiedBackupEvidence({remote,evidencePath,client:s3?.client,bucket:s3?.bucket})'),
    'Restore command must use authoritative evidence helper');
  console.log('PASS remote S3 restore uses authoritative pointer, rejects stale local fallback and fails closed on outage');
}finally{fs.rmSync(folder,{recursive:true,force:true});}
