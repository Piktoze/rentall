import fs from 'fs';
import os from 'os';
import path from 'path';

// Execute only against disposable temp files. A production/Railway build
// environment must never make this test touch its configured storage.
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'rentinorbit-expiration-'));
const dbFile=path.join(folder,'expiry-test.sqlite');
for(const k of ['RAILWAY_ENVIRONMENT_ID','RAILWAY_PROJECT_ID','RAILWAY_SERVICE_ID',
  'RAILWAY_VOLUME_MOUNT_PATH','PERSISTENT_DATA_DIR','DATABASE_URL','RENTINORBIT_DB_PATH',
  'STRIPE_SECRET_KEY','STRIPE_PUBLISHABLE_KEY','STRIPE_WEBHOOK_SECRET','STRIPE_CONNECT_WEBHOOK_SECRET'])delete process.env[k];
process.env.NODE_ENV='test';
process.env.RENTINORBIT_STAGING='true';
process.env.DB_PATH=dbFile;
process.env.UPLOADS_DIR=path.join(folder,'uploads');

const {
  db,upsertRentalListing,createRentalBookingAtomic,getAvailability,
  expireStalePendingBookings,setBookingPaymentDetails,listUnreconciledExpiredBookings
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
    const pendingQueue=listUnreconciledExpiredBookings();
    const pendingEntry=pendingQueue.find(row=>row.bookingId===bookingId);
    assert(pendingEntry,'Unresolved provider hold must appear in the admin triage queue');
    assert(pendingEntry.hasPaymentIntent===(provider==='stripe_payment_intent_id'),'Payment flag must match provider object');
    assert(pendingEntry.hasDepositIntent===(provider==='security_deposit_payment_intent_id'),'Deposit flag must match provider object');
    assert(!('customerEmail' in pendingEntry)&&!('stripePaymentIntentId' in pendingEntry)
      &&!('securityDepositPaymentIntentId' in pendingEntry),
      'Triage queue must not expose customer PII or Stripe object IDs');
    assert(db.prepare('SELECT status FROM rental_bookings WHERE booking_id=?').get(bookingId).status==='pending',
      'Provider-backed booking must stay pending until reconciliation');
    assert(getAvailability({listingId,startDate:'2099-02-01',endDate:'2099-02-02',requestedQuantity:1}).remainingQuantity===0,
      'Unreconciled Stripe booking must keep inventory unavailable');
    // Simulate completed provider cleanup by explicitly removing the test-only ID.
    db.prepare(`UPDATE rental_bookings SET ${provider}=NULL WHERE booking_id=?`).run(bookingId);
    assert(expireStalePendingBookings().includes(bookingId),
      'Booking may expire only after provider object is cleared');
    assert(!listUnreconciledExpiredBookings().some(row=>row.bookingId===bookingId),
      'Reconciled reservation must disappear from operations queue');
    assert(getAvailability({listingId,startDate:'2099-02-01',endDate:'2099-02-02',requestedQuantity:1}).remainingQuantity===1,
      'Inventory is released after the provider hold is resolved');
  }

  console.log('PASS: expired provider-backed booking retains inventory until reconciled.');
  console.log('PASS: unpaid booking expiration releases inventory.');
} finally{
  db.close();
  fs.rmSync(folder,{recursive:true,force:true});
}
