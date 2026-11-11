import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {downloadBackupObject} from './ops/backup-s3.js';

const folder=fs.mkdtempSync(path.join(os.tmpdir(),'rentinorbit-s3-stream-'));
try{
  let requested=0;
  const goodClient={async send(cmd){
    assert.equal(cmd.constructor.name,'GetObjectCommand');
    assert.equal(cmd.input.Bucket,'synthetic');
    assert.equal(cmd.input.Key,'sqlite/example.db');
    requested++;
    return {Body:Readable.from([Buffer.concat([Buffer.from('SQLite format 3'),Buffer.from([0])]),Buffer.alloc(128*1024,0x42),Buffer.from('END')])};
  }};
  const file=path.join(folder,'restored.db');
  await downloadBackupObject(goodClient,'synthetic','sqlite/example.db',file);
  assert.equal(requested,1);
  assert.equal(fs.statSync(file).size,16+128*1024+3);
  assert.equal(fs.readFileSync(file).subarray(-3).toString(),'END');

  await assert.rejects(()=>downloadBackupObject(goodClient,'synthetic','sqlite/example.db',file),
    e=>e?.code==='EEXIST','Existing output must never be overwritten');
  assert.equal(fs.readFileSync(file).subarray(-3).toString(),'END',
    'An existing destination must not be changed or deleted');

  const interrupted={async send(){
    return {Body:Readable.from((async function*(){
      yield Buffer.from('PARTIAL');
      throw new Error('Synthetic S3 stream interrupted');
    })())};
  }};
  const partial=path.join(folder,'partial.db');
  await assert.rejects(()=>downloadBackupObject(interrupted,'synthetic','sqlite/interrupted.db',partial),
    /Synthetic S3 stream interrupted/);
  assert.ok(!fs.existsSync(partial),'Interrupted restore must delete only its partial output');

  const noStream={async send(){return {Body:null}}};
  const empty=path.join(folder,'empty.db');
  await assert.rejects(()=>downloadBackupObject(noStream,'synthetic','sqlite/no-stream.db',empty),
    /no readable stream/);
  assert.ok(!fs.existsSync(empty),'Absent stream must not create a fake backup');

  console.log('PASS streaming S3 restore: chunked transfer, exclusive output, interruption cleanup and missing stream');
}finally{fs.rmSync(folder,{recursive:true,force:true});}
