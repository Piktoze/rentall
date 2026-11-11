import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const server=fs.readFileSync('server.js','utf8');
const start=server.indexOf('const rateBuckets=new Map();');
const end=server.indexOf('\nfunction sameOriginWriteGuard(',start);
assert.ok(start>=0&&end>start,'Rate limit middleware not found');
const source=server.slice(start,end);
assert.ok(source.includes('rateBuckets.delete(bucketKey)'),'Expired buckets should be evicted');
const context={Date:{now:()=>0},Map,Math,Number,String,console};
vm.runInNewContext(source+'\nglobalResult=simpleRateLimit({windowMs:1000,max:2,keyPrefix:"test"});',context);
const middleware=context.globalResult;
const req={ip:'198.51.100.10',socket:{remoteAddress:'198.51.100.10'}};
function call(){let status=0,retry='',calls=0;const res={setHeader:(name,value)=>{if(name==='Retry-After')retry=value},status:(v)=>{status=v;return res},json:()=>{}};middleware(req,res,()=>calls++);return {status,retry,calls};}
assert.equal(call().calls,1);
assert.equal(call().calls,1);
assert.equal(call().status,429,'Rate limiting must preserve existing limits');
assert.equal(context.rateBuckets.size,1);
context.Date.now=()=>2000;
for(let i=0;i<253;i++)call();
assert.equal(context.rateBuckets.size,1,'Expired buckets must be removed at periodic sweep, active bucket remains');
console.log('PASS rate limiter maintains thresholds and sweeps expired buckets without timers');
