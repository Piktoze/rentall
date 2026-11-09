// CI-only fixture: synthetic listing for browser discovery tests.
// Refuses to operate unless explicitly running on an isolated GitHub runner.
import path from 'node:path';
import fs from 'node:fs';
const dbPath=path.resolve(process.env.DB_PATH||'');
const temp=path.resolve(process.env.RUNNER_TEMP||'/missing-ci-temp');
if(process.env.CI!=='true'||process.env.NODE_ENV!=='test'||
   !process.env.RUNNER_TEMP||!process.env.DB_PATH||
   !dbPath.startsWith(temp+path.sep)||dbPath==='/data'||
   process.env.RAILWAY_VOLUME_MOUNT_PATH||process.env.DATABASE_URL||
   process.env.RENTINORBIT_DB_PATH){
  throw new Error('Refusing to seed outside an isolated CI temporary database');
}
const {saveFullRentalListing,upsertRentalListing,db,closeDatabase}=await import('../db.js');
try{
  const listing=saveFullRentalListing({
    id:'ci-drill-discovery',
    title:'CI Drill Test Rental',
    description:'Synthetic item for isolated Chromium discovery tests. No real item or payment.',
    category:'tools',
    city:'Klaipėda',
    country:'LT',
    quantity:2,
    priceDay:100,
    bookingMode:'request',
    moderationStatus:'active',
    lifecycleStatus:'active',
    availabilityConfirmedAt:new Date().toISOString()
  },'demo@rentinorbit.test');
  upsertRentalListing({listingId:listing.id,ownerEmail:listing.ownerEmail,
    title:listing.title,totalQuantity:listing.quantity});
  const row=db.prepare('SELECT listing_id,owner_email,total_quantity FROM rental_listings WHERE listing_id=?').get(listing.id);
  if(row?.listing_id!==listing.id||row?.total_quantity!==2)throw Error('CI fixture verification failed');
  console.log('PASS CI synthetic drill listing seeded in disposable DB');
}finally{closeDatabase();}
