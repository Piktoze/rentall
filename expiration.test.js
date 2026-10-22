import fs from 'fs';
import path from 'path';

const dbFile=path.resolve('./rentall-expiration-test.sqlite');
process.env.DB_PATH=dbFile;
for(const s of ['', '-shm', '-wal']){try{fs.unlinkSync(dbFile+s)}catch{}}

const {
  db,upsertRentalListing,createRentalBookingAtomic,getAvailability,
  expireStalePendingBookings,setBookingPaymentDetails
}=await import('./db.js');

function assert(v,msg){if(!v) throw new Error(msg);}

try{
  upsertRentalListing({listingId:'hold-1',title:'Hold test',totalQuantity:1});
  const r=createRentalBookingAtomic({
    bookingId:'hold-booking',
    listingId:'hold-1',
    startDate:'2099-01-01',
    endDate:'2099-01-02',
    quantity:1,
    status:'pending',
    holdMinutes:5
  });
  assert(r.booking.expiresAt,'Pending booking must have expiresAt');

  // Force expiration for test.
  db.prepare(`UPDATE rental_bookings SET expires_at=? WHERE booking_id=?`)
    .run('2000-01-01T00:00:00.000Z','hold-booking');
  expireStalePendingBookings();

  const a=getAvailability({
    listingId:'hold-1',
    startDate:'2099-01-01',
    endDate:'2099-01-02',
    requestedQuantity:1
  });
  assert(a.remainingQuantity===1,'Expired unpaid booking must release inventory');

  console.log('PASS: unpaid booking expiration releases inventory.');
} finally{
  db.close();
  for(const s of ['', '-shm', '-wal']){try{fs.unlinkSync(dbFile+s)}catch{}}
}
