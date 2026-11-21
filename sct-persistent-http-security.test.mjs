import http from 'node:http';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';
import {spawn} from 'node:child_process';import {once} from 'node:events';import assert from 'node:assert/strict';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'rio-persistent-http-')),run=crypto.randomBytes(16).toString('hex');
const mailPath=path.join(temp,'mail.json'),hook=path.join(temp,'fetch.mjs');
// Provider double exists only in this disposable test process; deployed code has no mail bypass.
// Publish the synthetic mail atomically: existence must never expose partial JSON to the parent.
fs.writeFileSync(hook,`import http from 'node:http';import fs from 'node:fs';const real=globalThis.fetch;globalThis.fetch=(u,o)=>String(u)==='https://api.resend.com/emails'?(fs.writeFileSync(${JSON.stringify(mailPath+'.tmp')},o.body),fs.renameSync(${JSON.stringify(mailPath+'.tmp')},${JSON.stringify(mailPath)}),Promise.resolve(new Response(JSON.stringify({id:'11111111-1111-1111-1111-111111111111'}),{status:200}))):real(u,o);`);
const env={...process.env,NODE_ENV:'production',NODE_OPTIONS:'',HOST:'127.0.0.1',PORT:'32896',
 PRIVATE_TEST_ENABLED:'true',PRIVATE_TEST_REQUIRED:'true',PRIVATE_TEST_RUN_ID:run,PRIVATE_TEST_ALLOWED_EMAILS:'owner@example.test',PRIVATE_TEST_OWNER_EMAIL:'owner@example.test',PRIVATE_TEST_RECIPIENT_ID:'',
 RENTINORBIT_STAGING:'true',RENTINORBIT_CATALOG_ONLY:'false',RENTINORBIT_SCT_TEST_RUNTIME:'true',RENTINORBIT_DEMO_PAYMENTS:'false',
 DB_PATH:'/data/untouched.sqlite',DATABASE_URL:'',RENTINORBIT_DB_PATH:'',UPLOADS_DIR:'/data/untouched-uploads',RAILWAY_VOLUME_MOUNT_PATH:'/data',
 APP_URL:'https://rentinorbit.com',PUBLIC_BASE_URL:'https://rentinorbit.com',TRUST_PROXY_HOPS:'1',SESSION_SECRET:crypto.randomBytes(32).toString('hex'),
 SCT_STRIPE_FEE_PAYER:'platform',PLATFORM_FEE_PERCENT:'15',STRIPE_MODE:'test',STRIPE_SECRET_KEY:'sk_test_synthetic_placeholder_123456',STRIPE_PUBLISHABLE_KEY:'pk_test_synthetic_placeholder_123456',STRIPE_WEBHOOK_SECRET:'whsec_synthetic_placeholder_123456',STRIPE_CONNECT_WEBHOOK_SECRET:'whsec_synthetic_placeholder_123456',STRIPE_CONNECT_V2_PROVISIONING:'true',
 EMAIL_PROVIDER:'resend',EMAIL_FROM:'RentInOrbit <info@example.test>',RESEND_API_KEY:'re_synthetic_placeholder_123456',EMAIL_WORKER_ENABLED:'true',EMAIL_WORKER_TOKEN:crypto.randomBytes(32).toString('hex'),SUPPORT_EMAIL:'info@example.test',SMS_PROVIDER:'disabled',PUSH_PROVIDER:'disabled',MAPS_PROVIDER:'stub',
 DB_BACKUP_ENABLED:'false',BACKUP_SCHEDULER_ENABLED:'false',BACKUP_S3_ENABLED:'false',RENTINORBIT_ISOLATED_RECOVERY_PROBE:'false'};
fs.writeFileSync(path.join(temp,'test.sqlite'),'');fs.mkdirSync(path.join(temp,'uploads'));
fs.writeFileSync(path.join(temp,'.rentinorbit-storage.json'),JSON.stringify({version:1,purpose:'fresh-private-stripe-test',runId:run,database:'test.sqlite',uploads:'uploads'}));
Object.assign(env,{PRIVATE_TEST_STORAGE_MODE:'persistent',PRIVATE_TEST_PERSISTENT_ROOT:temp});
let child=spawn(process.execPath,['--import',hook,'ops/start.js'],{env,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);
const base='http://127.0.0.1:32896';let cookie='';
const req=(p,{method='GET',body,headers={}}={})=>fetch(base+p,{method,headers:{Origin:env.APP_URL,'Content-Type':'application/json',cookie,...headers},...(body?{body:JSON.stringify(body)}:{}),redirect:'manual'});
try{
 let ready=false;for(let i=0;i<120;i++){if(child.exitCode!==null)throw Error(output);try{if((await req('/healthz')).status===200){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}assert.ok(ready,output);
 assert.equal((await req('/api/listings')).status,401);assert.equal((await req('/app.js',{headers:{Accept:'application/json'}})).status,401);
 const challenge=await (await req('/__test-access/request',{method:'POST',body:{email:'owner@example.test'}})).json();
 for(let i=0;i<50&&!fs.existsSync(mailPath);i++)await new Promise(r=>setTimeout(r,20));
 const code=JSON.parse(fs.readFileSync(mailPath)).html.match(/<strong>(\d{8})<\/strong>/)[1];
 const access=await req('/__test-access/verify',{method:'POST',body:{challenge:challenge.challenge,code}});assert.equal(access.status,200);cookie=access.headers.get('set-cookie').split(';')[0];
 const root=await req('/');assert.equal(root.status,200);assert.ok(root.headers.get('content-security-policy').includes('https://connect.stripe.com'));
 const rootHtml=await root.text();assert.ok(rootHtml.includes('Privatus TEST'));assert.ok(rootHtml.includes('Užbaigti Stripe TEST sąlygas'));
 assert.equal((await req('/__test-access/stripe-recipient',{method:'POST',body:{}})).status,503);
 const registration=await req('/api/auth/register',{method:'POST',body:{email:'owner@example.test',password:'Synthetic-password-123456',displayName:'Synthetic owner',termsAccepted:true,role:'admin'}});assert.equal(registration.status,200,await registration.clone().text());assert.equal((await registration.json()).user.role,'admin');
 const session=registration.headers.get('set-cookie');assert.ok(session.includes('Secure'));assert.ok(!session.includes('Domain='));cookie+='; '+session.split(';')[0];
 assert.equal((await (await req('/api/auth/me')).json()).user.role,'admin');
 const normal=await req('/api/auth/register',{method:'POST',body:{email:'renter@example.test',password:'Synthetic-password-123456',termsAccepted:true,role:'admin'}});assert.equal(normal.status,200);assert.equal((await normal.json()).user.role,'supplier');
 assert.equal((await req('/api/listings')).status,200);assert.equal((await req('/app.js')).status,200);
 const readiness=await (await req('/api/readiness')).json();assert.equal(readiness.database.persistent,true);
 assert.equal((await req('/api/auth/forgot-password',{method:'POST',body:{email:'owner@example.test'}})).status,202);
 const {default:Database}=await import('better-sqlite3');const db=new Database(path.join(temp,'test.sqlite'),{readonly:true});
 assert.equal(db.prepare("SELECT count(*) n FROM app_users WHERE email IN ('demo@rentinorbit.test','admin@rentinorbit.test')").get().n,0);
 const payload=JSON.parse(db.prepare("SELECT payload_json FROM email_outbox WHERE template_key='password_reset'").get().payload_json);
 const {decodeResetMail}=await import('./modules/password-recovery.js');assert.equal(new URL(decodeResetMail(payload,env.SESSION_SECRET).url).origin,'https://rentinorbit.com');db.close();
 const redirect=host=>new Promise((resolve,reject)=>{http.get(base+'/?probe=1',{headers:{host}},r=>{r.resume();resolve(r.headers.location);}).on('error',reject);});
 for(const host of ['www.rentinorbit.com','rentall-staging.up.railway.app'])assert.equal(await redirect(host),'https://rentinorbit.com/?probe=1');

 // Two independent barriers remain effective under bounded local concurrency.
 const samples=[],statuses={};let next=0;const started=performance.now();
 await Promise.all(Array.from({length:12},async()=>{while(next<120){next++;const t=performance.now();
  const response=await req('/api/listings');await response.arrayBuffer();samples.push(performance.now()-t);statuses[response.status]=(statuses[response.status]||0)+1;
 }}));
 assert.equal(statuses[200],120);assert.equal(statuses[500]||0,0);
 const elapsed=performance.now()-started;let listingLimited=false;for(let i=0;i<65;i++){const response=await req('/api/listings');if(response.status===429){listingLimited=true;assert.ok(response.headers.get('retry-after'));}}assert.ok(listingLimited);samples.sort((a,b)=>a-b);
 // Application auth cannot be replaced by a private-access cookie alone.
 const ownerCookie=cookie;cookie='';assert.equal((await req('/api/listings')).status,401);cookie=ownerCookie;
 const originalCookie=cookie;cookie=cookie.split(';')[0];
 assert.equal((await req('/api/admin/disputes')).status,401);
 assert.equal((await req('/api/auth/register',{method:'POST',body:{},headers:{Origin:'https://evil.example'}})).status,403);
 let limited=false;for(let i=0;i<8;i++){const response=await req('/api/auth/forgot-password',{method:'POST',body:{email:'missing@example.test'}});if(response.status===429){limited=true;assert.ok(response.headers.get('retry-after'));}}
 assert.ok(limited);cookie=originalCookie;
 // A hard server stop retains both the authenticated user and an uploaded synthetic file.
 const photo=path.join(temp,'uploads','restart-proof.bin');fs.writeFileSync(photo,'synthetic-storage-proof');
 const exited=once(child,'exit');child.kill('SIGKILL');await exited;
 child=spawn(process.execPath,['--import',hook,'ops/start.js'],{env,stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);
 let restarted=false;for(let i=0;i<120;i++){if(child.exitCode!==null)throw Error(output);try{if((await req('/healthz')).status===200){restarted=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}
 assert.ok(restarted,output);assert.equal((await req('/api/listings')).status,401);
 fs.rmSync(mailPath,{force:true});
 const again=await(await req('/__test-access/request',{method:'POST',body:{email:'owner@example.test'}})).json();
 for(let i=0;i<50&&!fs.existsSync(mailPath);i++)await new Promise(r=>setTimeout(r,20));
 const freshCode=JSON.parse(fs.readFileSync(mailPath)).html.match(/<strong>(\d{8})<\/strong>/)[1];
 const freshAccess=await req('/__test-access/verify',{method:'POST',body:{challenge:again.challenge,code:freshCode}});
 assert.equal(freshAccess.status,200);cookie=freshAccess.headers.get('set-cookie').split(';')[0]+';'+originalCookie.split(';').slice(1).join(';');
 assert.equal((await(await req('/api/auth/me')).json()).user.email,'owner@example.test');
 assert.equal(fs.readFileSync(photo,'utf8'),'synthetic-storage-proof');
 const report={scope:'local isolated HTTP; 12 concurrent readers, 120 authenticated listing requests',requests:120,concurrency:12,statuses,elapsedMs:Math.round(elapsed),p95Ms:Math.round(samples[Math.floor(samples.length*.95)]),serverRestart:'SIGKILL; private gate requires fresh OTP; app session/user/file retained',security:{unauthenticatedDenied:true,adminRequiresAppSession:true,crossOriginWriteDenied:true,passwordResetRateLimited:true,listingRateLimited:true,roleEscalationDenied:true},realStripeCalls:0,realEmails:0};
 if(process.env.LOCAL_TEST_EVIDENCE_PATH)fs.writeFileSync(process.env.LOCAL_TEST_EVIDENCE_PATH,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
 assert.ok(!output.includes(code));assert.ok(!output.includes('sqlite busy'));
 console.log('PASS persistent private HTTP: isolated DB/uploads, no demo seeds, OTP gate, full app, owner bootstrap, role escalation blocked, Secure session, canonical hosts, own-domain reset URL');
}finally{child.kill('SIGTERM');if(child.exitCode===null)await once(child,'exit');fs.rmSync(path.join(os.tmpdir(),'rentinorbit-private-test',run),{recursive:true,force:true});fs.rmSync(temp,{recursive:true,force:true});}
