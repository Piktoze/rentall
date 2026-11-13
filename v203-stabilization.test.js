import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {assessCompanyRentalCheckout,PRIVATE_TO_COMPANY_REVIEW_CODE} from './modules/b2b-private-rental-gate-v287.js';
import {assessRentalInvoicePreflight} from './modules/rental-invoice-preflight-v292.js';
import {renderTestInvoicePdf,renderTestInvoiceEmailPreview,renderRentalTransactionConfirmationPdf} from './modules/accounting-sf-v286.js';

const dbFile=':memory:';
process.env.DB_PATH=dbFile;
process.env.NODE_ENV='test';

const {
  closeDatabase,
  upsertRentalListing,
  createRentalBookingAtomic,
  getRentalBookingById,
  cancelRentalBookingWithRefund,
  setBookingPaymentDetails,
  updateRentalBookingStatus,
  markRentalReturned,
  createAccountingInvoiceDraft,
  listAccountingInvoiceDrafts,
  accountingInvoiceSummary,
  saveAccountingSupplierProfile,
  getAccountingSupplierProfile,
  voidAccountingInvoiceDraftOnFullRefund,
  issueAccountingSyntheticInvoice,
  addAccountingExpenseDraft,
  listAccountingExpenses,
  listAccountingRecipientDrafts,
  createAppUser,
  reviewAccountingSupplierProfile,
  listAccountingSupplierProfilesForReview,
  listAccountingSupplierReviewAudit,
  getAccountingInvoiceMandate,
  listAccountingInvoiceMandateAudit,
  acceptAccountingInvoiceMandate,
  reviewAccountingInvoiceMandate,
  revokeAccountingInvoiceMandate,
  invoiceIssuanceAuthorityStatus,
  invoiceDelegationTerms,
  scheduleAccountingInvoicePreview,
  listAccountingInvoiceDeliveryPreviews,
  listEmailOutbox
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
  const paidRental=getRentalBookingById('v203-lifecycle');
  const paidRentalDoc=await renderRentalTransactionConfirmationPdf({
    booking:paidRental,listing:{listingId:'v203-item',title:'V203 item'},
    supplierName:'Nuomotojas pagal sutartį'
  });
  assert.equal(paidRentalDoc.subarray(0,5).toString('ascii'),'%PDF-');
  assert.ok(paidRentalDoc.length>5000);
  await assert.rejects(()=>renderRentalTransactionConfirmationPdf({
    booking:{...paidRental,paymentStatus:'unpaid'},
    listing:{listingId:'v203-item',title:'V203 item'}
  }),/Completed payment/);
  await assert.rejects(()=>renderRentalTransactionConfirmationPdf({
    booking:{...paidRental,refundAmount:100},
    listing:{listingId:'v203-item',title:'V203 item'}
  }),/Completed payment/);
  await assert.rejects(()=>renderRentalTransactionConfirmationPdf({
    booking:paidRental,listing:{listingId:'other-item'}
  }),/Matching booking/);

  assert.throws(
    ()=>cancelRentalBookingWithRefund('v203-lifecycle','must remain final'),
    error=>error?.code==='INVALID_TRANSITION'
  );

  createRentalBookingAtomic({
    bookingId:'v287-company-booking',listingId:'v203-item',
    startDate:'2099-03-01',endDate:'2099-03-02',quantity:1,
    status:'pending',orderValue:100,customerEmail:'business@example.test',
    customerLegalKind:'company',customerCompanyName:'Bandomoji UAB'
  });
  const businessBooking=getRentalBookingById('v287-company-booking');
  assert.equal(businessBooking.customerLegalKind,'company');
  assert.equal(businessBooking.customerCompanyName,'Bandomoji UAB');
  assert.throws(()=>createRentalBookingAtomic({
    bookingId:'v287-company-no-name',listingId:'v203-item',
    startDate:'2099-03-03',endDate:'2099-03-04',quantity:1,
    customerLegalKind:'company'
  }),/Company renter name required/);

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
  assert.match(server,/PRIVATE_TO_COMPANY_TAX_REVIEW_REQUIRED|b2bPaymentGate/);
  assert.match(server,/corporateDepositGate/);
  assert.ok(server.includes('transaction-confirmation.pdf'));
  assert.match(server,/scheduleAccountingInvoicePreview/);
  assert.ok(server.includes('/api/supplier/accounting/delegation/accept'));
  assert.ok(server.includes('/api/admin/accounting/delegations/:email/review'));
  assert.ok(server.includes('/api/admin/accounting/bookings/:bookingId/invoice-preflight'));
  assert.ok(server.includes('/api/supplier/accounting/bookings/:bookingId/invoice-preflight'));


  assert.match(server,/api\/admin\/accounting\/delivery-previews/);
  assert.match(server,/api\/admin\/accounting\/supplier-profiles\/.*review/);
  assert.match(html,/id="customerLegalKind"/);
  assert.match(app,/customerLegalKind:document\.getElementById/);

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
  assert.equal(listAccountingRecipientDrafts('TEST-SUPPLIER').length,1);
  assert.equal(listAccountingRecipientDrafts('wrong-user@example.test').length,0);
  assert.throws(()=>scheduleAccountingInvoicePreview({documentKey:'TEST-invoice-v286-00001',recipientEmail:'other@example.test'}),/recipient/);
  // Staging email-previews are durable entries, not transactional messages.
  // This example uses an email-matched draft rather than the non-email recipient TEST-SUPPLIER.
  const emailDraft=createAccountingInvoiceDraft({
    documentKey:'TEST-email-preview-v289-00001',issuerKey:'TEST-PLATFORM',
    recipientKey:'supplier-v203@example.test',kind:'platform_fee',
    bookingId:'v289-refunded',amountCents:1500,taxMode:'pending_review',
    payload:{synthetic:true}
  });
  const emailsBeforePreview=listEmailOutbox(200).length;
  const preview=scheduleAccountingInvoicePreview({
    documentKey:emailDraft.document_key,recipientEmail:'supplier-v203@example.test'
  });
  assert.equal(listEmailOutbox(200).length,emailsBeforePreview,'TEST invoice preview must never enter real email outbox');
  assert.equal(preview.status,'preview_only');
  assert.equal(scheduleAccountingInvoicePreview({
    documentKey:emailDraft.document_key,recipientEmail:'supplier-v203@example.test'
  }).id,preview.id,'Repeated webhook must not duplicate a delivery preview');
  assert.equal(listAccountingInvoiceDeliveryPreviews({recipientEmail:'supplier-v203@example.test'}).length,1);
  assert.equal(listAccountingInvoiceDeliveryPreviews({recipientEmail:'outsider@example.test'}).length,0);
  assert.deepEqual(voidAccountingInvoiceDraftOnFullRefund({bookingId:'v289-refunded'}),{voided:1,requiresReview:0});
  assert.equal(listAccountingInvoiceDeliveryPreviews({recipientEmail:'supplier-v203@example.test'})[0].status,'void');
  assert.throws(()=>scheduleAccountingInvoicePreview({
    documentKey:emailDraft.document_key,recipientEmail:'supplier-v203@example.test'
  }),/draft state/);


  assert.equal(accountingInvoiceSummary().automatedIssuanceEnabled,false);
  assert.equal(accountingInvoiceSummary().realEmailsEnabled,false);

  assert.ok(fs.existsSync('./assets/brand/rentinorbit-logo-horizontal-dark-web.png'),'The real R logo asset must ship with invoice PDFs');
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
  const syntheticSupplier=createAppUser({email:'supplier-v203@example.test',password:'synthetic-only-pwd-8',role:'supplier'});
  const syntheticAdmin=createAppUser({email:'reviewer-v288@example.test',password:'synthetic-review-password',role:'admin'});
  assert.ok(syntheticSupplier.userId&&syntheticAdmin.userId);
  assert.throws(()=>reviewAccountingSupplierProfile({
    supplierEmail:syntheticSupplier.email,reviewerUserId:syntheticAdmin.userId,
    decision:'approve',evidenceReference:'TEST-EVIDENCE-V288',reviewNote:'Reviewed synthetic status'
  }),/Complete business identity/);
  assert.equal(getAccountingSupplierProfile(syntheticSupplier.email).reviewed,0);
  assert.throws(()=>reviewAccountingSupplierProfile({
    supplierEmail:syntheticSupplier.email,reviewerUserId:syntheticSupplier.userId,
    decision:'approve',evidenceReference:'TEST-EVIDENCE-V288',reviewNote:'Self approval must be blocked'
  }),/Admin review/);
  saveAccountingSupplierProfile(syntheticSupplier.email,{
    legalKind:'individual',legalName:'TEST Tiekėjas',businessAddress:'Sintetinė gatvė 12, Vilnius',
    registrationNumber:'SYNTHETIC-1234',vatMode:'not_vat_registered',canIssueOnBehalf:true
  });
  const review=reviewAccountingSupplierProfile({
    supplierEmail:syntheticSupplier.email,reviewerUserId:syntheticAdmin.userId,
    decision:'approve',evidenceReference:'TEST-EVIDENCE-V288',
    reviewNote:'Independent synthetic business identity checked'
  });
  assert.equal(review.reviewed,true);
  assert.equal(assessCompanyRentalCheckout({customerLegalKind:'company',supplierProfile:review.reviewedProfile}).allowed,true);
  assert.equal(listAccountingSupplierProfilesForReview().some(x=>x.supplier_email===syntheticSupplier.email),true);
  assert.equal(listAccountingSupplierReviewAudit(syntheticSupplier.email).length,1);
  const mandateTerms=invoiceDelegationTerms();
  assert.match(mandateTerms.termsDigest,/^[a-f0-9]{64}$/);
  assert.ok(mandateTerms.explanation.includes('komisinis'));

  assert.equal(invoiceIssuanceAuthorityStatus(syntheticSupplier.email).realInvoiceIssuanceEnabled,false);
  assert.throws(()=>acceptAccountingInvoiceMandate({
    supplierEmail:syntheticSupplier.email,actorUserId:syntheticAdmin.userId,
    version:mandateTerms.version,termsDigest:mandateTerms.termsDigest
  }),/Only the authenticated supplier/);
  assert.throws(()=>acceptAccountingInvoiceMandate({
    supplierEmail:syntheticSupplier.email,actorUserId:syntheticSupplier.userId,
    version:'obsolete-terms',termsDigest:mandateTerms.termsDigest
  }),/Current supplier delegation terms/);
  const mandate=acceptAccountingInvoiceMandate({
    supplierEmail:syntheticSupplier.email,actorUserId:syntheticSupplier.userId,
    version:mandateTerms.version,termsDigest:mandateTerms.termsDigest
  });
  assert.equal(mandate.status,'pending_review');
  assert.equal(acceptAccountingInvoiceMandate({
    supplierEmail:syntheticSupplier.email,actorUserId:syntheticSupplier.userId,
    version:mandateTerms.version,termsDigest:mandateTerms.termsDigest
  }).accepted_at,mandate.accepted_at);
  assert.equal(listAccountingInvoiceMandateAudit(syntheticSupplier.email).length,1);
  assert.throws(()=>reviewAccountingInvoiceMandate({
    supplierEmail:syntheticSupplier.email,adminUserId:syntheticSupplier.userId,
    decision:'approve',evidenceReference:'TEST-SIGNED-AUTH-V291',
    reason:'Supplier must not review itself'
  }),/Independent platform admin/);
  const approved=reviewAccountingInvoiceMandate({
    supplierEmail:syntheticSupplier.email,adminUserId:syntheticAdmin.userId,
    decision:'approve',evidenceReference:'TEST-SIGNED-AUTH-V291',
    reason:'Independent synthetic contract reviewed'
  });
  assert.equal(approved.status,'approved');
  assert.equal(invoiceIssuanceAuthorityStatus(syntheticSupplier.email).delegationApproved,true);
  assert.equal(invoiceIssuanceAuthorityStatus(syntheticSupplier.email).realInvoiceIssuanceEnabled,false);
  assert.equal(listAccountingInvoiceMandateAudit(syntheticSupplier.email).length,2);
  const invoiceBooking={
    bookingId:'RB-V292-PAID',listingId:'v203-item',customerName:'TEST pirkėjas',
    customerEmail:'customer-v203@example.test',customerLegalKind:'individual',
    orderValue:100,paymentStatus:'paid',status:'confirmed',
    stripePaymentIntentId:'pi_test_v292',refundAmount:0,stripeRefundId:null
  };
  const invoiceListing={listingId:'v203-item',ownerEmail:syntheticSupplier.email};
  const invoiceContext={booking:invoiceBooking,listing:invoiceListing,
    profile:getAccountingSupplierProfile(syntheticSupplier.email),
    mandate:getAccountingInvoiceMandate(syntheticSupplier.email),
    terms:invoiceDelegationTerms()};
  const readyInvoice=assessRentalInvoicePreflight(invoiceContext);
  assert.equal(readyInvoice.technicalPreflightPassed,true);
  assert.deepEqual(readyInvoice.blockers,['LIVE_ACCOUNTING_LEGAL_SIGNOFF_REQUIRED']);
  assert.equal(readyInvoice.realInvoiceIssuanceAllowed,false);
  assert.equal(readyInvoice.realEmailDeliveryAllowed,false);
  assert.equal(readyInvoice.invoiceNumberAllocated,false);
  assert.ok(assessRentalInvoicePreflight({...invoiceContext,
    booking:{...invoiceBooking,paymentStatus:'unpaid'}}).blockers.includes('RENTAL_NOT_PAID'));
  assert.ok(assessRentalInvoicePreflight({...invoiceContext,
    booking:{...invoiceBooking,stripeRefundId:'re_test_v292'}}).blockers.includes('RENTAL_REFUNDED_OR_DISPUTED'));
  for(const paymentStatus of ['disputed','chargeback','chargeback_pending','refund_pending','refund_processing','partially_refunded']){
    const result=assessRentalInvoicePreflight({...invoiceContext,
      booking:{...invoiceBooking,paymentStatus}});
    assert.equal(result.technicalPreflightPassed,false,`Invoice preflight must fail for ${paymentStatus}`);
    assert.ok(result.blockers.includes('RENTAL_REFUNDED_OR_DISPUTED'));
  }
  for(const status of ['disputed','chargeback','refund_pending']){
    const result=assessRentalInvoicePreflight({...invoiceContext,
      booking:{...invoiceBooking,status}});
    assert.equal(result.technicalPreflightPassed,false,`Invoice preflight must fail for booking status ${status}`);
    assert.ok(result.blockers.includes('RENTAL_REFUNDED_OR_DISPUTED'));
  }
  assert.ok(assessRentalInvoicePreflight({...invoiceContext,
    listing:{...invoiceListing,ownerEmail:'outsider@example.test'}}).blockers.includes('SUPPLIER_PROFILE_UNVERIFIED'));
  assert.ok(assessRentalInvoicePreflight({...invoiceContext,
    booking:{...invoiceBooking,customerLegalKind:'company',customerCompanyName:''}}).blockers.includes('RENTER_IDENTITY_INCOMPLETE'));
  assert.ok(assessRentalInvoicePreflight({...invoiceContext,
    profile:{...invoiceContext.profile,vat_mode:'pending_review'}}).blockers.includes('SUPPLIER_TAX_MODE_UNVERIFIED'));
  assert.ok(assessRentalInvoicePreflight({...invoiceContext,
    mandate:{...invoiceContext.mandate,terms_digest:'outdated'}}).blockers.includes('MANDATE_TERMS_OUTDATED'));

  saveAccountingSupplierProfile(syntheticSupplier.email,{
    legalKind:'private',legalName:'TEST Privatus žmogus',vatMode:'pending_review'
  });
  assert.equal(getAccountingSupplierProfile(syntheticSupplier.email).reviewed,0);
  assert.equal(getAccountingInvoiceMandate(syntheticSupplier.email).status,'revoked');
  assert.equal(listAccountingInvoiceMandateAudit(syntheticSupplier.email).at(0).event,'revoked');
  assert.equal(invoiceIssuanceAuthorityStatus(syntheticSupplier.email).delegationApproved,false);
  assert.equal(assessCompanyRentalCheckout({customerLegalKind:'company',supplierProfile:getAccountingSupplierProfile(syntheticSupplier.email)}).allowed,false);
  assert.throws(()=>reviewAccountingSupplierProfile({
    supplierEmail:syntheticSupplier.email,reviewerUserId:syntheticAdmin.userId,
    decision:'approve',evidenceReference:'TEST-EVIDENCE-V288',reviewNote:'Private renter must be rejected'
  }),/Private person/);

  assert.deepEqual(voidAccountingInvoiceDraftOnFullRefund({bookingId:'nonexistent'}),{voided:0,requiresReview:0});
  const numbered=issueAccountingSyntheticInvoice('TEST-invoice-v286-00001');
  assert.match(numbered.invoice_number,/^TEST-RIO-\d{4}-000001$/);
  assert.equal(numbered.status,'issued');
  assert.equal(issueAccountingSyntheticInvoice('TEST-invoice-v286-00001').invoice_number,numbered.invoice_number);
  const numberedPdf=await renderTestInvoicePdf({...numbered,document_key:'TEST-invoice-v286-00001'},{
    issuer:{issuerName:'TEST – Ieva'}
  });
  assert.equal(numberedPdf.subarray(0,5).toString('ascii'),'%PDF-');
  assert.throws(()=>issueAccountingSyntheticInvoice('LIVE-invoice-v286'),/synthetic TEST/);
  const expense=addAccountingExpenseDraft({
    recordKey:'TEST-expense-v286-0001',supplierName:'Stripe TEST',supplierCountry:'IE',
    category:'stripe',invoiceDate:'2026-11-13',currency:'EUR',
    grossAmountCents:340,expenseOwner:'supplier'
  });
  assert.equal(expense.gross_amount_cents,340);
  assert.equal(expense.vat_review_status,'pending_review');
  assert.equal(expense.reverse_charge_assessed,0);
  assert.equal(addAccountingExpenseDraft({
    recordKey:'TEST-expense-v286-0001',supplierName:'Stripe TEST',supplierCountry:'IE',
    category:'stripe',invoiceDate:'2026-11-13',currency:'EUR',
    grossAmountCents:340,expenseOwner:'supplier'
  }).id,expense.id);
  assert.throws(()=>addAccountingExpenseDraft({
    recordKey:'TEST-expense-v286-0001',supplierName:'Stripe TEST',supplierCountry:'IE',
    category:'stripe',invoiceDate:'2026-11-13',currency:'EUR',
    grossAmountCents:100,expenseOwner:'supplier'
  }),/idempotency/);
  assert.equal(listAccountingExpenses().length,1);
  const privateRenter=assessCompanyRentalCheckout({customerLegalKind:'individual'});
  assert.equal(privateRenter.allowed,true);
  const blockedPrivate=assessCompanyRentalCheckout({customerLegalKind:'company',supplierProfile:{legal_kind:'private',reviewed:1}});
  assert.equal(blockedPrivate.allowed,false);
  assert.equal(blockedPrivate.code,PRIVATE_TO_COMPANY_REVIEW_CODE);
  assert.equal(assessCompanyRentalCheckout({customerLegalKind:'company',supplierProfile:null}).allowed,false);
  assert.equal(assessCompanyRentalCheckout({customerLegalKind:'company',supplierProfile:{legal_kind:'company',reviewed:0}}).allowed,false);
  assert.equal(assessCompanyRentalCheckout({customerLegalKind:'company',supplierProfile:{legal_kind:'individual',reviewed:1}}).allowed,true);
  assert.equal(assessCompanyRentalCheckout({customerLegalKind:'company',supplierProfile:{legal_kind:'company',reviewed:1}}).allowed,true);

  const emailPreview=renderTestInvoiceEmailPreview(invoice,{recipientName:'<p>neleistina</p>'});
  assert.match(emailPreview,/&lt;p&gt;neleistina&lt;\/p&gt;/);
  assert.ok(!emailPreview.includes('<p>neleistina</p>'),'Email template must escape supplied recipient text');
  assert.match(emailPreview,/siuntimas išjungti/);
  assert.throws(()=>renderTestInvoiceEmailPreview({...invoice,document_key:'LIVE-demo'}),/TEST invoice/);




  console.log('PASS SF V286: isolated draft ledger, duplicate protection, issuance/email gates');

  console.log('PASS V203: unpaid cancellation, controlled return dialog and terminal cancellation guards');
}finally{
  closeDatabase();
}
