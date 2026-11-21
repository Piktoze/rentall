import test from 'node:test';import assert from 'node:assert/strict';
process.env.NODE_ENV='test';process.env.DB_PATH=':memory:';process.env.PRIVATE_TEST_ENABLED='false';process.env.PRIVATE_TEST_REQUIRED='false';
for(const k of ['DATABASE_URL','RENTINORBIT_DB_PATH','RAILWAY_VOLUME_MOUNT_PATH','RAILWAY_ENVIRONMENT_ID','RAILWAY_SERVICE_ID','RAILWAY_PROJECT_ID'])delete process.env[k];
const d=await import('./db.js');
test('provider receipt binds immutable outbox identity; acceptance is not delivery',()=>{
 const id=d.enqueueTransactionalEmail({recipient:'synthetic@example.test',templateKey:'booking_returned',subject:'TEST',dedupeKey:'synthetic-receipt'});
 assert.equal(d.completeTransactionalEmail(id,{provider:'resend',id:'11111111-1111-1111-1111-111111111111'}),true);
 assert.equal(d.db.prepare('SELECT provider_id FROM email_delivery_receipts WHERE outbox_id=?').get(id).provider_id,'11111111-1111-1111-1111-111111111111');
 assert.throws(()=>d.completeTransactionalEmail(id,{provider:'resend',id:'22222222-2222-2222-2222-222222222222'}),/EMAIL_RECEIPT_CONFLICT/);
 assert.equal(d.db.prepare('SELECT COUNT(*) AS n FROM email_delivery_receipts').get().n,1);
 assert.equal(d.listEmailOutbox().find(x=>x.id===id).status,'sent');
});
test('restart reuses one delivery key, binds content and refuses automatic retry beyond provider retention',()=>{
 const id=d.enqueueTransactionalEmail({recipient:'synthetic-restart@example.test',templateKey:'booking_confirmed',subject:'TEST',dedupeKey:'synthetic-restart'});
 const now=Date.now(),first=d.claimTransactionalEmails({now}).find(x=>x.id===id);assert.ok(first.deliveryIdempotencyKey);const hash='a'.repeat(64);
 assert.equal(d.bindTransactionalEmailPayload(id,first.deliveryIdempotencyKey,hash,now),true);
 assert.equal(d.recoverInterruptedTransactionalEmails(),1);
 const retry=d.claimTransactionalEmails({now:now+60000}).find(x=>x.id===id);assert.equal(retry.deliveryIdempotencyKey,first.deliveryIdempotencyKey);
 assert.equal(d.bindTransactionalEmailPayload(id,retry.deliveryIdempotencyKey,hash,now+60000),true);
 assert.throws(()=>d.bindTransactionalEmailPayload(id,retry.deliveryIdempotencyKey,'b'.repeat(64),now+60000),/PAYLOAD_CHANGED/);
 d.recoverInterruptedTransactionalEmails();assert.equal(d.claimTransactionalEmails({now:now+24*3600000}).some(x=>x.id===id),false);
 assert.equal(d.listEmailOutbox().find(x=>x.id===id).lastError,'EMAIL_DELIVERY_RECONCILIATION_REQUIRED');
});
test('legacy uncertain mail cannot gain a fresh provider key and be silently resent',()=>{
 const id=d.enqueueTransactionalEmail({recipient:'synthetic-legacy@example.test',templateKey:'booking_confirmed',subject:'TEST'});
 d.db.prepare('UPDATE email_outbox SET attempts=1 WHERE id=?').run(id);
 assert.equal(d.claimTransactionalEmails().some(x=>x.id===id),false);
 assert.equal(d.db.prepare('SELECT COUNT(*) n FROM email_delivery_attempts WHERE outbox_id=?').get(id).n,0);
 assert.equal(d.listEmailOutbox().find(x=>x.id===id).lastError,'EMAIL_DELIVERY_RECONCILIATION_REQUIRED');
});
test.after(()=>d.closeDatabase());
