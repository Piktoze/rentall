import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {spawn} from 'node:child_process';import {once} from 'node:events';
import assert from 'node:assert/strict';import {decodeResetMail} from './modules/password-recovery.js';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'rio-reset-http-'));
const env={...process.env,NODE_ENV:'test',DB_PATH:path.join(temp,'db.sqlite'),UPLOADS_DIR:path.join(temp,'uploads'),
 APP_URL:'http://127.0.0.1:32891',PUBLIC_BASE_URL:'http://127.0.0.1:32891',PORT:'32891',HOST:'127.0.0.1',
 RENTINORBIT_CATALOG_ONLY:'false',RENTINORBIT_STAGING:'true',RENTINORBIT_SCT_TEST_RUNTIME:'false',
 EMAIL_WORKER_ENABLED:'false',SESSION_SECRET:'Reset-http-synthetic-strong-secret-12345',EMAIL_PROVIDER:'disabled',
 STRIPE_SECRET_KEY:'',STRIPE_PUBLISHABLE_KEY:'',STRIPE_WEBHOOK_SECRET:''};
for(const k of ['DATABASE_URL','RENTINORBIT_DB_PATH','RAILWAY_ENVIRONMENT_ID','RAILWAY_PROJECT_ID','RAILWAY_SERVICE_ID','RAILWAY_VOLUME_MOUNT_PATH','PERSISTENT_DATA_DIR'])delete env[k];
Object.assign(process.env,env);for(const k of ['DATABASE_URL','RENTINORBIT_DB_PATH','RAILWAY_ENVIRONMENT_ID','RAILWAY_PROJECT_ID','RAILWAY_SERVICE_ID','RAILWAY_VOLUME_MOUNT_PATH','PERSISTENT_DATA_DIR'])delete process.env[k];
const {db,createAppUser,createAppSession}=await import('./db.js');
const user=createAppUser({email:'reset-renter@example.test',password:'OldSyntheticPassword123',role:'customer'});
const session=createAppSession(user.userId),child=spawn(process.execPath,['server.js'],{env,stdio:['ignore','pipe','pipe']});
let output='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);
const post=(p,data,headers={})=>fetch(env.APP_URL+p,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(data)});
try{
 for(let i=0;i<100;i++){try{if((await fetch(env.APP_URL+'/healthz')).ok)break;}catch{}await new Promise(r=>setTimeout(r,50));}
 const known=await post('/api/auth/forgot-password',{email:user.email});assert.equal(known.status,202);
 const unknown=await post('/api/auth/forgot-password',{email:'unknown@example.test'});assert.equal(unknown.status,202);
 assert.deepEqual(await known.json(),await unknown.json());
 const item=db.prepare("SELECT payload_json FROM email_outbox WHERE template_key='password_reset'").get();
 const mail=decodeResetMail(JSON.parse(item.payload_json),env.SESSION_SECRET),token=new URL(mail.url).hash.slice(7);
 assert.equal(new URL(mail.url).origin,env.APP_URL);
 assert.equal(output.includes(token),false);assert.equal(item.payload_json.includes(token),false);
 assert.equal((await post('/api/auth/reset-password',{token,password:'NewSyntheticPassword123'},{Origin:'https://untrusted.example'})).status,403);
 assert.equal((await post('/api/auth/reset-password',{token,password:'NewSyntheticPassword123'})).status,200);
 assert.equal((await post('/api/auth/reset-password',{token,password:'ReplaySyntheticPassword123'})).status,400);
 assert.equal((await post('/api/auth/login',{email:user.email,password:'OldSyntheticPassword123'})).status,401);
 assert.equal((await post('/api/auth/login',{email:user.email,password:'NewSyntheticPassword123'})).status,200);
 assert.equal((await fetch(env.APP_URL+'/api/auth/me',{headers:{cookie:'rentinorbit_session='+session.token}})).status,200);
 assert.equal((await (await fetch(env.APP_URL+'/api/auth/me',{headers:{cookie:'rentinorbit_session='+session.token}})).json()).user,null);
 for(let i=0;i<3;i++)assert.equal((await post('/api/auth/forgot-password',{email:'unknown@example.test'})).status,202);
 assert.equal((await post('/api/auth/forgot-password',{email:'unknown@example.test'})).status,429);
 const page=await fetch(env.APP_URL+'/password-reset');assert.equal(page.status,200);assert.equal(page.headers.get('referrer-policy'),'no-referrer');
 assert.equal((await fetch(env.APP_URL+'/password-reset.js')).status,200);
 console.log('PASS recovery HTTP: encrypted outbox, equal replies, fixed origin, CSRF, single use, session revocation, old/new login, IP throttle, page/script');
}finally{child.kill('SIGTERM');await once(child,'exit');db.close();fs.rmSync(temp,{recursive:true,force:true});}
