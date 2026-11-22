(function(){
 const panel=document.getElementById('supplierPaymentsPanel');if(!panel)return;
 const section=document.createElement('section');section.id='rioOwnedCommissionDocuments';section.className='dashboard-panel';section.hidden=true;
 const heading=document.createElement('h3');heading.textContent='Mano užsakymų komisinio dokumentai (TEST)';
 const note=document.createElement('p');note.textContent='Tik sintetiniai užsakymai ir TEST numeracija. Dokumentai negalioja apskaitai. Mokėjimai neatliekami.';
 const status=document.createElement('p');status.setAttribute('role','status');
 const orders=document.createElement('div');orders.dataset.commissionOrders='';
 const create=document.createElement('button');create.type='button';create.className='secondary';create.textContent='Sukurti mano sintetinį užbaigtą TEST užsakymą';
 section.append(heading,note,status,orders,create);panel.append(section);
 for(const node of [section,orders,create]){node.style.minWidth='0';node.style.maxWidth='100%';node.style.boxSizing='border-box';node.style.overflowWrap='anywhere';}
 create.style.whiteSpace='normal';
 const base='/api/supplier/commission-documents';let generation=0;
 const money=(amount,credit=false)=>(credit?'−':'')+new Intl.NumberFormat('lt-LT',{style:'currency',currency:'EUR'}).format(amount/100);
 function clear(){generation++;section.hidden=true;orders.replaceChildren();status.textContent='';create.disabled=false;}
 function render(data){
  orders.replaceChildren();const documents=Array.isArray(data.documents)?data.documents:[];
  status.textContent=documents.length?'Dokumentai pagal užsakymą:':'Komisinio dokumentų dar nėra. Jie bus pateikti užbaigus nuomą ir patvirtinus tinkamą grąžinimą.';
  const groups=new Map();for(const item of documents){if(!groups.has(item.bookingId))groups.set(item.bookingId,[]);groups.get(item.bookingId).push(item);}
  for(const [id,items] of groups){
   const card=document.createElement('article');card.dataset.commissionBooking=id;
   const title=document.createElement('h4');title.textContent='Užsakymas '+id;card.append(title);
   for(const item of items.sort((a,b)=>a.id-b.id)){
    if(!/^\/api\/supplier\/commission-documents\/(ledger|[a-f0-9-]{36})\/[1-9]\d*\.pdf$/.test(item.url))continue;
    const row=document.createElement('p');row.dataset.documentKind=item.kind;
    const label=document.createElement('span');label.textContent=(item.kind==='credit'?'Kreditinė ':'Komisinio sąskaita ')+item.number+' · '+money(item.amountCents,item.kind==='credit');
    const date=document.createElement('small');date.textContent=' · Data: '+String(item.issuedAt||'').slice(0,10);
    row.append(label,date);
    if(item.originalNumber){const relation=document.createElement('span');relation.textContent=' · Pradinė sąskaita: '+item.originalNumber;row.append(relation);}
    const link=document.createElement('a');link.className='secondary';link.href=item.url;link.textContent='Atsisiųsti PDF';link.style.display='block';link.style.whiteSpace='normal';row.append(link);card.append(row);
   }
   orders.append(card);
  }
  section.hidden=false;
 }
 async function load(){
  const ticket=++generation;orders.replaceChildren();status.textContent='Įkeliami dokumentai…';
  try{const response=await fetch(base,{credentials:'same-origin',cache:'no-store'});if(ticket!==generation)return;
   if(!response.ok){clear();return;}
   const data=await response.json();if(ticket!==generation)return;
   if(data.testOnly!==true||data.realSeriesUsed!==false){clear();return;}render(data);
  }catch{if(ticket===generation){section.hidden=false;status.textContent='Dokumentų įkelti nepavyko. Uždaryk ir vėl atidaryk Išmokas.';}}
 }
 create.addEventListener('click',async()=>{
  const ticket=++generation;create.disabled=true;status.textContent='Kuriamas izoliuotas TEST užsakymas…';
  try{const response=await fetch(base+'/test-order',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});
   if(ticket!==generation)return;if(!response.ok)throw Error('unavailable');const data=await response.json();if(ticket===generation)render(data);
  }catch{if(ticket===generation)status.textContent='TEST užsakymo sukurti nepavyko. Bandyk dar kartą.';}
  finally{if(ticket===generation)create.disabled=false;}
 });
 document.addEventListener('rentinorbit:auth-ui-updated',()=>{clear();if(panel.classList.contains('open'))load();});
 new MutationObserver(()=>{if(panel.classList.contains('open'))load();else clear();}).observe(panel,{attributes:true,attributeFilter:['class']});
 if(panel.classList.contains('open'))load();
})();
