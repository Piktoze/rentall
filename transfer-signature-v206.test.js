import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
const filename=path.resolve('./rentinorbit-transfer-v206-test.sqlite');
process.env.DB_PATH=filename;
for(const ext of ['','-wal','-shm'])try{fs.unlinkSync(filename+ext)}catch{}
const {
 db,upsertRentalListing,createRentalBookingAtomic,createRentalAgreement,
 getRentalAgreement,acceptRentalAgreement,setBookingPaymentDetails,
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
 errorCode(()=>issueRentalTransferCode(id,'pickup','customer'),'OWN_AGREEMENT_REQUIRED');
 errorCode(()=>issueRentalTransferCode(id,'pickup','supplier'),'OWN_AGREEMENT_REQUIRED');
 acceptRentalAgreement(id,'customer');
 const customer=issueRentalTransferCode(id,'pickup','customer');
 assert.match(customer.code,/^\d{6}$/);
 assert.equal(getRentalAgreement(id).supplierAcceptedAt,null,'other signature may remain absent');
 errorCode(()=>issueRentalTransferCode(id,'pickup','supplier'),'OWN_AGREEMENT_REQUIRED');
 // A code does not grant permission to bypass the other participant.
 errorCode(()=>verifyAndConsumeRentalTransferCode(id,'pickup',customer.code,{supplierCode:'000000'}),'AGREEMENT_REQUIRED');
 acceptRentalAgreement(id,'supplier');
 const supplier=issueRentalTransferCode(id,'pickup','supplier');
 assert.match(supplier.code,/^\d{6}$/);
 assert.notEqual(customer.party,supplier.party);
 assert.equal(verifyAndConsumeRentalTransferCode(id,'pickup','000000',{supplierCode:supplier.code}).ok,false);
 assert.equal(getRentalBookingById(id).status,'confirmed');
 assert.equal(verifyAndConsumeRentalTransferCode(id,'pickup',customer.code,{supplierCode:supplier.code}).ok,true);
 assert.equal(getRentalBookingById(id).status,'active');
 errorCode(()=>issueRentalTransferCode(id,'pickup','supplier'),'TRANSFER_NOT_READY');
 // Existing pickup PINs cannot be replayed as return PINs.
 const customerReturn=issueRentalTransferCode(id,'return','customer');
 const supplierReturn=issueRentalTransferCode(id,'return','supplier');
 errorCode(()=>verifyAndConsumeRentalTransferCode(id,'return',customerReturn.code,{supplierCode:supplierReturn.code}),'RETURN_CONDITION_REQUIRED');
 assert.equal(verifyAndConsumeRentalTransferCode(id,'return',customerReturn.code,{
   supplierCode:supplierReturn.code,returnCondition:'good',returnNotes:'Undamaged'
 }).ok,true);
 assert.equal(getRentalBookingById(id).status,'returned');
 console.log('PASS independent signatures, both-party transfer PINs, no replay, recorded return');
}finally{
 db.close();
 for(const ext of ['','-wal','-shm'])try{fs.unlinkSync(filename+ext)}catch{}
}
