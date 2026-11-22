// PRELOADED synthetic archive, never calls issuance/credit/approveSeries or production DB imports.
import Database from 'better-sqlite3';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
export function prepareIssuedArchive(users,{preview=true}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rio-issued-archive-')),file=path.join(root,'synthetic.sqlite'),writer=new Database(file);
 writer.exec('CREATE TABLE commission_documents(document_id INTEGER PRIMARY KEY,booking_id TEXT,kind TEXT,source_id INTEGER,amount_cents INTEGER,number TEXT,issued_at TEXT,snapshot TEXT)');
 const insert=writer.prepare('INSERT INTO commission_documents VALUES(?,?,?,?,?,?,?,?)');
 for(const [index,user] of users.entries()){
  const id=index*10+1,booking='SYNTHETIC-ORDER-'+index,n='RIO-2099-'+String(id).padStart(6,'0');
  const snapshot={syntheticPreview:preview,bookingId:booking,recipientUserId:user.userId,recipientEmail:user.email,
   issuer:'SINTETINĖ operatorė',issuerAddress:'Pavyzdžio g. 1, TEST miestas',activityCertificate:'SYNTHETIC-IV',
   recipientName:'SINTETINIS nuomotojas '+index,recipientAddress:'Pavyzdžio g. 2, TEST miestas',recipientRegistration:'SYNTHETIC-'+index,
   description:'Tarpininkavimo paslauga',quantity:1,currency:'EUR',grossRentalCents:10000,commissionCents:1500,
   feePayer:'platform',vatStatus:'not_vat_registered',serviceCompletedAt:'2099-01-02T10:00:00Z'};
  insert.run(id,booking,'invoice',null,1500,n,'2099-01-02T10:01:00Z',JSON.stringify(snapshot));
  for(const [offset,amount] of [[1,500],[2,200]])insert.run(id+offset,booking,'credit',id,amount,'RIO-2099-'+String(id+offset).padStart(6,'0'),'2099-01-03T10:00:00Z',JSON.stringify({originalNumber:n,originalDocumentId:id,reason:'Sintetinis komisinio sumažinimas'}));
  insert.run(id+3,booking,'invoice',null,1500,'TEST-RIO-2099-'+String(id+3).padStart(6,'0'),'2099-01-02',JSON.stringify(snapshot));
 }
 writer.close();const db=new Database(file,{readonly:true,fileMustExist:true});
 return {db,file,cleanup(){db.close();fs.rmSync(root,{recursive:true,force:true});}};
}
