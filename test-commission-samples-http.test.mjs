import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {installTestCommissionExamples} from './modules/test-commission-routes.js';
import {buildTestCommissionSamples} from './modules/test-commission-samples.js';
test('two TEST PDFs use isolated shared TEST-RIO counter, real logo and partial credit reference without a real series',async()=>{
 const s=await buildTestCommissionSamples();assert.equal(s.realSeriesUsed,false);assert.equal(s.invoice.number,'TEST-RIO-2026-000001');assert.equal(s.credit.number,'TEST-RIO-2026-000002');assert.equal(s.credit.originalNumber,s.invoice.number);assert.equal(s.invoice.amountCents,1500);assert.equal(s.credit.amountCents,500);
 for(const item of [s.invoice,s.credit]){assert.ok(item.pdf.subarray(0,5).equals(Buffer.from('%PDF-')));assert.ok(item.pdf.includes(Buffer.from('/Subtype /Image')),'existing logo is embedded');assert.ok(item.pdf.length>10000);}
});
test('only authenticated supplier/admin may download private TEST samples; customer denied, unknown kind denied and LIVE disabled',async()=>{
 const app=express();let enabled=true;const auth=(...roles)=>(req,res,next)=>{if(!req.headers['x-role'])return res.sendStatus(401);if(!roles.includes(req.headers['x-role']))return res.sendStatus(403);next();};installTestCommissionExamples(app,{enabled:()=>enabled,requireRole:auth});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port+'/api/supplier/accounting/test-examples';
 try{assert.equal((await fetch(base)).status,401);assert.equal((await fetch(base,{headers:{'x-role':'customer'}})).status,403);
  const response=await fetch(base,{headers:{'x-role':'supplier'}});assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal((await response.json()).documents.length,2);
  for(const kind of ['invoice','credit']){const r=await fetch(base+'/'+kind+'.pdf',{headers:{'x-role':'supplier'}});assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/application\/pdf/);assert.match(r.headers.get('content-disposition'),/TEST-RIO-2026-00000[12]/);assert.ok((await r.arrayBuffer()).byteLength>10000);}
  assert.equal((await fetch(base+'/other.pdf',{headers:{'x-role':'admin'}})).status,404);enabled=false;assert.equal((await fetch(base+'/invoice.pdf',{headers:{'x-role':'supplier'}})).status,404);
 }finally{await new Promise(r=>server.close(r));}
});
