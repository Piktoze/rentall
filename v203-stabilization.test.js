import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {renderTestInvoicePdf} from './modules/accounting-sf-v286.js';

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
  markRentalReturned,
  createAccountingInvoiceDraft,
  listAccountingInvoiceDrafts,
  accountingInvoiceSummary,
  saveAccountingSupplierProfile,
  getAccountingSupplierProfile,
  voidAccountingInvoiceDraftOnFullRefund
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


  // Safe accounting staging foundation: drafts never become issued invoices.
  const invoice=createAccountingInvoiceDraft({
    documentKey:'TEST-invoice-v286-00001',issuerKey:'TEST-PLATFORM',
    recipientKey:'TEST-SUPPLIER',kind:'platform_fee',
    amountCents:1500,taxMode:'pending_review',
    payload:{synthetic:true}
  });
  assert.equal(invoice.amount_cents,1500);
  assert.equal(invoice.status,'draft');
  assert.equal(invoice.invoice_number,null);
  assert.equal(createAccountingInvoiceDraft({
    documentKey:'TEST-invoice-v286-00001',issuerKey:'TEST-PLATFORM',
    recipientKey:'TEST-SUPPLIER',kind:'platform_fee',
    amountCents:1500,taxMode:'pending_review',payload:{synthetic:true}
  }).id,invoice.id,'Repeated event must not create another invoice');
  assert.throws(()=>createAccountingInvoiceDraft({
    documentKey:'TEST-invoice-v286-00001',issuerKey:'TEST-PLATFORM',
    recipientKey:'TEST-SUPPLIER',kind:'platform_fee',
    amountCents:1200,taxMode:'pending_review'
  }),/idempotency/);
  assert.equal(listAccountingInvoiceDrafts({issuerKey:'TEST-PLATFORM'}).length,1);
  assert.equal(accountingInvoiceSummary().automatedIssuanceEnabled,false);
  assert.equal(accountingInvoiceSummary().realEmailsEnabled,false);

  const pdf=await renderTestInvoicePdf(invoice,{issuer:{
    issuerName:'TEST – individuali veikla',issuerAddress:'Vilniaus g. 1, Klaipėda',
    individualActivityCertificate:'TEST-0001'
  }});
  assert.equal(pdf.subarray(0,5).toString('ascii'),'%PDF-');
  assert.ok(pdf.length>5000,'Unicode invoice PDF should contain embedded font');
  assert.throws(()=>saveAccountingSupplierProfile('supplier-v203@example.test',{
    legalKind:'unknown',legalName:'Test'
  }),/legal kind/);
  const profile=saveAccountingSupplierProfile('supplier-v203@example.test',{
    legalKind:'individual',legalName:'Tiekėjas Bandymas',businessAddress:'Bandomasis adresas',
    vatMode:'not_vat_registered',canIssueOnBehalf:true
  });
  assert.equal(profile.reviewed,0,'Supplier declarations are never automatically verified');
  assert.equal(getAccountingSupplierProfile('supplier-v203@example.test').can_issue_on_behalf,1);
  assert.deepEqual(voidAccountingInvoiceDraftOnFullRefund({bookingId:'nonexistent'}),{voided:0,requiresReview:0});

  console.log('PASS SF V286: isolated draft ledger, duplicate protection, issuance/email gates');

  console.log('PASS V203: unpaid cancellation, controlled return dialog and terminal cancellation guards');
}finally{
  closeDatabase();
}
