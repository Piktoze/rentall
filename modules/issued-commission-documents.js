// Read-only delivery of immutable issued commission documents. No issuance/numbering API.
import PDFDocument from 'pdfkit';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const projectRoot=fileURLToPath(new URL('../',import.meta.url));
const base='/api/supplier/issued-commission-documents',numberPattern=/^RIO-\d{4}-\d{6}$/;
const norm=v=>String(v||'').trim().toLowerCase();
const object=s=>{try{const v=JSON.parse(s);return v&&typeof v==='object'&&!Array.isArray(v)?v:null;}catch{return null;}};
export const issuedDeliveryEnabled=env=>env.COMMISSION_DOCUMENT_DELIVERY_ENABLED==='true'&&env.PRIVATE_TEST_ENABLED!=='true';
export function readIssuedCommissionDocuments(db,user,{preview=false}={}){
 if(!user?.userId||!user?.email||!db.prepare("SELECT 1 FROM sqlite_master WHERE name='commission_documents'").get())return [];
 // Historical recipient identity is authoritative. Current listing/profile edits cannot transfer an invoice.
 const rows=db.prepare(`SELECT d.*,i.number original_number,i.amount_cents original_amount,i.snapshot original_snapshot,i.booking_id original_booking,i.kind original_kind
 FROM commission_documents d JOIN commission_documents i ON i.document_id=CASE WHEN d.kind='credit' THEN d.source_id ELSE d.document_id END
 WHERE d.number GLOB 'RIO-*' AND i.number GLOB 'RIO-*' AND CASE WHEN json_valid(i.snapshot) THEN json_extract(i.snapshot,'$.recipientUserId') END=? ORDER BY d.document_id DESC`).all(user.userId);
 const valid=rows.flatMap(r=>{
  const s=object(r.original_snapshot),credit=object(r.snapshot);
  if(!Number.isSafeInteger(r.document_id)||r.document_id<=0||!s||s.quantity!==1||s.feePayer!=='platform'||!numberPattern.test(r.number)||!numberPattern.test(r.original_number)||r.original_kind!=='invoice'||!['invoice','credit'].includes(r.kind)||r.booking_id!==r.original_booking||s.bookingId!==r.booking_id)return [];
  if(s.recipientUserId!==user.userId||norm(s.recipientEmail)!==norm(user.email)||Boolean(s.syntheticPreview)!==preview)return [];
  if(![r.amount_cents,r.original_amount,s.grossRentalCents,s.commissionCents].every(n=>Number.isSafeInteger(n)&&n>=0)||s.commissionCents!==r.original_amount||s.currency!=='EUR'||s.vatStatus!=='not_vat_registered')return [];
  if(![s.issuer,s.issuerAddress,s.activityCertificate,s.recipientName,s.recipientAddress,s.description,s.serviceCompletedAt,r.issued_at].every(v=>typeof v==='string'&&v.trim())||!Number.isFinite(Date.parse(s.serviceCompletedAt))||!Number.isFinite(Date.parse(r.issued_at)))return [];
  if(r.kind==='credit'&&(!credit||credit.originalDocumentId!==r.source_id||credit.originalNumber!==r.original_number||typeof credit.reason!=='string'||!credit.reason.trim()))return [];
  return [{id:r.document_id,bookingId:r.booking_id,kind:r.kind,number:r.number,amountCents:r.amount_cents,issuedAt:r.issued_at,
   serviceCompletedAt:s.serviceCompletedAt,originalNumber:r.kind==='credit'?r.original_number:null,
   originalId:r.kind==='credit'?r.source_id:r.document_id,originalAmountCents:r.original_amount,
   reason:r.kind==='credit'?credit.reason:null,snapshot:s,syntheticPreview:preview,url:`${base}/${r.document_id}.pdf`}];
 });
 // Corrupt/excessive credits fail closed for their complete document family.
 const totals=new Map();for(const d of valid)if(d.kind==='credit')totals.set(d.originalId,(totals.get(d.originalId)||0)+d.amountCents);
 return valid.filter(d=>(totals.get(d.originalId)||0)<=d.originalAmountCents);
}
export const issuedDocumentView=d=>{const {snapshot,reason,originalAmountCents,originalId,...visible}=d;return visible;};
export async function renderIssuedCommissionPdf(d){
 const s=d.snapshot;if(!s||!numberPattern.test(d.number)||Boolean(s.syntheticPreview)!==d.syntheticPreview)throw Error('ISSUED_SNAPSHOT_REQUIRED');
 const date=new Date(d.issuedAt),pdf=new PDFDocument({size:'A4',margin:48,info:{Title:d.number,Author:s.issuer,CreationDate:date,ModDate:date}}),parts=[];
 const done=new Promise((resolve,reject)=>{pdf.on('data',b=>parts.push(b));pdf.on('end',()=>resolve(Buffer.concat(parts)));pdf.on('error',reject);});
 pdf.registerFont('LT',path.join(projectRoot,'node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf')).font('LT');
 pdf.image(path.join(projectRoot,'assets/brand/rentinorbit-logo-horizontal-dark-web.png'),48,36,{fit:[220,62]});pdf.y=110;
 if(d.syntheticPreview)pdf.fillColor('#aa2424').fontSize(13).text('SINTETINĖ PERŽIŪRA – NEGALIOJA APSKAITAI').moveDown();
 pdf.fillColor('#142437').fontSize(19).text(d.kind==='credit'?'KREDITINĖ SĄSKAITA FAKTŪRA':'SĄSKAITA FAKTŪRA').moveDown(.5).fontSize(10);
 const line=(label,v)=>pdf.text(label+': '+String(v||'').replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,500));
 line('Numeris',d.number);line('Išrašymo data',d.issuedAt.slice(0,10));line('Užsakymas',d.bookingId);line('Paslaugos užbaigimo data',s.serviceCompletedAt.slice(0,10));
 pdf.moveDown();line('Išrašytoja',s.issuer);line('Adresas',s.issuerAddress);line('IV pažymos Nr.',s.activityCertificate);
 pdf.moveDown();line('Gavėjas',s.recipientName);line('Gavėjo adresas',s.recipientAddress);if(s.recipientRegistration)line('Gavėjo registracijos Nr.',s.recipientRegistration);
 pdf.moveDown();line('Paslauga',s.description);pdf.text('Kiekis: 1; valiuta: EUR. Išrašytoja ne PVM mokėtoja; PVM neskaičiuojamas.');
 if(d.originalNumber){line('Pradinė sąskaita',d.originalNumber);line('Kreditavimo priežastis',d.reason==='commission_reduced'?'Platformos komisinio sumažinimas':d.reason);}
 const money=n=>(n/100).toFixed(2).replace('.',',')+' EUR';
 pdf.moveDown().fontSize(14).text((d.kind==='credit'?'Kredituojama suma: −':'Bendra suma: ')+money(d.amountCents));
 pdf.moveDown().fontSize(9).text('Platforma išrašo dokumentą tik už savo komisinį. Stripe kaštus dengia platforma.');
 pdf.end();return done;
}
export function installIssuedCommissionDocuments(app,{enabled,requireRole,getDb,preview=false}){
 const available=(req,res,next)=>{res.set('Cache-Control','private, no-store');if(!enabled())return res.sendStatus(404);next();};
 app.get(base,requireRole('supplier','admin'),available,(req,res)=>res.json({documentClass:'commercial',syntheticPreview:preview,documents:readIssuedCommissionDocuments(getDb(),req.appUser,{preview}).map(issuedDocumentView)}));
 app.get(base+'/:id.pdf',requireRole('supplier','admin'),available,async(req,res)=>{
  const d=readIssuedCommissionDocuments(getDb(),req.appUser,{preview}).find(d=>String(d.id)===req.params.id);if(!d)return res.sendStatus(404);
  try{const pdf=await renderIssuedCommissionPdf(d);res.set('Content-Disposition',`attachment; filename="${d.syntheticPreview?'PREVIEW-':''}${d.number}.pdf"`);res.type('application/pdf').send(pdf);}catch{res.status(500).json({code:'ISSUED_DOCUMENT_UNAVAILABLE'});}
 });
}
