import test,{after} from 'node:test';import assert from 'node:assert/strict';import express from 'express';import http from 'node:http';
process.env.NODE_ENV='test';process.env.DB_PATH=':memory:';process.env.PRIVATE_TEST_ENABLED='false';
for(const k of ['DATABASE_URL','RENTINORBIT_DB_PATH','RAILWAY_ENVIRONMENT_ID','RAILWAY_PROJECT_ID','RAILWAY_SERVICE_ID','RAILWAY_VOLUME_MOUNT_PATH'])delete process.env[k];
const d=await import('./db.js');const {createIsolatedStripeTestClient}=await import('./modules/isolated-stripe-test-client.js');
const {createSctSupplierOnboarding}=await import('./modules/sct-supplier-onboarding.js');const {installSctOnboardingRoutes}=await import('./modules/sct-onboarding-routes.js');
const key='sk_test_synthetic_onboarding_never_sent',stripe=createIsolatedStripeTestClient(key),accounts=[],created=[],linked=[],connected=[],sessions=[];let failAfterCreate=false;
stripe.accounts.retrieve=async()=>({id:'acct_syntheticPlatform'});
stripe.v2.core.accounts.create=async(payload,options)=>{let a=accounts.find(x=>x.key===options.idempotencyKey);if(a)return a;
 a={...payload,key:options.idempotencyKey,id:'acct_recipient'+(accounts.length+1),livemode:false,requirements:{entries:[{description:'identity.attestations.terms_of_service.account'}]}};accounts.push(a);created.push(payload);if(failAfterCreate)throw Error('Synthetic lost response');return a;};
stripe.v2.core.accounts.retrieve=async id=>accounts.find(x=>x.id===id);
stripe.v2.core.accountLinks.create=async payload=>{linked.push(payload);return {account:payload.account,livemode:false,url:'https://connect.stripe.com/setup/synthetic-private',expires_at:123456789};};
stripe.accountSessions.create=async payload=>{sessions.push(payload);return {account:payload.account,client_secret:'acs_synthetic_private'};};
const runtime={newBookingRecipient:()=>{throw Error('not mapped')},registerRecipient:async(...args)=>connected.push(args)};
const env={STRIPE_MODE:'test',STRIPE_SECRET_KEY:key,APP_URL:'https://rentinorbit.com'};
const service=await createSctSupplierOnboarding({db:d.db,stripe,env,runtime});
const users={};for(const [name,role] of [['supplier','supplier'],['other','supplier'],['renter','customer']]){const u=d.createAppUser({email:name+'@example.test',password:'SyntheticOnboarding123!',role,displayName:name});users[name]={user:u,session:d.createAppSession(u.userId)};}
const app=express();app.use(express.json());const auth=(...roles)=>(req,res,next)=>{const token=req.headers.cookie?.split('=')[1],u=d.getAppUserBySessionToken(token);if(!u)return res.sendStatus(401);if(!roles.includes(u.role))return res.sendStatus(403);req.appUser=u;next();};
installSctOnboardingRoutes(app,{enabled:()=>true,getService:async()=>service,requireRole:auth});
const server=http.createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const request=async(path,{user='supplier',method='GET',body}={})=>{const r=await fetch(base+'/api/stripe/connect/'+path,{method,headers:{'Content-Type':'application/json',...(user?{cookie:'rentinorbit_session='+users[user].session.token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {r,data:await r.json().catch(()=>null)};};
after(()=>{server.close();d.closeDatabase();});
const input={country:'LT',legalEntityType:'individual',onboardingRequested:true};
test('guest/customer denied; authenticated supplier creates only a server-owned SCT recipient',async()=>{
 assert.equal((await request('create-account',{method:'POST',user:null,body:input})).r.status,401);
 assert.equal((await request('create-account',{method:'POST',user:'renter',body:input})).r.status,403);
 const x=await request('create-account',{method:'POST',body:{...input,userId:users.other.user.userId,email:'attacker@example.test',accountId:'acct_attacker'}});
 assert.equal(x.r.status,200,JSON.stringify(x.data));assert.equal(x.r.headers.get('cache-control'),'private, no-store');
 assert.equal(created[0].contact_email,users.supplier.user.email);assert.equal(created[0].metadata.rentinorbitUserId,users.supplier.user.userId);
 assert.equal(created[0].configuration.merchant,undefined);assert.equal(created[0].defaults.responsibilities.fees_collector,'application');
 assert.equal(JSON.stringify(created[0]).includes('tos_acceptance'),false);assert.equal(x.data.payoutsEnabled,false);
});
test('repeated creation reuses account; another supplier cannot obtain its onboarding link',async()=>{
 await request('create-account',{method:'POST',body:input});assert.equal(accounts.length,1);
 const other=await request('hosted-onboarding-link',{user:'other',method:'POST',body:{accountId:accounts[0].id}});assert.equal(other.r.status,409);assert.equal(linked.length,0);
 const own=await request('hosted-onboarding-link',{method:'POST',body:{accountId:'acct_attacker',returnUrl:'https://evil.example'}});assert.equal(own.r.status,200);
 assert.equal(linked[0].account,accounts[0].id);assert.ok(linked[0].use_case.account_onboarding.return_url.startsWith('https://rentinorbit.com/'));
 const session=await request('onboarding-link',{method:'POST'});assert.equal(session.r.status,200);assert.equal(sessions[0].account,accounts[0].id);
});
test('only provider-verified active transfers enroll recipient; browser completion is not bank readiness',async()=>{
 assert.equal(connected.length,0);const a=accounts[0];a.requirements={entries:[]};a.configuration.recipient.capabilities.stripe_balance.stripe_transfers.status='active';
 const x=await request('status');assert.equal(x.data.recipientTransfersReady,true);assert.equal(connected.length,1);assert.equal(x.data.bankPayoutsReady,false);assert.equal(x.data.payoutsEnabled,false);
 a.livemode=true;assert.equal((await request('status')).r.status,409);a.livemode=false;
});
test('uncertain account creation retries with original key and never creates a second recipient',async()=>{
 failAfterCreate=true;assert.equal((await request('create-account',{user:'other',method:'POST',body:input})).r.status,409);
 failAfterCreate=false;assert.equal((await request('create-account',{user:'other',method:'POST',body:input})).r.status,200);assert.equal(accounts.length,2);
 assert.equal(d.db.prepare('SELECT count(*) n FROM sct_supplier_onboarding').get().n,2);
});

test('existing private TEST owner pin is read without creating or reassigning a Stripe account',async()=>{
 const owner=d.createAppUser({email:'pinned-owner@example.test',password:'SyntheticOwner123!',role:'admin',displayName:'Pinned TEST owner'});
 const existing={...accounts[0],id:'acct_existingPrivatePin',metadata:{},requirements:{entries:[]}};accounts.push(existing);
 const pinnedRuntime={newBookingRecipient:()=>({account_id:existing.id}),registerRecipient:async()=>{}};
 const pinned=await createSctSupplierOnboarding({db:d.db,stripe,env:{...env,PRIVATE_TEST_ENABLED:'true',PRIVATE_TEST_OWNER_EMAIL:owner.email,PRIVATE_TEST_RECIPIENT_ID:existing.id},runtime:pinnedRuntime});
 const before=created.length,status=await pinned.status(owner);assert.equal(status.recipientTransfersReady,true);assert.equal(status.accountId,existing.id);
 await pinned.create(owner,input);assert.equal(created.length,before);
 assert.equal(d.db.prepare('SELECT count(*) n FROM sct_supplier_onboarding WHERE user_id=?').get(owner.userId).n,0);
});
