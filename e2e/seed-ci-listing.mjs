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
const {submitListingReview,decideListingReview,db,closeDatabase}=await import('../db.js');
try{
  const listing=submitListingReview({
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
  const revision=db.prepare('SELECT revision FROM listing_reviews WHERE listing_id=?').get(listing.id).revision;
  decideListingReview({listingId:listing.id,revision,status:'approved',adminId:'isolated-ci',validate:x=>x});
  const row=db.prepare('SELECT listing_id,owner_email,total_quantity FROM rental_listings WHERE listing_id=?').get(listing.id);
  if(row?.listing_id!==listing.id||row?.total_quantity!==2)throw Error('CI fixture verification failed');
  for(const status of ['pending','rejected']){
    const draft=submitListingReview({...listing,id:`ci-catalog-${status}`},
      'demo@rentinorbit.test');
    if(status==='rejected'){
      const {revision}=db.prepare('SELECT revision FROM listing_reviews WHERE listing_id=?').get(draft.id);
      decideListingReview({listingId:draft.id,revision,status:'rejected',
        reason:'Synthetic regression fixture',adminId:'isolated-ci',validate:x=>x});
    }
  }
  // Separate real browser sessions exercise contracts and physical handover.
  // Paid is an explicit local precondition, NOT another real Stripe payment.
  const {createAppUser,upsertRentalListing,createRentalBookingAtomic,setBookingPaymentDetails,createRentalAgreement}=await import('../db.js');
  for(const width of [1280,390]){
    const supplier=`journey-supplier-${width}@example.test`,renter=`journey-renter-${width}@example.test`;
    for(const [email,role] of [[supplier,'supplier'],[renter,'customer']])createAppUser({email,role,password:'SyntheticJourney123!',displayName:'Synthetic TEST'});
    const {declareSupplierTraderStatus}=await import('../db.js');
    declareSupplierTraderStatus(db.prepare('SELECT user_id FROM app_users WHERE email=?').get(supplier).user_id,'private');
    const checkoutListing=submitListingReview({...listing,id:`ci-checkout-${width}`,title:`CI Checkout ${width}`,quantity:2},supplier);
    const checkoutRevision=db.prepare('SELECT revision FROM listing_reviews WHERE listing_id=?').get(checkoutListing.id).revision;
    decideListingReview({listingId:checkoutListing.id,revision:checkoutRevision,status:'approved',adminId:'isolated-ci',validate:x=>x});
    const listingId=`ci-journey-${width}`,bookingId=`CI-UI-${width}`;
    upsertRentalListing({listingId,ownerEmail:supplier,title:'Synthetic browser journey',totalQuantity:1});
    createRentalBookingAtomic({bookingId,listingId,startDate:'2099-05-01',endDate:'2099-05-02',quantity:1,status:'confirmed',customerEmail:renter,customerName:'Synthetic renter',orderValue:100});
    setBookingPaymentDetails({bookingId,paymentIntentId:`pi_mock_ci_${width}`,paymentStatus:'paid',paymentProvider:'mock',platformFeeAmount:15,supplierAmount:85});
    createRentalAgreement({bookingId,termsVersion:'synthetic-ci-only',snapshot:{listingTitle:'Synthetic browser journey',startDate:'2099-05-01',endDate:'2099-05-02',total:100,terms:['Synthetic TEST agreement only.']}});
  }
  console.log('PASS CI synthetic drill and two-account journey fixtures seeded in disposable DB');
}finally{closeDatabase();}
