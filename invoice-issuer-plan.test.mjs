import test from 'node:test';import assert from 'node:assert/strict';import {invoiceIssuerPlan} from './modules/invoice-issuer-plan.js';
const booking={bookingId:'synthetic',listingId:'listing',orderValue:100,platformFeeAmount:15,customerEmail:'renter@example.test',customerLegalKind:'company'},listing={listingId:'listing',ownerEmail:'supplier@example.test'};
test('100 EUR rental and 15 EUR platform document retain distinct issuers',()=>{
 const p=invoiceIssuerPlan({booking,listing});assert.equal(p.platform.amountCents,1500);assert.equal(p.platform.recipient,listing.ownerEmail);
 assert.equal(p.rental.grossAmountCents,10000);assert.equal(p.rental.supplierShareCents,8500);assert.equal(p.rental.issuer,listing.ownerEmail);
 assert.equal(p.rental.privateSupplierCompanyRenter,true);assert.equal(p.platform.vatMode,'pending_review');assert.equal(p.platform.issuanceAllowed,false);
 assert.equal(p.transactionConfirmationIsTaxInvoice,false);assert.equal(p.realDocumentNumberAllocated,false);
});
test('foreign supplier profile and invalid monetary snapshot cannot authorize invoices',()=>{
 const p=invoiceIssuerPlan({booking,listing,profile:{reviewed:1,supplier_email:'other@example.test',vat_mode:'vat_registered'}});assert.equal(p.rental.profileVerified,false);
 assert.throws(()=>invoiceIssuerPlan({booking:{...booking,platformFeeAmount:101},listing}),/SNAPSHOT/);
 assert.throws(()=>invoiceIssuerPlan({booking,listing:{...listing,listingId:'other'}}),/TRUSTED/);
});
