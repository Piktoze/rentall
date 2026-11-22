import path from 'node:path';
import os from 'node:os';
export const commissionSeriesYear=date=>Number(new Intl.DateTimeFormat('en',{timeZone:'Europe/Vilnius',year:'numeric'}).format(date));
// New commercial enrollments only. No legacy invoices/orders are adopted.
export function createCommissionCompletion({db,env={},now=()=>new Date()}){
 if(env.NODE_ENV==='test'&&db.name!==':memory:'&&!path.resolve(db.name).startsWith(path.resolve(os.tmpdir())+path.sep))throw Error('COMMISSION_TEST_STORE_REQUIRED');
 db.exec(`CREATE TABLE IF NOT EXISTS commission_return_acceptance(booking_id TEXT NOT NULL,party TEXT NOT NULL CHECK(party IN ('customer','supplier')),user_id TEXT NOT NULL,accepted_at TEXT NOT NULL,PRIMARY KEY(booking_id,party));
 CREATE TABLE IF NOT EXISTS commission_documents(document_id INTEGER PRIMARY KEY,booking_id TEXT NOT NULL,kind TEXT NOT NULL,source_id INTEGER,amount_cents INTEGER NOT NULL,number TEXT UNIQUE,issued_at TEXT NOT NULL,snapshot TEXT NOT NULL);
 CREATE UNIQUE INDEX IF NOT EXISTS commission_one_invoice ON commission_documents(booking_id) WHERE kind='invoice';
 CREATE TABLE IF NOT EXISTS commission_series(year INTEGER PRIMARY KEY,last_number INTEGER NOT NULL,approval TEXT NOT NULL);
 CREATE TRIGGER IF NOT EXISTS commission_documents_immutable_update BEFORE UPDATE ON commission_documents BEGIN SELECT RAISE(ABORT,'COMMISSION_ORIGINAL_IMMUTABLE'); END;
 CREATE TRIGGER IF NOT EXISTS commission_documents_immutable_delete BEFORE DELETE ON commission_documents BEGIN SELECT RAISE(ABORT,'COMMISSION_ORIGINAL_IMMUTABLE'); END;
 CREATE TABLE IF NOT EXISTS commission_credit_requests(request_id TEXT PRIMARY KEY,document_id INTEGER NOT NULL,invoice_id INTEGER NOT NULL,amount_cents INTEGER NOT NULL);`);
 const fail=c=>{throw Object.assign(Error(c),{code:c});};
 function owned(id){if(!db.prepare("SELECT 1 FROM sqlite_master WHERE name='commercial_sct_enrollments'").get()||!db.prepare('SELECT 1 FROM commercial_sct_enrollments WHERE booking_id=?').get(id))fail('COMMISSION_NEW_COMMERCIAL_ORDER_REQUIRED');}
 function accept(id,user){owned(id);const b=db.prepare('SELECT b.*,l.owner_email FROM rental_bookings b JOIN rental_listings l USING(listing_id) WHERE booking_id=?').get(id);
  const u=db.prepare('SELECT user_id,email,role FROM app_users WHERE user_id=?').get(user?.userId);if(!u||u.email.toLowerCase()!==user.email?.toLowerCase())fail('COMMISSION_AUTH_REQUIRED');
  const party=u.email.toLowerCase()===b?.customer_email?.toLowerCase()?'customer':u.email.toLowerCase()===b?.owner_email?.toLowerCase()?'supplier':null;
  if(!party||b.customer_email?.toLowerCase()===b.owner_email?.toLowerCase())fail('COMMISSION_PARTY_REQUIRED');
  if(b.status!=='returned'||b.return_condition!=='good')fail('COMMISSION_GOOD_RETURN_REQUIRED');
  db.prepare('INSERT OR IGNORE INTO commission_return_acceptance VALUES(?,?,?,?)').run(id,party,u.user_id,now().toISOString());return readiness(id);
 }
 function readiness(id){owned(id);const rows=db.prepare('SELECT party,accepted_at FROM commission_return_acceptance WHERE booking_id=?').all(id);return {bothAccepted:rows.length===2,parties:rows};}
 function approveSeries(year,{unused,lastNumber}={}){
  if(env.NODE_ENV!=='test'&&env.COMMISSION_NUMBERING_ACTIVATION_APPROVED!=='true')fail('COMMISSION_SERIES_OPERATOR_ACTIVATION_REQUIRED');
  if(!Number.isSafeInteger(year)||year<2026||!(unused===true&&lastNumber===undefined||unused===false&&Number.isSafeInteger(lastNumber)&&lastNumber>0))fail('COMMISSION_SERIES_FACT_REQUIRED');
  db.prepare('INSERT INTO commission_series VALUES(?,?,?)').run(year,unused?0:lastNumber,unused?'confirmed_unused':'confirmed_last_number');
 }
 function number(date){const year=commissionSeriesYear(date);const row=db.prepare('SELECT * FROM commission_series WHERE year=?').get(year);if(!row)fail('COMMISSION_SERIES_NOT_APPROVED');
  const n=row.last_number+1;if(n>999999)fail('COMMISSION_SERIES_EXHAUSTED');db.prepare('UPDATE commission_series SET last_number=? WHERE year=?').run(n,year);return `${env.NODE_ENV==='test'?'TEST-RIO':'RIO'}-${year}-${String(n).padStart(6,'0')}`;
 }
 function invoice(id){return db.transaction(()=>{owned(id);const prior=db.prepare("SELECT * FROM commission_documents WHERE booking_id=? AND kind='invoice'").get(id);if(prior)return prior;
  const b=db.prepare('SELECT b.*,e.hold_reason,p.fee_cents,p.amount_cents FROM rental_bookings b JOIN commercial_sct_enrollments e USING(booking_id) JOIN commercial_sct_bindings p USING(booking_id) WHERE booking_id=?').get(id);
  if(b.customer_legal_kind==='company'){
   const owner=db.prepare('SELECT owner_email FROM rental_listings WHERE listing_id=?').get(b.listing_id)?.owner_email;
   const profile=db.prepare("SELECT 1 FROM sqlite_master WHERE name='supplier_business_profiles'").get()?db.prepare('SELECT * FROM supplier_business_profiles WHERE supplier_email=? COLLATE NOCASE').get(owner):null;
   if(!profile||profile.reviewed!==1||!['company','individual'].includes(profile.legal_kind))fail('PRIVATE_SUPPLIER_COMPANY_RENTER_BLOCKED');
  }
  if(!readiness(id).bothAccepted||b.status!=='returned'||b.return_condition!=='good'||b.payment_status!=='paid'||b.hold_reason||b.stripe_refund_id||Number(b.security_deposit_amount||0)!==0)fail('COMMISSION_COMPLETION_NOT_READY');
  for(const table of ['rental_disputes','stripe_rental_disputes'])if(db.prepare("SELECT 1 FROM sqlite_master WHERE name=?").get(table)&&db.prepare(`SELECT 1 FROM ${table} WHERE booking_id=?`).get(id))fail('COMMISSION_UNRESOLVED_DISPUTE');
  if(env.COMMISSION_ISSUANCE_ENABLED!=='true')fail('COMMISSION_ISSUANCE_NOT_APPROVED');
  if(env.NODE_ENV!=='test'&&env.COMMISSION_ACCOUNTING_REVIEWED!=='true')fail('COMMISSION_ACCOUNTING_REVIEW_REQUIRED');
  if(b.fee_cents===0)return null;
  const ownerEmail=db.prepare('SELECT owner_email FROM rental_listings WHERE listing_id=?').get(b.listing_id)?.owner_email;
  const billing=db.prepare("SELECT 1 FROM sqlite_master WHERE name='supplier_business_profiles'").get()?db.prepare('SELECT * FROM supplier_business_profiles WHERE supplier_email=? COLLATE NOCASE').get(ownerEmail):null;
  if(env.NODE_ENV!=='test'&&(!billing?.legal_name||!billing?.business_address||billing.reviewed!==1))fail('COMMISSION_RECIPIENT_BILLING_REVIEW_REQUIRED');
  const recipientUserId=db.prepare('SELECT user_id FROM app_users WHERE email=? COLLATE NOCASE').get(ownerEmail)?.user_id;
  if(!recipientUserId)fail('COMMISSION_RECIPIENT_ACCOUNT_REQUIRED');
  const date=now(),n=number(date),snapshot=JSON.stringify({bookingId:id,recipientUserId,issuer:'Ieva Piktožė',activityCertificate:'751612',issuerAddress:'Paryžiaus Komunos g. 10-30, Klaipėda, 91151 Klaipėdos m. sav., Lietuva',recipientEmail:ownerEmail,recipientName:billing?.legal_name||null,recipientAddress:billing?.business_address||null,recipientRegistration:billing?.registration_number||null,description:'RentInOrbit tarpininkavimo paslauga',quantity:1,currency:'EUR',kind:'platform_commission',grossRentalCents:b.amount_cents,commissionCents:b.fee_cents,feePayer:'platform',vatStatus:'not_vat_registered',serviceCompletedAt:date.toISOString(),returnAcceptances:readiness(id).parties});
  const r=db.prepare("INSERT INTO commission_documents(booking_id,kind,amount_cents,number,issued_at,snapshot) VALUES(?,'invoice',?,?,?,?)").run(id,b.fee_cents,n,date.toISOString(),snapshot);return db.prepare('SELECT * FROM commission_documents WHERE document_id=?').get(r.lastInsertRowid);
 }).immediate();}
 function credit(invoiceId,amountCents,requestId){return db.transaction(()=>{
  const prior=db.prepare('SELECT * FROM commission_credit_requests WHERE request_id=?').get(requestId);if(prior){if(prior.invoice_id!==invoiceId||prior.amount_cents!==amountCents)fail('COMMISSION_CREDIT_KEY_CONFLICT');return db.prepare('SELECT * FROM commission_documents WHERE document_id=?').get(prior.document_id);}
  if(env.COMMISSION_ISSUANCE_ENABLED!=='true'||env.NODE_ENV!=='test'&&env.COMMISSION_ACCOUNTING_REVIEWED!=='true')fail('COMMISSION_ISSUANCE_NOT_APPROVED');
  if(typeof requestId!=='string'||requestId.length<8||requestId.length>150||!Number.isSafeInteger(amountCents)||amountCents<=0)fail('COMMISSION_CREDIT_INVALID');
  const original=db.prepare("SELECT * FROM commission_documents WHERE document_id=? AND kind='invoice'").get(invoiceId);if(!original)fail('COMMISSION_INVOICE_REQUIRED');
  const used=db.prepare("SELECT COALESCE(SUM(amount_cents),0) n FROM commission_documents WHERE source_id=? AND kind='credit'").get(invoiceId).n;if(used+amountCents>original.amount_cents)fail('COMMISSION_CREDIT_EXCEEDS_INVOICE');
  const date=now(),n=number(date);const r=db.prepare("INSERT INTO commission_documents(booking_id,kind,source_id,amount_cents,number,issued_at,snapshot) VALUES(?,'credit',?,?,?,?,?)").run(original.booking_id,invoiceId,amountCents,n,date.toISOString(),JSON.stringify({originalNumber:original.number,originalDocumentId:invoiceId,reason:'commission_reduced',requestId}));
  db.prepare('INSERT INTO commission_credit_requests VALUES(?,?,?,?)').run(requestId,r.lastInsertRowid,invoiceId,amountCents);return db.prepare('SELECT * FROM commission_documents WHERE document_id=?').get(r.lastInsertRowid);
 }).immediate();}
 return {accept,readiness,approveSeries,invoice,credit};
}
