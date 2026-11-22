import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';import fs from 'node:fs';
import {prepareIssuedArchive} from './e2e/issued-document-records.mjs';
import {readIssuedCommissionDocuments,renderIssuedCommissionPdf,installIssuedCommissionDocuments,issuedDeliveryEnabled} from './modules/issued-commission-documents.js';
const a={userId:'a',email:'a@example.test'},b={userId:'b',email:'b@example.test'},empty={userId:'empty',email:'empty@example.test'};
test('preloaded immutable read-only archive: saved recipient, two linked credits, TEST segregation, no numbering or issuance',async()=>{
 const s=prepareIssuedArchive([a,b]);try{
  const before=fs.readFileSync(s.file),docs=readIssuedCommissionDocuments(s.db,a,{preview:true});assert.equal(docs.length,3);
  assert.equal(docs.filter(d=>d.kind==='credit').length,2);assert.ok(docs.every(d=>d.bookingId==='SYNTHETIC-ORDER-0'&&!d.number.startsWith('TEST-')));
  assert.deepEqual(readIssuedCommissionDocuments(s.db,a),[],'preview cannot pass commercial reader');
  assert.deepEqual(readIssuedCommissionDocuments(s.db,{...b,email:a.email},{preview:true}),[],'recipient ID and email must both match');
  assert.deepEqual(readIssuedCommissionDocuments(s.db,empty,{preview:true}),[]);
  const invoice=docs.find(d=>d.kind==='invoice');assert.equal(invoice.snapshot.recipientName,'SINTETINIS nuomotojas 0');
  for(const doc of docs){const pdf=await renderIssuedCommissionPdf(doc);assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.deepEqual(pdf,await renderIssuedCommissionPdf(doc),'same archived document produces identical PDF');}
  assert.deepEqual(fs.readFileSync(s.file),before);assert.throws(()=>s.db.prepare('DELETE FROM commission_documents').run(),/readonly/);
  assert.equal(s.db.prepare("SELECT count(*) n FROM sqlite_master WHERE name='commission_series'").get().n,0);
 }finally{s.cleanup();}
});
test('GET-only issued document service: owner access, outsider/anonymous denied, no POST issuance, disabled in private TEST',async()=>{
 const store=prepareIssuedArchive([a,b]),app=express();let enabled=true;
 const role=()=>(req,res,next)=>{req.appUser=req.headers['x-user']==='a'?a:req.headers['x-user']==='b'?b:null;if(!req.appUser)return res.sendStatus(401);next();};
 installIssuedCommissionDocuments(app,{enabled:()=>enabled,requireRole:role,getDb:()=>store.db,preview:true});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base='http://127.0.0.1:'+server.address().port,p='/api/supplier/issued-commission-documents';
 const req=(url,user='a',method='GET')=>fetch(base+url,{method,headers:user?{'x-user':user}:{}});
 try{
  const list=await (await req(p)).json();assert.equal(list.documentClass,'commercial');assert.equal(list.documents.length,3);assert.ok(list.documents.every(d=>!('snapshot'in d)));
  for(const doc of list.documents){const r=await req(doc.url);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.ok(r.headers.get('content-disposition').includes('PREVIEW-RIO-2099-'));assert.equal((await req(doc.url,'b')).status,404);assert.equal((await req(doc.url,null)).status,401);}
  assert.equal((await req(p,'a','POST')).status,404);assert.equal((await req(p+'/999.pdf')).status,404);enabled=false;assert.equal((await req(p)).status,404);
  assert.equal(issuedDeliveryEnabled({COMMISSION_DOCUMENT_DELIVERY_ENABLED:'true',PRIVATE_TEST_ENABLED:'true'}),false);
  assert.equal(issuedDeliveryEnabled({}),false);assert.equal(issuedDeliveryEnabled({COMMISSION_DOCUMENT_DELIVERY_ENABLED:'true',PRIVATE_TEST_ENABLED:'false',COMMERCIAL_SCT_RUNTIME_ENABLED:'false'}),true,'read access independent of financial executor and new issuance');
 }finally{await new Promise(r=>server.close(r));store.cleanup();}
});

test('commercial-mode reader accepts preloaded complete snapshots without enabling issuance and ignores present profile fields',()=>{
 const s=prepareIssuedArchive([a],{preview:false});try{const documents=readIssuedCommissionDocuments(s.db,{...a,displayName:'Changed profile',address:'Changed address'});assert.equal(documents.length,3);assert.equal(documents[0].snapshot.recipientName,'SINTETINIS nuomotojas 0');assert.deepEqual(readIssuedCommissionDocuments(s.db,a,{preview:true}),[]);}finally{s.cleanup();}
});
