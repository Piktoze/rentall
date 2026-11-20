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
test.after(()=>d.closeDatabase());
