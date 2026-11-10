import fs from 'fs';
import path from 'path';

const dbFile=path.resolve('./rentinorbit-expiration-test.sqlite');
process.env.DB_PATH=dbFile;
for(const s of ['', '-shm', '-wal']){try{fs.unlinkSync(dbFile+s)}catch{}}

const {
  db,upsertRentalListing,createRentalBookingAtomic,getAvailability,
  expireStalePendingBookings,setBookingPaymentDetails
}=await import('./db.js');

function assert(v,msg){if(!v) throw new Error(msg);}

try{
  // Only instant bookings expire before supplier confirmation. Request bookings
  // receive their payment expiry after the supplier confirms them.
  upsertRentalListing({listingId:'hold-1',title:'Hold test',totalQuantity:1,bookingMode:'instant'});
  db.prepare('UPDATE rental_listings SET booking_mode=? WHERE listing_id=?').run('instant','hold-1');
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

  // A timed-out checkout may still have a Stripe object; another renter must
  // not be allowed to take the same item until provider reconciliation completes.
  for(const provider of ['stripe_payment_intent_id','security_deposit_payment_intent_id']){
    const listingId='hold-'+provider;
    const bookingId='pending-'+provider;
    upsertRentalListing({listingId,title:'Unsettled provider hold',totalQuantity:1,bookingMode:'instant'});
    db.prepare('UPDATE rental_listings SET booking_mode=? WHERE listing_id=?').run('instant',listingId);
    createRentalBookingAtomic({bookingId,listingId,startDate:'2099-02-01',endDate:'2099-02-02',quantity:1,status:'pending',holdMinutes:5});
    db.prepare(`UPDATE rental_bookings SET expires_at=?, ${provider}=? WHERE booking_id=?`)
      .run('2000-01-01T00:00:00.000Z','pi_test_unsettled_hold',bookingId);
    assert(!expireStalePendingBookings().includes(bookingId),
      'Expiry must not release a pending booking with an unsettled provider object');
    assert(db.prepare('SELECT status FROM rental_bookings WHERE booking_id=?').get(bookingId).status==='pending',
      'Provider-backed booking must stay pending until reconciliation');
    assert(getAvailability({listingId,startDate:'2099-02-01',endDate:'2099-02-02',requestedQuantity:1}).remainingQuantity===0,
      'Unreconciled Stripe booking must keep inventory unavailable');
    // Simulate completed provider cleanup by explicitly removing the test-only ID.
    db.prepare(`UPDATE rental_bookings SET ${provider}=NULL WHERE booking_id=?`).run(bookingId);
    assert(expireStalePendingBookings().includes(bookingId),
      'Booking may expire only after provider object is cleared');
    assert(getAvailability({listingId,startDate:'2099-02-01',endDate:'2099-02-02',requestedQuantity:1}).remainingQuantity===1,
      'Inventory is released after the provider hold is resolved');
  }

  console.log('PASS: expired provider-backed booking retains inventory until reconciled.');
  console.log('PASS: unpaid booking expiration releases inventory.');
} finally{
  db.close();
  for(const s of ['', '-shm', '-wal']){try{fs.unlinkSync(dbFile+s)}catch{}}
}
