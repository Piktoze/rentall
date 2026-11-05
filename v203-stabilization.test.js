import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const dbFile=':memory:';
process.env.DB_PATH=dbFile;
process.env.NODE_ENV='test';

const {
  closeDatabase,
  upsertRentalListing,
  createRentalBookingAtomic,
  cancelRentalBookingWithRefund,
  setBookingPaymentDetails,
  updateRentalBookingStatus,
  markRentalReturned
}=await import('./db.js');

try{
  upsertRentalListing({
    listingId:'v203-item',ownerEmail:'supplier-v203@example.test',title:'V203 item',
    totalQuantity:1,cancellationPolicy:'moderate',bookingMode:'request'
  });

  createRentalBookingAtomic({
    bookingId:'v203-unpaid',listingId:'v203-item',startDate:'2099-01-01',endDate:'2099-01-02',
    quantity:1,status:'pending',orderValue:100,customerEmail:'customer-v203@example.test'
  });
  const unpaid=cancelRentalBookingWithRefund(
    'v203-unpaid','Unpaid cancellation',new Date(),{forceFullRefund:true,refundAmountOverride:0}
  );
  assert.equal(unpaid.booking.status,'cancelled');
  assert.equal(unpaid.booking.paymentStatus,'unpaid');
  assert.equal(unpaid.refundAmount,0,'unpaid cancellation must never claim a refund');

  createRentalBookingAtomic({
    bookingId:'v203-lifecycle',listingId:'v203-item',startDate:'2099-02-01',endDate:'2099-02-02',
    quantity:1,status:'confirmed',orderValue:100,customerEmail:'customer-v203@example.test'
  });
  setBookingPaymentDetails({
    bookingId:'v203-lifecycle',paymentIntentId:'pi_test_v203',paymentStatus:'paid',
    platformFeeAmount:15,supplierAmount:85,paymentProvider:'stripe'
  });
  assert.equal(updateRentalBookingStatus('v203-lifecycle','active').status,'active');
  assert.throws(
    ()=>cancelRentalBookingWithRefund('v203-lifecycle','must fail'),
    error=>error?.code==='INVALID_TRANSITION'
  );
  const returned=markRentalReturned('v203-lifecycle','good','Returned through the v203 dialog');
  assert.equal(returned.status,'returned');
  assert.equal(returned.returnCondition,'good');
  assert.throws(
    ()=>cancelRentalBookingWithRefund('v203-lifecycle','must still fail'),
    error=>error?.code==='INVALID_TRANSITION'
  );
  assert.equal(updateRentalBookingStatus('v203-lifecycle','completed').status,'completed');
  assert.throws(
    ()=>cancelRentalBookingWithRefund('v203-lifecycle','must remain final'),
    error=>error?.code==='INVALID_TRANSITION'
  );

  const server=fs.readFileSync('./server.js','utf8');
  const app=fs.readFileSync('./app.js','utf8');
  const html=fs.readFileSync('./index.html','utf8');
  const railwayIac=fs.readFileSync('./.railway/railway.ts','utf8');
  const scheduler=fs.readFileSync('./ops/backup-scheduler.js','utf8');
  assert.match(server,/An unpaid booking without provider objects has nothing to cancel or refund/);
  assert.match(server,/collectedPayment[\s\S]*?refundAmountOverride:refundAmount/);
  assert.ok(!/function returnLiveBooking[\s\S]{0,400}window\.prompt/.test(app),'return flow must not use chained prompts');
  assert.match(app,/collectReturnBookingDetails/);
  assert.match(html,/id="returnBookingModal"/);
  assert.match(html,/option value="missing"/);
  assert.match(railwayIac,/staging\?'staging\/v203':'main'/);
  assert.match(railwayIac,/bucket\('rentinorbit-staging-backups'/);
  assert.match(railwayIac,/BACKUP_S3_SECRET_ACCESS_KEY:ref\(backups,'secretAccessKey'\)/);
  assert.match(scheduler,/BACKUP_STORAGE_NOT_SEPARATE/);

  console.log('PASS V203: unpaid cancellation, controlled return dialog and terminal cancellation guards');
}finally{
  closeDatabase();
}
