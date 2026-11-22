import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {commissionSeriesYear,createCommissionCompletion} from './commission-completion.js';
import {renderTestInvoicePdf} from './accounting-sf-v286.js';
const base='/api/supplier/commission-documents';
const normalized=value=>String(value||'').trim().toLowerCase();
// Read-only adapter: it never initializes or issues documents in the application DB.
export function readSupplierTestDocuments(db,email,source='ledger'){
 if(!db.prepare("SELECT 1 FROM sqlite_master WHERE name='commission_documents'").get())return [];
 const rows=db.prepare(`SELECT d.*,i.number original_number,i.amount_cents original_amount,i.snapshot invoice_snapshot
 FROM commission_documents d JOIN commission_documents i ON i.document_id=CASE WHEN d.kind='credit' THEN d.source_id ELSE d.document_id END
 JOIN rental_bookings b ON b.booking_id=d.booking_id JOIN rental_listings l ON l.listing_id=b.listing_id
 WHERE i.kind='invoice' AND l.owner_email=? COLLATE NOCASE AND d.number LIKE 'TEST-RIO-%' AND i.number LIKE 'TEST-RIO-%'
 ORDER BY d.document_id DESC LIMIT 100`).all(normalized(email));
 return rows.flatMap(row=>{
  let snapshot;try{snapshot=JSON.parse(row.invoice_snapshot);}catch{return [];}
  if(normalized(snapshot.recipientEmail)!==normalized(email)||!['invoice','credit'].includes(row.kind))return [];
  return [{id:row.document_id,bookingId:row.booking_id,kind:row.kind,number:row.number,amountCents:row.amount_cents,
   originalNumber:row.kind==='credit'?row.original_number:null,originalAmountCents:row.original_amount,
   issuedAt:row.issued_at,serviceCompletedAt:snapshot.serviceCompletedAt,rentalBasisCents:snapshot.grossRentalCents,
   url:`${base}/${source}/${row.document_id}.pdf`}];
 });
}
export function createSyntheticCommissionOrder(user){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rio-owned-commission-')),db=new Database(path.join(root,'synthetic.sqlite'));
 const cleanup=()=>{db.close();fs.rmSync(root,{recursive:true,force:true});};
 try{
  db.exec(`CREATE TABLE app_users(user_id TEXT,email TEXT,role TEXT);
   CREATE TABLE rental_listings(listing_id TEXT,owner_email TEXT);
   CREATE TABLE rental_bookings(booking_id TEXT,listing_id TEXT,customer_email TEXT,status TEXT,return_condition TEXT,payment_status TEXT,stripe_refund_id TEXT,security_deposit_amount INTEGER);
   CREATE TABLE commercial_sct_enrollments(booking_id TEXT,hold_reason TEXT);
   CREATE TABLE commercial_sct_bindings(booking_id TEXT,fee_cents INTEGER,amount_cents INTEGER);`);
  const bookingId='TEST-ORDER-'+crypto.randomUUID(),listingId='TEST-ITEM-'+crypto.randomUUID(),renterId=crypto.randomUUID(),renterEmail=renterId+'@example.invalid';
  db.prepare('INSERT INTO app_users VALUES(?,?,?)').run(user.userId,user.email,'supplier');
  db.prepare('INSERT INTO app_users VALUES(?,?,?)').run(renterId,renterEmail,'customer');
  db.prepare('INSERT INTO rental_listings VALUES(?,?)').run(listingId,user.email);
  db.prepare("INSERT INTO rental_bookings VALUES(?,?,?,'returned','good','paid',NULL,0)").run(bookingId,listingId,renterEmail);
  db.prepare('INSERT INTO commercial_sct_enrollments VALUES(?,NULL)').run(bookingId);
  db.prepare('INSERT INTO commercial_sct_bindings VALUES(?,1500,10000)').run(bookingId);
  const ledger=createCommissionCompletion({db,env:{NODE_ENV:'test',COMMISSION_ISSUANCE_ENABLED:'true'}});
  ledger.approveSeries(commissionSeriesYear(new Date()),{unused:true});
  ledger.accept(bookingId,user);ledger.accept(bookingId,{userId:renterId,email:renterEmail});
  const invoice=ledger.invoice(bookingId);ledger.credit(invoice.document_id,500,'TEST-CREDIT-'+bookingId);
  return {db,bookingId,cleanup};
 }catch(error){cleanup();throw error;}
}
export function installSupplierCommissionDocuments(app,{enabled,requireRole,db,build=createSyntheticCommissionOrder}){
 const fixtures=new Map();
 const ownerKey=user=>JSON.stringify([user.userId,normalized(user.email)]);
 const available=(req,res,next)=>{res.set('Cache-Control','private, no-store');if(!enabled())return res.sendStatus(404);next();};
 const list=user=>{
  const rows=readSupplierTestDocuments(db,user.email),fixture=fixtures.get(ownerKey(user));
  return [...rows,...(fixture?readSupplierTestDocuments(fixture.db,user.email,fixture.source):[])];
 };
 app.get(base,requireRole('supplier','admin'),available,(req,res)=>res.json({testOnly:true,realSeriesUsed:false,documents:list(req.appUser)}));
 app.post(base+'/test-order',requireRole('supplier','admin'),available,(req,res)=>{
  const key=ownerKey(req.appUser);let fixture=fixtures.get(key);
  if(!fixture){if(fixtures.size>=50)return res.status(429).json({code:'TEST_FIXTURE_LIMIT'});
   fixture={...build(req.appUser),source:crypto.randomUUID()};fixtures.set(key,fixture);}
  res.json({testOnly:true,realSeriesUsed:false,booking:{bookingId:fixture.bookingId,status:'returned',bothReturnsAccepted:true,syntheticPaidPrecondition:true,stripeOperationsPerformed:false},documents:list(req.appUser)});
 });
 app.get(base+'/:source/:id.pdf',requireRole('supplier','admin'),available,async(req,res)=>{
  // Match only the authenticated owner's server-generated URLs; no caller-selected email or filesystem path.
  const url=`${base}/${req.params.source}/${req.params.id}.pdf`,doc=list(req.appUser).find(item=>item.url===url);
  if(!doc)return res.sendStatus(404);
  try{
   const pdf=await renderTestInvoicePdf({status:'issued',document_key:doc.number,invoice_number:doc.number,
    issued_at:doc.issuedAt,booking_id:doc.bookingId,service_completed_at:doc.serviceCompletedAt,
    kind:doc.kind==='credit'?'credit_note':'platform_fee',amount_cents:doc.amountCents,
    rental_basis_cents:doc.rentalBasisCents,related_invoice_number:doc.originalNumber,
    original_amount_cents:doc.originalAmountCents,reason:doc.kind==='credit'?'TEST – komisinio sumažinimas':null},
    {issuer:{issuerName:'TEST operatorė – Pavyzdė Pavyzdinė',issuerAddress:'TEST g. 1, Vilnius (sintetinis adresas)',individualActivityCertificate:'TEST-IV-000001',vatMode:'not_vat_registered'},recipientName:'TEST nuomotojas – sintetinis gavėjas'});
   res.set('Content-Disposition',`attachment; filename="${doc.number}.pdf"`);res.type('application/pdf').send(pdf);
  }catch{res.status(500).json({code:'TEST_DOCUMENT_UNAVAILABLE'});}
 });
 return {cleanup(){for(const item of fixtures.values())item.cleanup();fixtures.clear();}};
}
