import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const filename=path.resolve('./rentinorbit-status-gate-v287-test.sqlite');
process.env.NODE_ENV='test';
for(const key of ['DATABASE_URL','RENTINORBIT_DB_PATH','PERSISTENT_DATA_DIR','RAILWAY_VOLUME_MOUNT_PATH','RAILWAY_ENVIRONMENT_ID','RAILWAY_PROJECT_ID','RAILWAY_SERVICE_ID','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET'])delete process.env[key];
process.env.DB_PATH=filename;
for(const ext of ['','-wal','-shm'])try{fs.unlinkSync(filename+ext)}catch{}
const {db,upsertRentalListing,createRentalBookingAtomic,getRentalBookingById,cancelRentalBookingWithRefund,setRentalBookingStatusAfterRefund,updateRentalBookingStatus}=await import('./db.js');
const id='status-gate-v287';
const error=(action)=>assert.throws(action,e=>e?.code==='INVALID_TRANSITION');
try{
 upsertRentalListing({listingId:'gate-listing',ownerEmail:'supplier@example.invalid',title:'Status test fixture',totalQuantity:2});
 createRentalBookingAtomic({bookingId:id,listingId:'gate-listing',startDate:'2099-07-01',endDate:'2099-07-03',quantity:1,status:'pending',customerEmail:'renter@example.invalid'});
 error(()=>setRentalBookingStatusAfterRefund(id,'declined'));
 error(()=>setRentalBookingStatusAfterRefund(id,'active'));
 assert.equal(getRentalBookingById(id).status,'pending');
 assert.equal(updateRentalBookingStatus(id,'confirmed').status,'confirmed');
 error(()=>setRentalBookingStatusAfterRefund(id,'declined'));
 assert.equal(getRentalBookingById(id).status,'confirmed');
 cancelRentalBookingWithRefund(id,'Fixture declined by supplier');
 assert.equal(getRentalBookingById(id).status,'cancelled');
 error(()=>setRentalBookingStatusAfterRefund(id,'completed'));
 error(()=>setRentalBookingStatusAfterRefund(id,'active'));
 assert.equal(getRentalBookingById(id).status,'cancelled');
 assert.equal(setRentalBookingStatusAfterRefund(id,'declined').status,'declined');
 error(()=>setRentalBookingStatusAfterRefund(id,'declined'));
 assert.equal(getRentalBookingById(id).status,'declined');
 console.log('PASS status gate v287: post-refund declined only from cancelled, no replay, no arbitrary state');
}finally{
 db.close();
 for(const ext of ['','-wal','-shm'])try{fs.unlinkSync(filename+ext)}catch{}
}
