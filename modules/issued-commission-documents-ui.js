(function(){
 const panel=document.getElementById('supplierPaymentsPanel');if(!panel)return;
 const section=document.createElement('section');section.id='rioIssuedCommissionDocuments';section.className='dashboard-panel';section.hidden=true;
 section.style.minWidth='0';section.style.overflowWrap='anywhere';
 const title=document.createElement('h3'),notice=document.createElement('p'),status=document.createElement('p'),list=document.createElement('div');status.setAttribute('role','status');section.append(title,notice,status,list);panel.append(section);
 let version=0;
 function clear(){version++;section.hidden=true;list.replaceChildren();status.textContent='';}
 async function load(){const ticket=++version;list.replaceChildren();try{
  const response=await fetch('/api/supplier/issued-commission-documents',{credentials:'same-origin',cache:'no-store'});if(ticket!==version)return;
  if(!response.ok){clear();return;}const data=await response.json();if(ticket!==version)return;
  if(data.documentClass!=='commercial'||typeof data.syntheticPreview!=='boolean'){clear();return;}
  title.textContent=data.syntheticPreview?'Komercinių dokumentų peržiūra (SINTETINIAI)':'Mano užsakymų komisinio dokumentai';
  notice.textContent=data.syntheticPreview?'Iš anksto paruošti sintetiniai įrašai. Negalioja apskaitai; tikroji numeracija neaktyvuota.':'Jau išrašyti dokumentai pagal išsaugotus gavėjo ir užsakymo duomenis.';
  const docs=(data.documents||[]).filter(d=>/^RIO-\d{4}-\d{6}$/.test(d.number)&&/^\/api\/supplier\/issued-commission-documents\/[1-9]\d*\.pdf$/.test(d.url)&&d.syntheticPreview===data.syntheticPreview);
  status.textContent=docs.length?'Dokumentai pagal užsakymą:':'Išrašytų komisinio dokumentų dar nėra.';
  const groups=new Map();for(const d of docs){if(!groups.has(d.bookingId))groups.set(d.bookingId,[]);groups.get(d.bookingId).push(d);}
  for(const [booking,items] of groups){const card=document.createElement('article');card.dataset.issuedBooking=booking;const h=document.createElement('h4');h.textContent='Užsakymas '+booking;card.append(h);
   for(const d of items.sort((a,b)=>a.id-b.id)){const row=document.createElement('p');row.dataset.issuedKind=d.kind;
    row.textContent=(d.kind==='credit'?'Kreditinė ':'Komisinio sąskaita ')+d.number+' · '+(d.kind==='credit'?'−':'')+new Intl.NumberFormat('lt-LT',{style:'currency',currency:'EUR'}).format(d.amountCents/100)+' · '+String(d.issuedAt).slice(0,10);
    if(d.originalNumber){const relation=document.createElement('span');relation.textContent=' · Pradinė sąskaita: '+d.originalNumber;row.append(relation);}
    const link=document.createElement('a');link.href=d.url;link.className='secondary';link.textContent='Atsisiųsti PDF';link.style.display='block';link.style.whiteSpace='normal';row.append(link);card.append(row);}
   list.append(card);}
  section.hidden=false;
 }catch{if(ticket===version){section.hidden=false;status.textContent='Dokumentų įkelti nepavyko. Atidaryk Išmokas iš naujo.';}}}
 document.addEventListener('rentinorbit:auth-ui-updated',()=>{clear();if(panel.classList.contains('open'))load();});
 new MutationObserver(()=>{if(panel.classList.contains('open'))load();else clear();}).observe(panel,{attributes:true,attributeFilter:['class']});
 if(panel.classList.contains('open'))load();
})();
