import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';import Database from 'better-sqlite3';
import {installSupplierCommissionDocuments,createSyntheticCommissionOrder,readSupplierTestDocuments} from './modules/supplier-commission-documents.js';
const a={userId:'synthetic-a',email:'synthetic-a@example.test'},b={userId:'synthetic-b',email:'synthetic-b@example.test'};
test('owned TEST ledger has bilateral completed order, linked partial credit, immutable invoice and separate real numbering',()=>{
 const store=createSyntheticCommissionOrder(a);
 try{
  assert.ok(store.db.name.startsWith('/tmp/'));const docs=readSupplierTestDocuments(store.db,a.email);
  assert.equal(docs.length,2);assert.deepEqual(readSupplierTestDocuments(store.db,b.email),[]);
  assert.ok(docs.every(d=>d.bookingId===store.bookingId&&d.number.startsWith('TEST-RIO-')));
  const invoice=docs.find(d=>d.kind==='invoice'),credit=docs.find(d=>d.kind==='credit');assert.equal(invoice.amountCents,1500);assert.equal(credit.amountCents,500);assert.equal(credit.originalNumber,invoice.number);
  assert.equal(store.db.prepare('SELECT count(*) n FROM commission_return_acceptance').get().n,2);
  assert.equal(store.db.prepare('SELECT status FROM rental_bookings').get().status,'returned');
  assert.throws(()=>store.db.prepare('UPDATE commission_documents SET amount_cents=0').run(),/IMMUTABLE/);
  assert.equal(store.db.prepare("SELECT count(*) n FROM commission_documents WHERE number LIKE 'RIO-%'").get().n,0);
 }finally{store.cleanup();}
});
test('actual HTTP authorization: empty owner, idempotent synthetic creation, own PDFs, other owner and anonymous denied; disabled in LIVE',async()=>{
 const db=new Database(':memory:'),app=express();app.use(express.json());let enabled=true;
 const requireRole=()=>(req,res,next)=>{req.appUser=req.headers['x-synthetic-user']==='a'?a:req.headers['x-synthetic-user']==='b'?b:null;if(!req.appUser)return res.sendStatus(401);next();};
 const installation=installSupplierCommissionDocuments(app,{db,enabled:()=>enabled,requireRole});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const origin='http://127.0.0.1:'+server.address().port,base='/api/supplier/commission-documents';
 const req=(url,user='a',method='GET')=>fetch(origin+url,{method,headers:{...(user?{'x-synthetic-user':user}:{}),'Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify({ownerEmail:b.email})}:{})});
 try{
  assert.deepEqual((await (await req(base)).json()).documents,[]);
  const created=await (await req(base+'/test-order','a','POST')).json();assert.equal(created.booking.stripeOperationsPerformed,false);assert.equal(created.documents.length,2);
  const again=await (await req(base+'/test-order','a','POST')).json();assert.equal(again.booking.bookingId,created.booking.bookingId);assert.deepEqual(again.documents,created.documents);
  assert.deepEqual((await (await req(base,'b')).json()).documents,[]);
  for(const doc of created.documents){const pdf=await req(doc.url);assert.equal(pdf.status,200);assert.equal(pdf.headers.get('cache-control'),'private, no-store');assert.ok(pdf.headers.get('content-disposition').includes(doc.number));assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0,5).toString(),'%PDF-');
   assert.equal((await req(doc.url,'b')).status,404);assert.equal((await req(doc.url,null)).status,401);}
  assert.equal((await req(base,null)).status,401);assert.equal((await req(base+'/test-order',null,'POST')).status,401);
  assert.equal((await req(base+'/ledger/9999.pdf')).status,404);enabled=false;
  assert.equal((await req(base)).status,404);assert.equal((await req(base+'/test-order','a','POST')).status,404);assert.equal((await req(created.documents[0].url)).status,404);
  assert.equal(db.prepare('SELECT count(*) n FROM sqlite_master WHERE type=\'table\'').get().n,0,'application DB remains unchanged');
 }finally{await new Promise(r=>server.close(r));installation.cleanup();db.close();}
});
