import crypto from 'node:crypto';

export const RESET_REPLY=Object.freeze({message:'Jei paskyra egzistuoja, išsiuntėme slaptažodžio atkūrimo nuorodą.'});
const digest=v=>crypto.createHash('sha256').update(v).digest('hex');
const validToken=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const email=v=>String(v||'').trim().toLowerCase().slice(0,254);
const keyFor=secret=>crypto.hkdfSync('sha256',secret,'rentinorbit','password-recovery-outbox-v1',32);
export function decodeResetMail(payload,secret){
 const [iv,tag,body]=String(payload?.sealed||'').split('.').map(x=>Buffer.from(x||'','hex'));
 const decipher=crypto.createDecipheriv('aes-256-gcm',keyFor(secret),iv);
 decipher.setAuthTag(tag);
 return JSON.parse(Buffer.concat([decipher.update(body),decipher.final()]).toString('utf8'));
}
export function createPasswordRecovery({db,enqueue,origin,secret,now=Date.now,eligible=()=>true,resetPath='/password-reset'}){
 const url=new URL(origin);
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)
  throw new Error('A fixed application origin is required');
 if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('HTTPS required');
 if(typeof secret!=='string'||secret.length<32)throw new Error('Password recovery encryption key unavailable');
 if(typeof resetPath!=='string'||!/^\/[A-Za-z0-9/_-]+$/.test(resetPath))throw new Error('Invalid reset path');
 // Lazy installation: registering routes does not migrate a mounted /data database.
 let installed=false;
 function install(){if(installed)return;db.exec(`CREATE TABLE IF NOT EXISTS password_reset_tokens(
  token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL UNIQUE,expires_ms INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES app_users(user_id) ON DELETE CASCADE);
  CREATE TABLE IF NOT EXISTS password_reset_requests(email_hash TEXT PRIMARY KEY,
  window_ms INTEGER NOT NULL,requests INTEGER NOT NULL);`);installed=true;}
 function seal(data){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',keyFor(secret),iv);
  const b=Buffer.concat([cipher.update(JSON.stringify(data),'utf8'),cipher.final()]);
  return [iv,cipher.getAuthTag(),b].map(x=>x.toString('hex')).join('.');}
 function request(address){
  install();const addressKey=digest(email(address)),at=now();
  // This bucket is used for both existing and nonexistent addresses.
  db.transaction(()=>{
   db.prepare('DELETE FROM password_reset_requests WHERE window_ms<?').run(at-86400000);
   db.prepare('DELETE FROM password_reset_tokens WHERE expires_ms<=?').run(at);
   const prior=db.prepare('SELECT * FROM password_reset_requests WHERE email_hash=?').get(addressKey);
   if(prior&&prior.window_ms>at-3600000&&prior.requests>=3)return;
   db.prepare(`INSERT INTO password_reset_requests VALUES(?,?,1) ON CONFLICT(email_hash)
    DO UPDATE SET window_ms=excluded.window_ms,requests=?`).run(addressKey,prior&&prior.window_ms>at-3600000?prior.window_ms:at,
     prior&&prior.window_ms>at-3600000?prior.requests+1:1);
   const user=db.prepare('SELECT user_id,email,role FROM app_users WHERE email=? COLLATE NOCASE').get(email(address));
   if(!user||!eligible(user))return;
   const token=crypto.randomBytes(32).toString('hex'),hash=digest(token);
   db.prepare(`INSERT INTO password_reset_tokens VALUES(?,?,?) ON CONFLICT(user_id)
    DO UPDATE SET token_hash=excluded.token_hash,expires_ms=excluded.expires_ms`).run(hash,user.user_id,at+30*60000);
   enqueue({recipient:user.email,templateKey:'password_reset',subject:'RentInOrbit – slaptažodžio atkūrimas',
    dedupeKey:'password-reset:'+hash,
    payload:{sealed:seal({url:new URL(resetPath+'#token='+token,url).toString(),expiresAt:new Date(at+30*60000).toISOString()})}});
  }).immediate();
  return RESET_REPLY;
 }
 function consume(token,password){
  if(!validToken(token)||typeof password!=='string'||password.length<8||password.length>256)return false;
  install();const hash=digest(token),at=now();
  // Compute the password hash before taking the short write lock, even for an invalid token.
  const salt=crypto.randomBytes(16).toString('hex');
  const encoded=crypto.scryptSync(password,Buffer.from(salt,'hex'),64).toString('hex');
  return db.transaction(()=>{
   const row=db.prepare('SELECT user_id FROM password_reset_tokens WHERE token_hash=? AND expires_ms>?').get(hash,at);
   if(!row)return false;
   const user=db.prepare('SELECT user_id,email,role FROM app_users WHERE user_id=?').get(row.user_id);
   if(!user||!eligible(user))return false;
   if(db.prepare('DELETE FROM password_reset_tokens WHERE token_hash=? AND expires_ms>?').run(hash,at).changes!==1)return false;
   db.prepare('UPDATE app_users SET password_salt=?,password_hash=?,updated_at=? WHERE user_id=?')
    .run(salt,encoded,new Date(at).toISOString(),row.user_id);
   db.prepare('DELETE FROM app_sessions WHERE user_id=?').run(row.user_id);
   return true;
  }).immediate();
 }
 return {request,consume};
}
