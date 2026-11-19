import crypto from 'node:crypto';
import express from 'express';
import {privateTestSettings} from './private-test-mode.js';

const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function installPrivateTestAccess(app,{env=process.env,send,now=Date.now}={}){
 const settings=privateTestSettings(env);
 if(!settings.requested){
  if(env.PRIVATE_TEST_REQUIRED==='true')throw new Error('PRIVATE_TEST_ACCESS_REQUIRED');
  return null;
 }
 if(!settings.valid)throw new Error('PRIVATE_TEST_CONFIGURATION_INVALID');
 const origin=new URL(env.APP_URL).origin, challenges=new Map(),sessions=new Map(),limits=new Map();
 const digestKey=crypto.randomBytes(32);
 const digest=(id,code)=>crypto.createHmac('sha256',digestKey).update(id+':'+code).digest('hex');
 const limited=(key,max,ms)=>{const t=now();let b=limits.get(key);if(!b||b.until<=t){b={count:0,until:t+ms};limits.set(key,b);}return ++b.count>max;};
 function sweep(){for(const map of [challenges,sessions,limits])for(const [k,v]of map)if((v.until||0)<=now())map.delete(k);}
 const prefix='/__test-access';
 app.use((req,res,next)=>{
  sweep();res.set('Cache-Control','private, no-store');
  const originalWriteHead=res.writeHead;res.writeHead=function(...args){this.setHeader('Cache-Control','private, no-store');return originalWriteHead.apply(this,args);};
  if(req.path==='/healthz'&&req.method==='GET')return next();
  if(req.path==='/api/stripe/webhook'&&req.method==='POST')return next(); // Signature and TEST livemode checks remain mandatory downstream.
  const token=String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('__Host-rio_test='))?.slice(16);
  const session=token&&sessions.get(hash(token));
  if(session&&session.until>now())req.privateTestIdentity={email:session.email};
  if(req.path===prefix||req.path.startsWith(prefix+'/'))return next();
  if(!req.privateTestIdentity){
   if(req.method==='GET'&&!req.path.startsWith('/api/')&&req.accepts('html'))return res.redirect(303,prefix);
   return res.status(401).json({code:'PRIVATE_TEST_ACCESS_REQUIRED'});
  }
  if(req.path==='/service-worker.js')return res.type('js').send("self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('rentinorbit-')).map(k=>caches.delete(k)))).then(()=>self.registration.unregister())));");
  return next();
 });
 app.get(prefix,(req,res)=>{
  const nonce=crypto.randomBytes(18).toString('base64');
  res.set('Content-Security-Policy',`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`);
  res.type('html').send(`<!doctype html><html lang="lt"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Privatus RentInOrbit TEST</title><style>body{font:18px system-ui;max-width:440px;margin:8vh auto;padding:24px;color:#15354f}input,button{font:inherit;padding:12px;box-sizing:border-box;width:100%;margin:8px 0}button{cursor:pointer;background:#15354f;color:white;border:0;border-radius:8px}p{line-height:1.5}</style><h1>Privatus RentInOrbit TEST</h1><p>Prieiga tik pakviestiems bandytojams. Mokėjimai bandomieji. Duomenys laikini.</p><form id="request"><label>El. paštas<input id="email" type="email" autocomplete="email" required></label><button>Gauti prieigos kodą</button></form><form id="verify" hidden><label>8 skaitmenų kodas<input id="code" inputmode="numeric" pattern="[0-9]{8}" autocomplete="one-time-code" required></label><button>Atidaryti visą svetainę</button></form><p id="status" role="status"></p><script nonce="${nonce}">let challenge;const status=document.getElementById('status');document.getElementById('request').onsubmit=async e=>{e.preventDefault();try{const r=await fetch('${prefix}/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.getElementById('email').value})});const j=await r.json();if(!r.ok)throw Error();challenge=j.challenge;document.getElementById('verify').hidden=false;status.textContent='Jei adresas pakviestas, kodą gausi el. paštu. Jis galioja 10 minučių.';}catch{status.textContent='Nepavyko. Pabandyk vėliau.';}};document.getElementById('verify').onsubmit=async e=>{e.preventDefault();const r=await fetch('${prefix}/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({challenge,code:document.getElementById('code').value})});if(r.ok)location.href='/';else status.textContent='Kodas netinkamas arba nebegalioja.';};</script></html>`);
 });
 app.use(prefix,(req,res,next)=>{
  if(req.method!=='POST')return res.sendStatus(404);
  if(req.get('origin')!==origin)return res.sendStatus(403);
  if(limited('global:'+req.ip,25,600000))return res.sendStatus(429);
  next();
 },express.json({limit:'2kb'}));
 app.post(prefix+'/request',(req,res)=>{
  const email=String(req.body?.email||'').trim().toLowerCase().slice(0,254);
  if(limited('request:'+req.ip,5,600000))return res.sendStatus(429);
  const id=crypto.randomBytes(24).toString('hex'),code=String(crypto.randomInt(0,100000000)).padStart(8,'0');
  if(settings.emails.includes(email)&&!limited('email:'+email,3,600000)){
   challenges.set(id,{email,digest:digest(id,code),attempts:0,until:now()+600000});
   // Never persist or log codes; mail delivery failures do not disclose membership.
   Promise.resolve().then(()=>send({recipient:email,subject:'[TEST] RentInOrbit – privatus prieigos kodas',templateKey:'private_test_access',payload:{code},deliveryIdempotencyKey:'private-access-'+id})).catch(()=>{challenges.delete(id);});
  }
  res.status(202).json({challenge:id});
 });
 app.post(prefix+'/verify',(req,res)=>{
  const id=String(req.body?.challenge||''),code=String(req.body?.code||''),c=challenges.get(id);
  if(!c||++c.attempts>5||!/^\d{8}$/.test(code)||!crypto.timingSafeEqual(Buffer.from(c.digest),Buffer.from(digest(id,code)))){
   if(c&&c.attempts>=5)challenges.delete(id);
   return res.status(400).json({code:'INVALID_OR_EXPIRED_CODE'});
  }
  challenges.delete(id);const token=crypto.randomBytes(32).toString('hex');
  sessions.set(hash(token),{email:c.email,until:now()+43200000});
  res.set('Set-Cookie',`__Host-rio_test=${token}; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`).json({ok:true});
 });
 app.post(prefix+'/logout',(req,res)=>{
  const cookie=String(req.headers.cookie||'').match(/(?:^|;\s*)__Host-rio_test=([^;]+)/)?.[1];if(cookie)sessions.delete(hash(cookie));
  res.set('Set-Cookie','__Host-rio_test=; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=0').json({ok:true});
 });
 return {settings};
}
