// One explicitly authorized real mail delivery probe; no real bookings/payments.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';
const run=process.env.RENTINORBIT_NOTIFICATION_TEST_RUN_ID;
if(!/^[a-f0-9]{32}$/.test(run||'')||process.env.RENTINORBIT_STAGING!=='true'||process.env.STRIPE_MODE!=='test'||!/^re_/.test(process.env.RESEND_API_KEY||''))throw Error('EXPLICIT_STAGING_MAIL_PROBE_REQUIRED');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'rio-notification-')),recipient='ieva.zalpyte@gmail.com';
const report={type:'notification_delivery_evidence',run,storage:'temporary_sqlite',financialOperations:false,messages:[]};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let child,db;
try{
 Object.assign(process.env,{NODE_ENV:'test',DB_PATH:path.join(folder,'probe.sqlite'),UPLOADS_DIR:path.join(folder,'uploads'),
  PRIVATE_TEST_ENABLED:'false',PRIVATE_TEST_REQUIRED:'false',RENTINORBIT_SCT_TEST_RUNTIME:'false',RENTINORBIT_CATALOG_ONLY:'false',
  DB_BACKUP_ENABLED:'false',BACKUP_SCHEDULER_ENABLED:'false',BACKUP_S3_ENABLED:'false',RENTALL_SEED_DEMO_USERS:'false'});
 for(const k of ['DATABASE_URL','RENTINORBIT_DB_PATH','RAILWAY_ENVIRONMENT_ID','RAILWAY_PROJECT_ID','RAILWAY_SERVICE_ID','RAILWAY_VOLUME_MOUNT_PATH','PERSISTENT_DATA_DIR'])delete process.env[k];
 const d=await import('../db.js');db=d.db;if(db.name!==process.env.DB_PATH)throw Error('WRONG_DATABASE');
 for(const [key,status] of [['booking_received','pending'],['booking_confirmed','confirmed'],['booking_paid','paid'],['booking_cancelled','cancelled'],['booking_returned','returned']]){
  const id=d.enqueueTransactionalEmail({recipient,templateKey:key,subject:`[TEST ${run.slice(0,8)}] RentInOrbit ${status} — sintetinė pristatymo patikra`,dedupeKey:`mail-probe:${run}:${key}`,
   payload:{bookingId:`SYNTHETIC-MAIL-${run.slice(0,8)}`,customerName:'TEST',listingTitle:'Sintetinis pranešimas – tikro užsakymo nėra',status,startDate:'2099-01-01',endDate:'2099-01-02',quantity:1,rentalSubtotal:100,total:100,
    message:'Tai sutartas TEST laiškas. Finansinių operacijų ir tikros nuomos nėra.',accountBookingPath:'/?view=my-bookings',bookingUrl:'https://rentinorbit.com/?view=my-bookings'}});
  report.messages.push({templateKey:key,outboxId:id,status:'pending'});
 }
 child=spawn(process.execPath,['server.js'],{stdio:['ignore','ignore','ignore'],env:{...process.env,HOST:'127.0.0.1',PORT:'32898',
  APP_URL:'https://rentinorbit.com',PUBLIC_BASE_URL:'https://rentinorbit.com',EMAIL_PROVIDER:'resend',EMAIL_WORKER_ENABLED:'true',EMAIL_WORKER_BATCH_SIZE:'5',EMAIL_WORKER_INTERVAL_MS:'5000',EMAIL_MAX_ATTEMPTS:'1',
  STRIPE_SECRET_KEY:'',STRIPE_PUBLISHABLE_KEY:'',STRIPE_WEBHOOK_SECRET:'',STRIPE_CONNECT_WEBHOOK_SECRET:'',RENTINORBIT_ISOLATED_RECOVERY_PROBE:'false'}});
 for(let i=0;i<100;i++){
  for(const item of report.messages){const r=db.prepare('SELECT provider_id FROM email_delivery_receipts WHERE outbox_id=?').get(item.outboxId);if(r)item.providerId=r.provider_id;}
  if(report.messages.every(x=>x.providerId))break;if(child.exitCode!==null)throw Error('ISOLATED_MAIL_WORKER_STOPPED');await sleep(300);
 }
 for(let i=0;i<30;i++){
  for(const item of report.messages){
   if(!item.providerId){item.status=db.prepare('SELECT status FROM email_outbox WHERE id=?').get(item.outboxId)?.status||'missing';continue;}
   const r=await fetch('https://api.resend.com/emails/'+item.providerId,{headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY}});
   if(!r.ok){item.status='delivery_read_http_'+r.status;continue;}const mail=await r.json();
   if(mail.id!==item.providerId||!mail.to?.includes(recipient))throw Error('MAIL_READBACK_MISMATCH');item.status=mail.last_event||'provider_accepted';
  }
  if(report.messages.every(x=>['delivered','opened','clicked'].includes(x.status)))break;await sleep(1500);
 }
 report.delivered=report.messages.every(x=>['delivered','opened','clicked'].includes(x.status));
}catch(e){report.blocker=String(e.code||e.message).slice(0,160);}
finally{child?.kill('SIGTERM');if(child)await new Promise(r=>{if(child.exitCode!==null)return r();child.once('exit',r);setTimeout(r,2000)});if(db?.open)db.close();fs.rmSync(folder,{recursive:true,force:true});}
console.log(JSON.stringify(report));
