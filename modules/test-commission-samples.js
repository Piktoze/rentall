import Database from 'better-sqlite3';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createCommissionCompletion} from './commission-completion.js';
import {renderTestInvoicePdf} from './accounting-sf-v286.js';
// Temporary fixture only. No canonical DB import, no production path or numbering configuration.
export async function buildTestCommissionSamples(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rio-pdf-samples-')),db=new Database(path.join(root,'synthetic.sqlite'));
 try{
  db.exec(`CREATE TABLE app_users(user_id TEXT,email TEXT,role TEXT);INSERT INTO app_users VALUES('supplier','synthetic-supplier@example.invalid','supplier'),('renter','synthetic-renter@example.invalid','customer');
  CREATE TABLE rental_listings(listing_id TEXT,owner_email TEXT);INSERT INTO rental_listings VALUES('TEST-item','synthetic-supplier@example.invalid');
  CREATE TABLE rental_bookings(booking_id TEXT,listing_id TEXT,customer_email TEXT,status TEXT,return_condition TEXT,payment_status TEXT,stripe_refund_id TEXT,security_deposit_amount INTEGER);
  INSERT INTO rental_bookings VALUES('TEST-SAMPLE','TEST-item','synthetic-renter@example.invalid','returned','good','paid',NULL,0);
  CREATE TABLE commercial_sct_enrollments(booking_id TEXT,hold_reason TEXT);INSERT INTO commercial_sct_enrollments VALUES('TEST-SAMPLE',NULL);
  CREATE TABLE commercial_sct_bindings(booking_id TEXT,fee_cents INTEGER,amount_cents INTEGER);INSERT INTO commercial_sct_bindings VALUES('TEST-SAMPLE',1500,10000);`);
  const ledger=createCommissionCompletion({db,env:{NODE_ENV:'test',COMMISSION_ISSUANCE_ENABLED:'true'},now:()=>new Date('2026-11-21T12:00:00Z')});
  ledger.approveSeries(2026,{unused:true});ledger.accept('TEST-SAMPLE',{userId:'supplier',email:'synthetic-supplier@example.invalid'});ledger.accept('TEST-SAMPLE',{userId:'renter',email:'synthetic-renter@example.invalid'});
  const invoice=ledger.invoice('TEST-SAMPLE'),credit=ledger.credit(invoice.document_id,500,'TEST-SAMPLE-PARTIAL-CREDIT');
  const issuer={issuerName:'TEST operatorė – Pavyzdė Pavyzdinė',issuerAddress:'TEST g. 1, Vilnius (sintetinis adresas)',individualActivityCertificate:'TEST-IV-000001',vatMode:'not_vat_registered'};
  const common={status:'issued',created_at:'2026-11-21',rental_basis_cents:10000};
  const invoiceInput={...common,document_key:invoice.number,invoice_number:invoice.number,kind:'platform_fee',amount_cents:invoice.amount_cents};
  const creditInput={...common,document_key:credit.number,invoice_number:credit.number,kind:'credit_note',amount_cents:credit.amount_cents,related_invoice_number:invoice.number,original_amount_cents:1500,reason:'TEST – platformos komisinis sumažintas 5,00 EUR po sąskaitos parengimo.'};
  const invoicePdf=await renderTestInvoicePdf(invoiceInput,{issuer,recipientName:'TEST nuomotojas – Pavyzdys Pavyzdinis'}),creditPdf=await renderTestInvoicePdf(creditInput,{issuer,recipientName:'TEST nuomotojas – Pavyzdys Pavyzdinis'});
  return {invoice:{number:invoice.number,amountCents:1500,pdf:invoicePdf},credit:{number:credit.number,amountCents:500,originalNumber:invoice.number,pdf:creditPdf},isolated:true,realSeriesUsed:false};
 }finally{db.close();fs.rmSync(root,{recursive:true,force:true});}
}
