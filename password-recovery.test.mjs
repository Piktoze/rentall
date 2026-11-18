import test from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';import Database from 'better-sqlite3';
import {createPasswordRecovery,decodeResetMail} from './modules/password-recovery.js';
const secret='A-strong-synthetic-encryption-secret-12345';
function fixture(){const db=new Database(':memory:');let time=1000000;const queue=[];
 db.exec(`CREATE TABLE app_users(user_id TEXT PRIMARY KEY,email TEXT,role TEXT,password_salt TEXT,password_hash TEXT,updated_at TEXT);
 CREATE TABLE app_sessions(user_id TEXT,session_hash TEXT);`);
 db.prepare('INSERT INTO app_users VALUES(?,?,?,?,?,?)').run('u1','renter@example.test','customer','00','old','');
 db.prepare('INSERT INTO app_sessions VALUES(?,?)').run('u1','old-session');
 const reset=createPasswordRecovery({db,secret,origin:'https://rentinorbit.com',now:()=>time,
  enqueue:item=>{queue.push(item);return queue.length;}});
 return {db,queue,reset,advance:()=>{time+=31*60000;},token:()=>new URL(decodeResetMail(queue.at(-1).payload,secret).url).hash.slice(7)};
}
test('identical existing/absent responses; encrypted outbox, only hashed DB token; single-use reset revokes sessions',()=>{
 const f=fixture();assert.deepEqual(f.reset.request('missing@example.test'),f.reset.request('RENTER@example.test'));
 assert.equal(f.queue.length,1);const token=f.token();assert.equal(token.length,64);
 assert.equal(JSON.stringify(f.queue).includes(token),false);
 assert.equal(f.db.prepare('SELECT token_hash FROM password_reset_tokens').get().token_hash,
  crypto.createHash('sha256').update(token).digest('hex'));
 assert.equal(f.reset.consume(token,'NewSecretPassword123'),true);assert.equal(f.reset.consume(token,'OtherSecret123'),false);
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM app_sessions').get().n,0);
 const u=f.db.prepare('SELECT * FROM app_users').get();assert.equal(u.password_hash,
  crypto.scryptSync('NewSecretPassword123',Buffer.from(u.password_salt,'hex'),64).toString('hex'));
});
test('expiry, replacement, malformed tokens and per-email limits apply without account enumeration',()=>{
 const f=fixture();f.reset.request('renter@example.test');const old=f.token();f.reset.request('renter@example.test');
 assert.equal(f.reset.consume(old,'NewSecret123'),false);const current=f.token();f.advance();
 assert.equal(f.reset.consume(current,'NewSecret123'),false);assert.equal(f.reset.consume('invalid','NewSecret123'),false);
 const g=fixture();for(let i=0;i<8;i++){g.reset.request('renter@example.test');g.reset.request('absent@example.test');}
 assert.equal(g.queue.length,3);assert.equal(g.db.prepare('SELECT COUNT(*) n FROM password_reset_requests').get().n,2);
});
test('outbox failure rolls back token issuance; authenticated encryption rejects tampering',()=>{
 const f=fixture();const r=createPasswordRecovery({db:f.db,secret,origin:'https://rentinorbit.com',enqueue:()=>{throw Error('offline');}});
 assert.throws(()=>r.request('renter@example.test'));assert.equal(f.db.prepare('SELECT COUNT(*) n FROM password_reset_tokens').get().n,0);
 f.reset.request('renter@example.test');assert.throws(()=>decodeResetMail(f.queue[0].payload,'wrong secret that is at least 32 characters'));
});
