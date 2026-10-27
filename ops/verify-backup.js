import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
const file=process.argv[2];if(!file)throw new Error('Usage: node ops/verify-backup.js <backup.db>');
const resolved=path.resolve(file),bytes=fs.readFileSync(resolved);
if(bytes.length<100||bytes.subarray(0,16).toString()!=='SQLite format 3\u0000')throw new Error('Invalid SQLite backup');
const db=new Database(resolved,{readonly:true,fileMustExist:true});let integrity;
try{integrity=db.pragma('integrity_check',{simple:true});}finally{db.close();}
if(String(integrity).toLowerCase()!=='ok')throw new Error(`SQLite integrity_check failed: ${integrity}`);
const evidence={ok:true,verifiedAt:new Date().toISOString(),backupFile:path.basename(resolved),bytes:bytes.length,integrity:'ok'};
fs.writeFileSync(path.join(path.dirname(resolved),'last-verified-backup.json'),JSON.stringify(evidence,null,2));
console.log(JSON.stringify({ok:true,file:resolved,bytes:bytes.length,integrity:'ok',evidence:path.join(path.dirname(resolved),'last-verified-backup.json')}));
