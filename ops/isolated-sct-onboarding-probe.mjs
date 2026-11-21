// Read-only existing TEST recipient + one private TEST onboarding link. No account creation,
// terms acceptance, financial request, real email, historical DB access or /data writes.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';import express from 'express';import http from 'node:http';
import {createIsolatedStripeTestClient} from '../modules/isolated-stripe-test-client.js';
import {createSctSupplierOnboarding} from '../modules/sct-supplier-onboarding.js';import {installSctOnboardingRoutes} from '../modules/sct-onboarding-routes.js';
const run=process.env.RENTINORBIT_SCT_ONBOARDING_PROBE_RUN_ID,key=process.env.STRIPE_SECRET_KEY,pin=process.env.PRIVATE_TEST_RECIPIENT_ID;
if(!/^[a-f0-9]{32}$/.test(run||'')||process.env.RAILWAY_ENVIRONMENT_ID!=='ca5aa000-83a9-40b9-b9b6-74b3602f3dde'||process.env.RENTINORBIT_STAGING!=='true'||process.env.STRIPE_MODE!=='test'||!/^sk_test_/.test(key||'')||pin!=='acct_1UdAsYLM72k4RDTw')throw Error('ONBOARDING_PROBE_TEST_STAGING_ONLY');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'rio-onboarding-probe-'));let d,server;
try{
 Object.assign(process.env,{NODE_ENV:'test',PRIVATE_TEST_ENABLED:'false',PRIVATE_TEST_REQUIRED:'false',DB_PATH:path.join(root,'fresh.sqlite'),UPLOADS_DIR:path.join(root,'uploads'),DATABASE_URL:'',RENTINORBIT_DB_PATH:'',RAILWAY_VOLUME_MOUNT_PATH:'',RAILWAY_ENVIRONMENT_ID:'',RAILWAY_PROJECT_ID:'',RAILWAY_SERVICE_ID:'',PERSISTENT_DATA_DIR:'',DB_BACKUP_ENABLED:'false',BACKUP_SCHEDULER_ENABLED:'false',EMAIL_PROVIDER:'disabled',EMAIL_WORKER_ENABLED:'false'});
 d=await import('../db.js');const owner=d.createAppUser({email:'isolated-owner@example.test',password:crypto.randomBytes(24).toString('hex'),role:'admin',displayName:'Isolated TEST owner'}),other=d.createAppUser({email:'isolated-other@example.test',password:crypto.randomBytes(24).toString('hex'),role:'supplier'});
 const ownerSession=d.createAppSession(owner.userId),otherSession=d.createAppSession(other.userId),stripe=createIsolatedStripeTestClient(key);
 stripe.v2.core.accounts.create=async()=>{throw Error('PROBE_CANNOT_CREATE_ACCOUNT');};
 const platform=await stripe.accounts.retrieve();if(platform.id!=='acct_1UT4JCLM72MR015z')throw Error('ONBOARDING_PROBE_PLATFORM_ID_MISMATCH');
 const runtime={newBookingRecipient:email=>{if(email!==owner.email)throw Error('Not mapped');return {account_id:pin};},registerRecipient:async(email,id)=>{if(email!==owner.email||id!==pin)throw Error('OWNER_MISMATCH');}};
 const service=await createSctSupplierOnboarding({db:d.db,stripe,runtime,env:{NODE_ENV:'test',STRIPE_MODE:'test',STRIPE_SECRET_KEY:key,PRIVATE_TEST_ENABLED:'true',PRIVATE_TEST_OWNER_EMAIL:owner.email,PRIVATE_TEST_RECIPIENT_ID:pin,APP_URL:'https://rentinorbit.com'}});
 const app=express();app.use(express.json());const auth=(...roles)=>(req,res,next)=>{const user=d.getAppUserBySessionToken(req.headers.cookie?.split('=')[1]);if(!user)return res.sendStatus(401);if(!roles.includes(user.role))return res.sendStatus(403);req.appUser=user;next();};
 installSctOnboardingRoutes(app,{enabled:()=>true,getService:async()=>service,requireRole:auth});server=http.createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const request=(suffix,session,method='GET',body)=>fetch(base+'/api/stripe/connect/'+suffix,{method,headers:{'Content-Type':'application/json',...(session?{cookie:'rentinorbit_session='+session.token}:{})},...(body?{body:JSON.stringify(body)}:{})});
 if((await request('status',null)).status!==401)throw Error('GUEST_NOT_BLOCKED');
 const statusResponse=await request('status',ownerSession);const status=await statusResponse.json();if(statusResponse.status!==200){
  const a=await stripe.v2.core.accounts.retrieve(pin,{include:['identity','configuration.recipient','configuration.merchant','requirements','defaults']});
  console.log(JSON.stringify({type:'isolated_sct_onboarding_layout',mode:a.livemode,recipient:!!a.configuration?.recipient,merchant:!!a.configuration?.merchant,country:a.identity?.country,entityType:a.identity?.entity_type,dashboard:a.dashboard,feesCollector:a.defaults?.responsibilities?.fees_collector,lossesCollector:a.defaults?.responsibilities?.losses_collector,capabilityStatus:a.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status,requested:a.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.requested,code:status.code}));throw Error('OWNER_STATUS_FAILED_'+String(status.code||'UNKNOWN'));}
 if(status.accountId!==pin||status.bankPayoutsReady!==false)throw Error('OWNER_STATUS_MISMATCH');
 if((await request('hosted-onboarding-link',otherSession,'POST',{accountId:pin})).status!==409)throw Error('OTHER_SUPPLIER_NOT_BLOCKED');
 const response=await request('hosted-onboarding-link',ownerSession,'POST',{});if(response.status!==200||response.headers.get('cache-control')!=='private, no-store')throw Error('PRIVATE_ONBOARDING_LINK_FAILED');
 const link=await response.json(),url=new URL(link.url);if(url.protocol!=='https:'||url.hostname!=='connect.stripe.com')throw Error('UNTRUSTED_STRIPE_HOST');
 console.log(JSON.stringify({type:'isolated_sct_onboarding_probe',runId:run,status:'PASS',platformAccount:platform.id,recipientAccount:pin,mode:'test',guestDenied:true,otherSupplierDenied:true,hostedLinkHost:url.hostname,privateNoStore:true,recipientTransfersReady:status.recipientTransfersReady,bankPayoutsReady:false,privateLinkPublished:false,newStripeAccounts:0,termsAccepted:false,financialOperations:0,existingDataTouched:false}));
}catch(error){console.error(JSON.stringify({type:'isolated_sct_onboarding_probe',runId:run,status:'FAIL',code:/^[A-Z0-9_]+$/.test(error.message||'')?error.message:String(error.name||'PROVIDER_ERROR')}));process.exitCode=1;}
finally{if(server)await new Promise(r=>server.close(r));if(d?.db.open)d.closeDatabase();fs.rmSync(root,{recursive:true,force:true});}
