// Explicit, temporary staging validation. Never opens or imports the application DB.
import Database from 'better-sqlite3';
import {createPasswordRecovery} from './password-recovery.js';
export function installIsolatedRecoveryProbe({app,env,deliver,limit}){
 if(env.RENTINORBIT_ISOLATED_RECOVERY_PROBE!=='true')return null;
 if(env.RENTINORBIT_STAGING!=='true'||env.STRIPE_MODE!=='test'||! /^[sr]k_test_[A-Za-z0-9_-]{8,}$/.test(env.STRIPE_SECRET_KEY||''))throw new Error('RECOVERY_PROBE_STAGING_TEST_ONLY');
 const runId=env.RECOVERY_PROBE_RUN_ID;
 if(!/^[a-f0-9]{32}$/.test(runId||''))throw new Error('RECOVERY_PROBE_RUN_ID_REQUIRED');
 if(env.EMAIL_PROVIDER!=='resend'||!env.RESEND_API_KEY)throw new Error('RECOVERY_PROBE_RESEND_REQUIRED');
 const prefix='/__recovery_probe/'+runId;
 const origin='https://rentall-staging.up.railway.app';
 const db=new Database(':memory:');
 db.exec(`CREATE TABLE app_users(user_id TEXT PRIMARY KEY,email TEXT,role TEXT,password_salt TEXT,password_hash TEXT,updated_at TEXT);
 CREATE TABLE app_sessions(user_id TEXT);`);
 // Only an isolated synthetic identity. Never load, authenticate or modify the real account.
 db.prepare('INSERT INTO app_users(user_id,email,role) VALUES(?,?,?)').run('synthetic-recovery-'+runId,'ieva.zalpyte@gmail.com','customer');
 let queued,deliveryStatus='pending',consumed=false;
 const recovery=createPasswordRecovery({db,origin,secret:env.SESSION_SECRET,resetPath:prefix,
  enqueue:item=>{queued={...item,id:'isolated-recovery-'+runId,subject:'[TEST] '+item.subject,deliveryIdempotencyKey:'recovery-probe-'+runId};}});
 recovery.request('ieva.zalpyte@gmail.com');
 const headers=(req,res,next)=>{res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow',
  'Content-Security-Policy':"default-src 'none'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"});next();};
 app.get(prefix,headers,(req,res)=>res.type('html').send('<!doctype html><html lang="lt"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TEST atkūrimo patikra | RentInOrbit</title><h1>Sintetinės TEST paskyros atkūrimas</h1><p>Ši patikra nekeičia veikiančios paskyros slaptažodžio.</p><form><label>Naujas TEST slaptažodis <input type="password" minlength="8" maxlength="256" autocomplete="new-password" required></label><button>Patvirtinti TEST atkūrimą</button></form><p role="status"></p><script src="'+prefix+'/client.js" defer></script></html>'));
 app.get(prefix+'/client.js',headers,(req,res)=>res.type('js').send(`const t=new URLSearchParams(location.hash.slice(1)).get('token');history.replaceState(null,'',location.pathname);const f=document.querySelector('form');f.onsubmit=async e=>{e.preventDefault();const b=f.querySelector('button');b.disabled=true;try{const r=await fetch(location.pathname+'/consume',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:t,password:f.querySelector('input').value})});document.querySelector('[role=status]').textContent=r.ok?'TEST slaptažodis pakeistas. Nuoroda panaudota.':'Nuoroda nebegalioja arba slaptažodis netinkamas.';if(r.ok){f.reset();f.hidden=true;}}catch{document.querySelector('[role=status]').textContent='Ryšio klaida.';}finally{b.disabled=false;}};`));
 app.post(prefix+'/consume',headers,limit,(req,res)=>{
  if(req.headers.origin&&req.headers.origin!==origin)return res.status(403).json({ok:false});
  const ok=recovery.consume(req.body?.token,req.body?.password);if(ok)consumed=true;
  res.status(ok?200:400).json({ok});
 });
 app.get(prefix+'/status',headers,(req,res)=>res.json({synthetic:true,storage:'memory',deliveryStatus,consumed}));
 let sending=false;
 const send=async()=>{
  if(sending)return;sending=true;
  try{await deliver(queued);deliveryStatus='provider_accepted';}
  catch{deliveryStatus='failed';console.warn(JSON.stringify({type:'isolated_recovery_probe_delivery_failed'}));}
 };
 return {send,close:()=>db.close(),status:()=>({deliveryStatus,consumed})};
}
