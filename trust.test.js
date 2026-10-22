import fs from 'fs';
import path from 'path';

const dbFile=path.resolve('./rentall-trust-test.sqlite');
process.env.DB_PATH=dbFile;
for(const s of ['', '-shm', '-wal']){ try{fs.unlinkSync(dbFile+s)}catch{} }

const {
  db, upsertRentalListing, createRentalBookingAtomic,
  cancelRentalBookingWithRefund, getAvailability,
  markRentalReturned, updateRentalBookingStatus,
  createRentalReview
}=await import('./db.js');

function assert(v,msg){ if(!v) throw new Error(msg); }

try{
  upsertRentalListing({
    listingId:'camera-1',
    ownerEmail:'supplier@test.local',
    title:'Camera',
    totalQuantity:2,
    cancellationPolicy:'flexible'
  });

  createRentalBookingAtomic({
    bookingId:'cancel-me',
    listingId:'camera-1',
    startDate:'2099-01-10',
    endDate:'2099-01-12',
    quantity:1,
    status:'confirmed',
    customerName:'Test Customer',
    orderValue:100
  });

  const cancelled=cancelRentalBookingWithRefund('cancel-me','test');
  assert(cancelled.refundAmount===100,'Flexible far-future cancellation should refund 100%');

  const a=getAvailability({
    listingId:'camera-1',
    startDate:'2099-01-10',
    endDate:'2099-01-12',
    requestedQuantity:2
  });
  assert(a.remainingQuantity===2,'Cancellation should release inventory');

  createRentalBookingAtomic({
    bookingId:'return-me',
    listingId:'camera-1',
    startDate:'2099-02-01',
    endDate:'2099-02-03',
    quantity:1,
    status:'confirmed',
    customerName:'Reviewer',
    orderValue:50
  });
  updateRentalBookingStatus('return-me','active');
  const returned=markRentalReturned('return-me','good','All fine');
  assert(returned.status==='returned','Expected returned status');

  createRentalReview({bookingId:'return-me',rating:5,comment:'Great'});
  console.log('PASS: cancellation refund, inventory release, return and review rules work.');
} finally {
  db.close();
  for(const s of ['', '-shm', '-wal']){ try{fs.unlinkSync(dbFile+s)}catch{} }
}
