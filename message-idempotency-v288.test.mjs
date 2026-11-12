import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const filename=path.resolve('./rentinorbit-message-idempotency-v288-test.sqlite');
process.env.NODE_ENV='test';
for(const key of ['DATABASE_URL','RENTINORBIT_DB_PATH','PERSISTENT_DATA_DIR','RAILWAY_VOLUME_MOUNT_PATH','RAILWAY_ENVIRONMENT_ID','RAILWAY_PROJECT_ID','RAILWAY_SERVICE_ID','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET'])delete process.env[key];
process.env.DB_PATH=filename;
for(const ext of ['','-wal','-shm'])try{fs.unlinkSync(filename+ext)}catch{}
const {db,upsertRentalListing,createOrGetRentalConversation,addRentalMessage,listRentalMessages}=await import('./db.js');
try{
 upsertRentalListing({listingId:'msg-v288',ownerEmail:'supplier@example.invalid',title:'Messages fixture',totalQuantity:1});
 const c=createOrGetRentalConversation({listingId:'msg-v288',customerEmail:'renter@example.invalid',supplierEmail:'supplier@example.invalid'});
 const request='rio_test_message_000001';
 const args={conversationId:c.conversationId,senderEmail:'renter@example.invalid',senderRole:'customer',body:'Sveiki, rezervacija patvirtinta.',clientMessageId:request};
 const first=addRentalMessage(args);
 const replay=addRentalMessage(args);
 assert.equal(first.idempotentReplay,false);
 assert.equal(replay.idempotentReplay,true);
 assert.equal(first.messageId,replay.messageId,'Identical request must return the original message ID');
 assert.equal(listRentalMessages(c.conversationId).length,1,'One request ID can save only one message');
 assert.throws(()=>addRentalMessage({...args,body:'Bandymas pakeisti tekstą'}),e=>e?.code==='MESSAGE_REQUEST_CONFLICT');
 assert.equal(listRentalMessages(c.conversationId).length,1);
 const supplier=addRentalMessage({...args,senderEmail:'supplier@example.invalid',senderRole:'supplier',body:'Patvirtinu.'});
 assert.notEqual(first.messageId,supplier.messageId,'Different sender may use a separate scoped request');
 const next=addRentalMessage({...args,clientMessageId:'rio_test_message_000002'});
 assert.equal(next.idempotentReplay,false,'New request identifier permits deliberate repeat text');
 assert.equal(listRentalMessages(c.conversationId).length,3);
 assert.throws(()=>addRentalMessage({...args,clientMessageId:'bad'}),e=>e?.code==='INVALID_MESSAGE_REQUEST_ID');
 assert.throws(()=>addRentalMessage({...args,body:' '}),e=>e?.code==='INVALID_MESSAGE_BODY');
 assert.throws(()=>addRentalMessage({...args,body:'x'.repeat(2001)}),e=>e?.code==='INVALID_MESSAGE_BODY');
 const app=fs.readFileSync('app.js','utf8'),server=fs.readFileSync('server.js','utf8');
 assert.match(app,/list\.querySelectorAll\('\.v172-booking-message'\)/);
 assert.match(app,/clientMessageId:pendingKey/);
 assert.match(server,/clientMessageId:req\.body\?\.clientMessageId/);
 assert.match(server,/if\(recipient && !message\.idempotentReplay\)/);
 console.log('PASS messages v288: booking button wired, replay deduplication, sender scope, conflict and length limits');
}finally{
 db.close();
 for(const ext of ['','-wal','-shm'])try{fs.unlinkSync(filename+ext)}catch{}
}
