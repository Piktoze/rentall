import fs from 'fs';
import path from 'path';

const dbFile = path.resolve('./rentinorbit-availability-test.sqlite');
process.env.DB_PATH = dbFile;

for (const suffix of ['', '-shm', '-wal']) {
  try { fs.unlinkSync(dbFile + suffix); } catch {}
}

const {
  db,
  upsertRentalListing,
  getAvailability,
  createRentalBookingAtomic,
  updateRentalBookingStatus
} = await import('./db.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  upsertRentalListing({
    listingId: 'test-chairs',
    ownerEmail: 'supplier@test.local',
    title: '10 folding chairs',
    totalQuantity: 10
  });

  const first = createRentalBookingAtomic({
    bookingId: 'test-booking-1',
    listingId: 'test-chairs',
    startDate: '2026-11-01',
    endDate: '2026-11-04',
    quantity: 6,
    status: 'pending'
  });

  assert(first.availabilityAfter.remainingQuantity === 4, 'Expected 4 remaining after reserving 6/10');

  let rejected = false;
  try {
    createRentalBookingAtomic({
      bookingId: 'test-booking-too-large',
      listingId: 'test-chairs',
      startDate: '2026-11-02',
      endDate: '2026-11-03',
      quantity: 5,
      status: 'pending'
    });
  } catch (err) {
    rejected = err.code === 'INSUFFICIENT_AVAILABILITY';
  }
  assert(rejected, 'Expected overlapping booking of 5 to be rejected');

  createRentalBookingAtomic({
    bookingId: 'test-booking-2',
    listingId: 'test-chairs',
    startDate: '2026-11-02',
    endDate: '2026-11-03',
    quantity: 4,
    status: 'pending'
  });

  const soldOut = getAvailability({
    listingId: 'test-chairs',
    startDate: '2026-11-02',
    endDate: '2026-11-03',
    requestedQuantity: 1
  });
  assert(soldOut.remainingQuantity === 0, 'Expected 0 remaining after 6 + 4 overlapping units');

  updateRentalBookingStatus('test-booking-1', 'cancelled', 'Automated test');

  const released = getAvailability({
    listingId: 'test-chairs',
    startDate: '2026-11-02',
    endDate: '2026-11-03',
    requestedQuantity: 1
  });
  assert(released.remainingQuantity === 6, 'Expected cancelled booking to release 6 units');

  // A booking beginning exactly when another ends must not overlap.
  const adjacent=createRentalBookingAtomic({
    bookingId:'test-adjacent',listingId:'test-chairs',
    startDate:'2026-11-03',endDate:'2026-11-05',
    quantity:6,status:'pending'
  });
  assert(adjacent.availabilityAfter.remainingQuantity === 4,
    'Adjacent booking at previous end boundary should be allowed');

  // Calendar and booking routes must reject archived listings consistently.
  db.prepare("UPDATE rental_listings SET lifecycle_status='archived' WHERE listing_id=?").run('test-chairs');
  const archivedAvailability=getAvailability({
    listingId:'test-chairs',startDate:'2026-11-06',endDate:'2026-11-07',requestedQuantity:1
  });
  assert(archivedAvailability && !archivedAvailability.available && archivedAvailability.remainingQuantity===0,
    'Archived listing must show unavailable despite remaining inventory');
  let archiveDenied=false;
  try{
    createRentalBookingAtomic({bookingId:'test-archived',listingId:'test-chairs',
      startDate:'2026-11-06',endDate:'2026-11-07',quantity:1,status:'pending'});
  }catch(err){archiveDenied=err.code==='LISTING_NOT_ACTIVE';}
  assert(archiveDenied,'Archived listing must not accept new reservations');

  console.log('PASS: availability, anti-double-booking and inventory release work correctly.');
} finally {
  db.close();
  for (const suffix of ['', '-shm', '-wal']) {
    try { fs.unlinkSync(dbFile + suffix); } catch {}
  }
}
