// RentInOrbit invoice renderer. This module produces TEST PDFs only; it does NOT issue invoices.
// The production issuance gate is intentionally not provided before tax/legal sign-off.
import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';

const fontFile=path.resolve('node_modules','dejavu-fonts-ttf','ttf','DejaVuSans.ttf');
const brandLogoFile=path.resolve('assets','brand','rentinorbit-logo-horizontal-dark-web.png');
const money=cents=>{
  if(!Number.isSafeInteger(Number(cents)) || Number(cents)<0)throw new Error('Invalid invoice amount');
  return (Number(cents)/100).toFixed(2).replace('.',',')+' EUR';
};
const clean=v=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,260);

export function invoiceOperatorProfile(env=process.env){
 return Object.freeze({
  brand:'RentInOrbit',
  issuerName:clean(env.LEGAL_OPERATOR_NAME||''),
  issuerAddress:clean(env.LEGAL_OPERATOR_ADDRESS||''),
  individualActivityCertificate:clean(env.LEGAL_IV_CERTIFICATE||''),
  vatMode:'pending_review',
  emailShown:false
 });
}

export async function renderTestInvoicePdf(invoice,{issuer={},recipientName='TEST – nuomotojas'}={}){
 if(!invoice || !String(invoice.document_key||'').startsWith('TEST-') || !['draft','issued'].includes(invoice.status)){
  throw new Error('Only isolated synthetic invoice drafts may be rendered');
 }
 if(!fs.existsSync(fontFile))throw new Error('PDF Lithuanian font package not installed');
 const info={
   issuerName:clean(issuer.issuerName||'TEST – nepatvirtintas operatorius'),
   issuerAddress:clean(issuer.issuerAddress||'TEST – adresas nepatvirtintas'),
   certificate:clean(issuer.individualActivityCertificate||''),
   recipientName:clean(recipientName)
 };
 const doc=new PDFDocument({size:'A4',margin:48,info:{Title:'TEST – RentInOrbit SF juodraštis',Author:'RentInOrbit',Subject:'Negaliojantis TEST dokumentas'},compress:true});
 const chunks=[];
 doc.on('data',part=>chunks.push(part));
 const finished=new Promise((resolve,reject)=>{doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)))});
 doc.registerFont('Lithuanian',fontFile);
 doc.font('Lithuanian');
 if(fs.existsSync(brandLogoFile)){
   doc.image(brandLogoFile,48,36,{fit:[220,62],align:'left',valign:'center'});
   doc.x=48;doc.y=110;
 }else{
   doc.fontSize(17).fillColor('#164cab').text('RentInOrbit');
   doc.moveDown(.8);
 }
 doc.fontSize(20).fillColor('#142437').text('TEST – sąskaitos faktūros JUODRAŠTIS');
 doc.moveDown(.4).fontSize(10).fillColor('#b42a2a')
   .text('NEGALIOJANTIS APSKAITOS DOKUMENTAS. NEGALIMA NAUDOTI MOKESČIŲ APSKAITOJE.');
 doc.moveDown(1).fillColor('#142437').fontSize(11)
   .text('Juodraščio identifikatorius: '+clean(invoice.document_key))
   .text('Būsena: '+clean(invoice.status))
   .text('Dokumento tipas: '+clean(invoice.kind))
   .text('Išrašytojas: '+info.issuerName)
   .text('Adresas: '+info.issuerAddress);
 if(info.certificate)doc.text('Individualios veiklos pažymos Nr.: '+info.certificate);
 doc.moveDown(.5).text('Gavėjas: '+info.recipientName)
   .text('Paslauga: platformos tarpininkavimo paslauga (TEST)')
   .text('PVM režimas: dar nepatvirtintas')
   .moveDown(1);
 doc.fontSize(14).text('Bendra suma: '+money(invoice.amount_cents));
 doc.moveDown(2).fontSize(9).fillColor('#64748b')
   .text('Automatiškai sukurtas TEST peržiūros PDF. Tikros sąskaitos automatiškai neišrašomos ir nesiunčiamos.');
 doc.end();
 return await finished;
}


const escapeEmail=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
// Email preview is intentionally inert. The actual sender must be enabled only after
// operator VAT status, issuance authority, legal documents and delivery ownership are verified.
export function renderTestInvoiceEmailPreview(invoice,{recipientName='TEST – gavėjas'}={}){
 if(!invoice||!String(invoice.document_key||'').startsWith('TEST-'))throw new Error('Only TEST invoice email preview supported');
 const name=escapeEmail(clean(recipientName));
 const key=escapeEmail(clean(invoice.document_key));
 const amount=escapeEmail(money(invoice.amount_cents));
 return '<!doctype html><html lang="lt"><head><meta charset="utf-8"><title>RentInOrbit TEST SF</title></head>'+
  '<body style="font-family:Arial,sans-serif;color:#18324b;background:#f5f8ff;padding:26px">'+
  '<main style="background:white;max-width:620px;margin:auto;padding:26px;border-radius:14px">'+
  '<h1 style="color:#164cab">RentInOrbit</h1>'+
  '<p><strong>TEST – negaliojantis apskaitos dokumentas</strong></p>'+
  '<p>Sveiki, '+name+'.</p><p>Sukurtas sąskaitos juodraštis: '+key+'.</p>'+
  '<p>Suma: <strong>'+amount+'</strong></p>'+
  '<p>Šis laiškas yra tik peržiūra. Tikrų SF išrašymas ir siuntimas išjungti.</p>'+
  '</main></body></html>';
}
