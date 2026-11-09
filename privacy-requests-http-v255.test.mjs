// Isolated HTTP tests: in-memory database and synthetic users; never touches staging /data.
import assert from 'node:assert/strict';
import express from 'express';
import Database from 'better-sqlite3';
import {registerPrivacyRequestRoutes} from './modules/privacy-subject-requests-v253.js';

const db=new Database(':memory:');
db.pragma('foreign_keys=ON');
db.exec("CREATE TABLE app_users (user_id TEXT PRIMARY KEY,email TEXT)");
db.prepare('INSERT INTO app_users(user_id,email) VALUES (?,?)').run('user-a','a@example.test');
db.prepare('INSERT INTO app_users(user_id,email) VALUES (?,?)').run('user-b','b@example.test');
db.prepare('INSERT INTO app_users(user_id,email) VALUES (?,?)').run('admin','admin@example.test');
const app=express();app.use(express.json());
const accounts={'user-a':{userId:'user-a',role:'customer'},'user-b':{userId:'user-b',role:'supplier'},admin:{userId:'admin',role:'admin'}};
function requireAuth(req,res,next){const user=accounts[req.headers['x-test-actor']];if(!user)return res.status(401).json({error:'Auth required'});req.appUser=user;next()}
const queued=[];
const oldAddress=process.env.PRIVACY_REQUESTS_NOTIFY_EMAIL;
const oldWorker=process.env.EMAIL_WORKER_ENABLED;
process.env.EMAIL_WORKER_ENABLED='false';
process.env.PRIVACY_REQUESTS_NOTIFY_EMAIL='privacy@example.test';
registerPrivacyRequestRoutes(app,db,requireAuth,(x)=>{queued.push(x);return queued.length});
const server=app.listen(0,'127.0.0.1');
await new Promise((resolve,reject)=>{if(server.listening)resolve();else {server.once('listening',resolve);server.once('error',reject)}});
const base='http://127.0.0.1:'+server.address().port;
async function request(path,actor,body,method='GET'){
  const res=await fetch(base+path,{method,headers:{...(actor?{'x-test-actor':actor}:{}),...(body!==undefined?{'content-type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  return {status:res.status,body:await res.json()};
}
try{
  let r=await request('/api/privacy/requests',null);assert.equal(r.status,401);
  r=await request('/api/admin/privacy/requests','user-a');assert.equal(r.status,403);
  r=await request('/api/admin/privacy/health',null);assert.equal(r.status,401);
  r=await request('/api/admin/privacy/health','user-a');assert.equal(r.status,403);
  r=await request('/api/admin/privacy/health','admin');assert.equal(r.status,200);
  assert.equal(r.body.unreviewed,0);assert.equal(r.body.overdue,0);
  assert.equal(r.body.notificationAddressConfigured,true);
  assert.equal(r.body.automaticDeliveryReady,false);
  r=await request('/api/privacy/requests','user-a',{type:'bogus'},'POST');assert.equal(r.status,400);
  r=await request('/api/privacy/requests','user-a',{type:'access',details:'Mano duomenų kopija'},'POST');
  assert.equal(r.status,201);const id=r.body.requestId;
  assert.equal(queued.length,1);
  r=await request('/api/admin/privacy/health','admin');assert.equal(r.status,200);
  assert.equal(r.body.unreviewed,1);assert.equal(r.body.open,1);
  assert.equal(r.body.overdue,0);
  assert.ok(r.body.earliestDueAt);
  assert.equal(queued[0].payload.details,undefined);
  r=await request('/api/privacy/requests','user-a');assert.equal(r.status,200);
  assert.equal(r.body.requests.length,1);assert.equal(r.body.requests[0].requestId,id);
  assert.ok(r.body.requests[0].dueAt);
  r=await request('/api/privacy/requests','user-b');assert.equal(r.body.requests.length,0);
  r=await request('/api/admin/privacy/requests','admin');assert.equal(r.status,200);
  assert.equal(r.body.requests[0].accountEmail,'a@example.test');
  r=await request('/api/admin/privacy/requests/'+id+'/status','user-b',{status:'completed',reviewConfirmed:true,resolutionNote:'Internal decision documented.'},'POST');
  assert.equal(r.status,403);
  r=await request('/api/admin/privacy/requests/'+id+'/status','admin',{status:'completed',reviewConfirmed:true},'POST');
  assert.equal(r.status,400);assert.equal(r.body.code,'RESOLUTION_NOTE_REQUIRED');
  r=await request('/api/admin/privacy/requests/'+id+'/status','admin',{status:'in_review'},'POST');
  assert.equal(r.status,200);
  r=await request('/api/admin/privacy/requests/'+id+'/status','admin',{status:'completed',reviewConfirmed:true,resolutionNote:'Tapatybė patikrinta, atsakymo registracijos numeris REF-1234.'},'POST');
  assert.equal(r.status,200);
  const audit=db.prepare('SELECT * FROM privacy_subject_request_audit ORDER BY created_at').all();
  assert.equal(audit.length,2);assert.ok(audit[1].resolution_note.includes('REF-1234'));
  r=await request('/api/admin/privacy/requests/'+id+'/status','admin',{status:'in_review'},'POST');
  assert.equal(r.status,409);
  r=await request('/api/admin/privacy/health','admin');assert.equal(r.body.open,0);
  assert.equal(r.body.unreviewed,0);
  // The first page must not hide unreviewed requests behind older completed records.
  const seed=db.prepare("INSERT INTO privacy_subject_requests(request_id,user_id,request_type,details,status,created_at) VALUES (?,?,?,?,?,?)");
  for(let i=0;i<55;i++)seed.run('historical-'+i,'user-b','access','','completed','2026-01-01 00:00:00');
  seed.run('open-priority','user-b','erasure','','received','2026-11-01 10:00:00');
  r=await request('/api/admin/privacy/requests?offset=0','admin');
  assert.equal(r.status,200);assert.equal(r.body.requests.length,50);assert.equal(r.body.hasMore,true);
  assert.equal(r.body.requests[0].requestId,'open-priority');
  r=await request('/api/admin/privacy/requests?offset=50','admin');
  assert.equal(r.status,200);assert.ok(r.body.requests.length>0);assert.equal(r.body.hasMore,false);
  r=await request('/api/admin/privacy/requests?offset=-1','admin');
  assert.equal(r.status,400);
  console.log('PASS GDPR isolated HTTP: 401, 403, 400, 201, per-account privacy, due dates, operator outbox, admin audit, terminal 409');
}finally{
  await new Promise(resolve=>server.close(resolve));db.close();
  if(oldWorker===undefined)delete process.env.EMAIL_WORKER_ENABLED;
  else process.env.EMAIL_WORKER_ENABLED=oldWorker;
  if(oldAddress===undefined)delete process.env.PRIVACY_REQUESTS_NOTIFY_EMAIL;
  else process.env.PRIVACY_REQUESTS_NOTIFY_EMAIL=oldAddress;
}
