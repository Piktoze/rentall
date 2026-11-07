import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
const filename=path.resolve('./rentinorbit-transfer-v206-test.sqlite');
// This test runs during a staging BUILD; it must never use the Railway volume
// or inherit deployed service credentials/settings for its temporary database.
process.env.NODE_ENV='test';
for(const name of ['RAILWAY_ENVIRONMENT_ID','RAILWAY_PROJECT_ID','RAILWAY_SERVICE_ID',
  'RAILWAY_VOLUME_MOUNT_PATH','PERSISTENT_DATA_DIR','DATABASE_URL','RENTINORBIT_DB_PATH'])delete process.env[name];
process.env.DB_PATH=filename;
for(const ext of ['','-wal','-shm'])try{fs.unlinkSync(filename+ext)}catch{}
const {
 db,upsertRentalListing,createRentalBookingAtomic,createRentalAgreement,
 getRentalAgreement,acceptRentalAgreement,getRentalAgreementAcceptanceAudit,setBookingPaymentDetails,
 issueRentalTransferCode,verifyAndConsumeRentalTransferCode,
 getRentalBookingById
}=await import('./db.js');
function errorCode(fn,expected){
 assert.throws(fn,e=>e?.code===expected,'Expected '+expected);
}
try{
 upsertRentalListing({listingId:'transfer-fixture',ownerEmail:'supplier@testing.invalid',title:'Rental test fixture',
   totalQuantity:1,cancellationPolicy:'moderate'});
 createRentalBookingAtomic({bookingId:'transfer-signatures-1',listingId:'transfer-fixture',
   startDate:'2099-04-10',endDate:'2099-04-11',quantity:1,status:'confirmed',
   customerName:'Test Renter',customerEmail:'renter@testing.invalid',orderValue:100});
 setBookingPaymentDetails({bookingId:'transfer-signatures-1',paymentIntentId:'pi_mock_transfer_1',
   paymentStatus:'paid',platformFeeAmount:15,supplierAmount:85,paymentProvider:'stripe'});
 createRentalAgreement({bookingId:'transfer-signatures-1',termsVersion:'test-v2',snapshot:{
   listingTitle:'Rental test fixture',startDate:'2099-04-10',endDate:'2099-04-11',total:100
 }});
 const id='transfer-signatures-1';
 // Neither side signed: renter cannot receive a code; supplier never receives one.
 errorCode(()=>issueRentalTransferCode(id,'pickup','customer'),'OWN_AGREEMENT_REQUIRED');
 errorCode(()=>issueRentalTransferCode(id,'pickup','supplier'),'INVALID_TRANSFER_PURPOSE');
 acceptRentalAgreement(id,'customer',{actorEmail:'renter@testing.invalid',authMethod:'booking_guest_token'});
 assert.equal(getRentalAgreementAcceptanceAudit(id).length,1);
 assert.equal(getRentalAgreementAcceptanceAudit(id)[0].actorEmail,'renter@testing.invalid');
 assert.equal(getRentalAgreementAcceptanceAudit(id)[0].authMethod,'booking_guest_token');
 assert.match(getRentalAgreementAcceptanceAudit(id)[0].snapshotSha256,/^[a-f0-9]{64}$/);
 const customer=issueRentalTransferCode(id,'pickup','customer');
 assert.match(customer.code,/^\d{6}$/);
 assert.equal(getRentalAgreement(id).supplierAcceptedAt,null,'supplier signature is independently required');
 errorCode(()=>issueRentalTransferCode(id,'pickup','supplier'),'INVALID_TRANSFER_PURPOSE');
 // Even a valid renter PIN cannot transfer an item before supplier signs.
 errorCode(()=>verifyAndConsumeRentalTransferCode(id,'pickup',customer.code),'AGREEMENT_REQUIRED');
 assert.equal(getRentalBookingById(id).status,'confirmed');
 acceptRentalAgreement(id,'supplier',{actorEmail:'supplier@testing.invalid',authMethod:'session'});
 assert.equal(getRentalAgreementAcceptanceAudit(id).length,2);
 assert.equal(getRentalAgreementAcceptanceAudit(id).find(v=>v.party==='supplier').actorEmail,'supplier@testing.invalid');
 acceptRentalAgreement(id,'supplier',{actorEmail:'attacker@testing.invalid',authMethod:'session'});
 assert.equal(getRentalAgreementAcceptanceAudit(id).length,2,'repeated acceptance cannot replace audit record');
 // Neither a second supplier PIN nor a wrong renter PIN can complete the transfer.
 errorCode(()=>issueRentalTransferCode(id,'pickup','supplier'),'INVALID_TRANSFER_PURPOSE');
 const wrongCode=customer.code==='000000'?'000001':'000000';
 assert.equal(verifyAndConsumeRentalTransferCode(id,'pickup',wrongCode).ok,false);
 assert.equal(getRentalBookingById(id).status,'confirmed');
 assert.equal(verifyAndConsumeRentalTransferCode(id,'pickup',customer.code).ok,true);
 assert.equal(getRentalBookingById(id).status,'active');
 // A consumed pickup PIN cannot be used twice.
 errorCode(()=>verifyAndConsumeRentalTransferCode(id,'pickup',customer.code),'TRANSFER_NOT_READY');
 errorCode(()=>issueRentalTransferCode(id,'pickup','customer'),'TRANSFER_NOT_READY');
 // Return uses a new renter-only PIN, with condition mandatory.
 const customerReturn=issueRentalTransferCode(id,'return','customer');
 errorCode(()=>issueRentalTransferCode(id,'return','supplier'),'INVALID_TRANSFER_PURPOSE');
 errorCode(()=>verifyAndConsumeRentalTransferCode(id,'return',customerReturn.code),'RETURN_CONDITION_REQUIRED');
 assert.equal(verifyAndConsumeRentalTransferCode(id,'return',customerReturn.code,{
   returnCondition:'good',returnNotes:'Undamaged'
 }).ok,true);
 assert.equal(getRentalBookingById(id).status,'returned');
 console.log('PASS renter-only transfer PIN, both signatures, no replay, recorded return');
}finally{
 db.close();
 for(const ext of ['','-wal','-shm'])try{fs.unlinkSync(filename+ext)}catch{}
}
