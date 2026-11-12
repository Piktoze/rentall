import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const filename=path.resolve('./rentinorbit-inventory-reduction-v286-test.sqlite');
process.env.NODE_ENV='test';
for(const key of ['DATABASE_URL','RENTINORBIT_DB_PATH','PERSISTENT_DATA_DIR','RAILWAY_VOLUME_MOUNT_PATH','RAILWAY_ENVIRONMENT_ID','RAILWAY_PROJECT_ID','RAILWAY_SERVICE_ID','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET'])delete process.env[key];
process.env.DB_PATH=filename;
for(const ext of ['','-wal','-shm'])try{fs.unlinkSync(filename+ext)}catch{}
const {db,upsertRentalListing,createRentalBookingAtomic,getAvailability,getRentalListing,assertRentalListingInventoryCapacity,setBookingPaymentDetails}=await import('./db.js');
const listingId='stock-reduction-v286';
const book=(id,startDate,endDate,quantity)=>createRentalBookingAtomic({bookingId:id,listingId,startDate,endDate,quantity,status:'pending',customerEmail:'renter@example.invalid'});
const update=n=>upsertRentalListing({listingId,ownerEmail:'supplier@example.invalid',title:'Inventory fixture',totalQuantity:n});
try{
  update(10);
  book('stock-a','2099-06-01','2099-06-05',4);
  book('stock-b','2099-06-05','2099-06-08',3);
  assert.equal(assertRentalListingInventoryCapacity(listingId,4),4,'Adjacent bookings do not overlap');
  update(4);
  assert.equal(getRentalListing(listingId).totalQuantity,4);
  assert.throws(()=>update(3),e=>e?.code==='INVENTORY_BELOW_RESERVED');
  assert.equal(getRentalListing(listingId).totalQuantity,4,'Rejected edit does not mutate stock');
  assert.throws(()=>book('stock-overbook','2099-06-02','2099-06-03',1),e=>e?.code==='INSUFFICIENT_AVAILABILITY');
  update(7);
  book('stock-c','2099-06-03','2099-06-06',3);
  assert.throws(()=>update(6),e=>e?.code==='INVENTORY_BELOW_RESERVED',
    'Partially overlapping reservations require the peak number of units');
  assert.equal(getAvailability({listingId,startDate:'2099-06-03',endDate:'2099-06-04',requestedQuantity:1}).remainingQuantity,0);
  assert.equal(getRentalListing(listingId).totalQuantity,7);
  // Payment-provider reconciliation prevents expired pending holds being released.
  db.prepare("UPDATE rental_bookings SET expires_at='2000-01-01T00:00:00.000Z',stripe_payment_intent_id='pi_synthetic_inventory' WHERE booking_id='stock-c'").run();
  assert.throws(()=>update(6),e=>e?.code==='INVENTORY_BELOW_RESERVED',
    'Expired pending hold with provider intent remains reserved until reconciliation');
  assert.equal(getRentalListing(listingId).totalQuantity,7);
  console.log('PASS stock reduction v286: adjacent intervals, peak overlapping holds, atomic edit rejection, pending Stripe intent');
}finally{
  db.close();
  for(const ext of ['','-wal','-shm'])try{fs.unlinkSync(filename+ext)}catch{}
}
