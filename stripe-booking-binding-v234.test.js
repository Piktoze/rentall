import assert from 'node:assert/strict';
import fs from 'node:fs';
const server=fs.readFileSync('./server.js','utf8');
const start=server.indexOf("app.get('/api/stripe/connect/booking-binding/:bookingId'");
assert.ok(start>=0,'Staging binding diagnostic route');
const end=server.indexOf("\n});",start);
const route=server.slice(start,end+4);
for(const guard of ["requireRole('supplier','admin')","process.env.RENTINORBIT_STAGING!=='true'","canSupplierManageBooking(req.appUser,bookingId)","getRentalBookingById(bookingId)","getRentalListing(booking.listingId)","getDirectMerchantConnectionByEmail(db,listing.ownerEmail)","getDirectMerchantConnectionByUserId(db,req.appUser.userId)","directMerchantReady(ownerConnection)","'Cache-Control','private, no-store'"]){
 assert.ok(route.includes(guard),'Missing secure binding diagnostic guard: '+guard);
}
assert.ok(!route.includes('stripe.paymentIntents.create'),'Audit must be read-only');
assert.ok(!route.includes('saveDirectMerchantMetadata'),'Audit must not change Stripe owner linkage');
assert.ok(!route.includes('email:')&&!route.includes('accessToken:'),'Audit must not expose customer data');
console.log('PASS staging-only supplier-authorized Stripe booking binding diagnostic is read-only');
