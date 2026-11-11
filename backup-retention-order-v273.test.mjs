import fs from 'node:fs';
import assert from 'node:assert/strict';

// The last successful S3 metadata pointer must remain recoverable if a later
// upload fails. Pruning BEFORE replacing that pointer can destroy its target.
const source=fs.readFileSync('ops/backup-and-verify.js','utf8');
const branch=source.split("if(s3BackupEnabled()){")[1]?.split("\n}else{")[0]||'';
assert.ok(branch,'Remote backup path missing');
const put=branch.indexOf("await uploadBackupObject(client,bucket,backupKey,output");
const metadata=branch.indexOf("await uploadBackupObject(client,bucket,'metadata/last-verified-backup.json'");
const rename=branch.indexOf('fs.renameSync(tempEvidencePath,evidencePath)');
const prune=branch.indexOf("await pruneBackupObjects(client,bucket,'sqlite/',retention,{protectedKeys:[backupKey]})");
assert.ok(put>=0&&metadata>put&&rename>metadata&&prune>rename,
  'Backup retention may only run after the new backup AND verified metadata pointer are durable');
assert.match(branch,/try\s*\{\s*remote=await pruneBackupObjects[\s\S]*?catch\(error\)/,
  'Remote cleanup failures should not invalidate a verified backup');
assert.ok(branch.includes('if(fs.existsSync(tempEvidencePath))fs.unlinkSync(tempEvidencePath)'),
  'Failed metadata upload must clean only incomplete temporary evidence');
console.log('PASS S3 retention cannot delete backup pointed to by last verified evidence before new metadata succeeds');
