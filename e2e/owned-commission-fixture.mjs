// Entire app behind its real private gate, with local TLS and a mail-provider double.
// No remote Stripe/email requests and no mounted storage. Used only by isolated CI.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';
import http from 'node:http';import https from 'node:https';import {spawn,execFileSync} from 'node:child_process';
const root=process.env.RIO_DOCUMENT_E2E_ROOT;
const tempRoots=[os.tmpdir(),process.env.RUNNER_TEMP].filter(Boolean).map(p=>path.resolve(p));
if(process.env.CI!=='true'||!root||!tempRoots.some(p=>path.resolve(root).startsWith(p+path.sep))||path.resolve(root).startsWith('/data/'))throw Error('ISOLATED_DOCUMENT_FIXTURE_REQUIRED');
fs.mkdirSync(root,{recursive:true,mode:0o700});const mail=path.join(root,'mail.json'),hook=path.join(root,'provider.mjs');
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',root+'/key.pem','-out',root+'/cert.pem','-days','1','-subj','/CN=rentinorbit.test'],{stdio:'ignore'});
fs.writeFileSync(hook,`import fs from 'node:fs';const real=globalThis.fetch;globalThis.fetch=(u,o)=>String(u)==='https://api.resend.com/emails'?(fs.writeFileSync(${JSON.stringify(mail+'.tmp')},o.body),fs.renameSync(${JSON.stringify(mail+'.tmp')},${JSON.stringify(mail)}),Promise.resolve(new Response(JSON.stringify({id:'11111111-1111-1111-1111-111111111111'}),{status:200}))):real(u,o);`);
const run=crypto.randomBytes(16).toString('hex');
const env={...process.env,NODE_ENV:'production',NODE_OPTIONS:'',PORT:'34444',HOST:'127.0.0.1',
 PRIVATE_TEST_ENABLED:'true',PRIVATE_TEST_REQUIRED:'true',PRIVATE_TEST_RUN_ID:run,PRIVATE_TEST_STORAGE_MODE:'temporary',PRIVATE_TEST_ALLOWED_EMAILS:'gate@example.test',PRIVATE_TEST_OWNER_EMAIL:'gate@example.test',PRIVATE_TEST_RECIPIENT_ID:'',
 RENTINORBIT_STAGING:'true',RENTINORBIT_CATALOG_ONLY:'false',RENTINORBIT_SCT_TEST_RUNTIME:'true',RENTINORBIT_DEMO_PAYMENTS:'false',
 APP_URL:'https://rentinorbit.test:34443',PUBLIC_BASE_URL:'https://rentinorbit.test:34443',TRUST_PROXY_HOPS:'1',SESSION_SECRET:crypto.randomBytes(32).toString('hex'),
 DB_PATH:root+'/unused.sqlite',DATABASE_URL:'',RENTINORBIT_DB_PATH:'',UPLOADS_DIR:root+'/unused-uploads',RAILWAY_VOLUME_MOUNT_PATH:'',
 SCT_STRIPE_FEE_PAYER:'platform',PLATFORM_FEE_PERCENT:'15',STRIPE_MODE:'test',STRIPE_SECRET_KEY:'sk_test_synthetic_placeholder_123456',STRIPE_PUBLISHABLE_KEY:'pk_test_synthetic_placeholder_123456',STRIPE_WEBHOOK_SECRET:'whsec_synthetic_placeholder_123456',STRIPE_CONNECT_WEBHOOK_SECRET:'whsec_synthetic_placeholder_123456',
 EMAIL_PROVIDER:'resend',EMAIL_FROM:'TEST <info@example.test>',RESEND_API_KEY:'re_synthetic_placeholder_123456',EMAIL_WORKER_ENABLED:'true',EMAIL_WORKER_TOKEN:crypto.randomBytes(32).toString('hex'),SMS_PROVIDER:'disabled',PUSH_PROVIDER:'disabled',MAPS_PROVIDER:'stub',STRIPE_CONNECT_V2_PROVISIONING:'true',SUPPORT_EMAIL:'info@example.test',
 COMMERCIAL_SCT_RUNTIME_ENABLED:'false',CONNECT_ONBOARDING_ONLY_ENABLED:'false',ENCRYPTED_BACKUP_SCHEDULER_ENABLED:'false',DB_BACKUP_ENABLED:'false',BACKUP_SCHEDULER_ENABLED:'false',BACKUP_S3_ENABLED:'false',RENTINORBIT_ISOLATED_RECOVERY_PROBE:'false'};
const child=spawn(process.execPath,['--import',hook,'ops/start.js'],{env,cwd:new URL('../',import.meta.url),stdio:['ignore','inherit','inherit']});
let closing=false;
const issuedPreview=process.env.RIO_ISSUED_DOCUMENT_PREVIEW_FIXTURE==='true'?await (await import('./issued-document-preview-proxy.mjs')).prepareIssuedPreviewProxy({mailPath:mail}):null;
const proxy=https.createServer({key:fs.readFileSync(root+'/key.pem'),cert:fs.readFileSync(root+'/cert.pem')},(req,res)=>{
 if(issuedPreview&&req.url.split('?')[0].startsWith('/api/supplier/issued-commission-documents'))return issuedPreview.handle(req,res);
 const upstream=http.request({hostname:'127.0.0.1',port:34444,path:req.url,method:req.method,headers:{...req.headers,'x-forwarded-proto':'https'}},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});
 upstream.on('error',()=>{res.statusCode=503;res.end();});req.pipe(upstream);
});
proxy.listen(34443,'127.0.0.1');
function stop(){if(closing)return;closing=true;issuedPreview?.cleanup();proxy.close();child.kill('SIGTERM');}
process.on('SIGTERM',stop);process.on('SIGINT',stop);child.on('exit',code=>{proxy.close();fs.rmSync(path.join(os.tmpdir(),'rentinorbit-private-test',run),{recursive:true,force:true});process.exit(closing?0:code||1);});
