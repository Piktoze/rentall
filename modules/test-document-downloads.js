(function(){
 const panel=document.getElementById('supplierPaymentsPanel');if(!panel)return;
 const section=document.createElement('section');section.id='rioTestDocumentSamples';section.hidden=true;section.className='dashboard-panel';
 const title=document.createElement('h3');title.textContent='TEST dokumentų pavyzdžiai';const note=document.createElement('p');note.textContent='Sintetiniai duomenys. Šie PDF negalioja apskaitai ir nenaudoja tikros RIO serijos.';section.append(title,note);panel.append(section);
 let pending=false,loaded=false;
 async function load(){if(pending||loaded)return;pending=true;try{const response=await fetch('/api/supplier/accounting/test-examples',{credentials:'same-origin',cache:'no-store'});if(!response.ok)return;const data=await response.json();if(data.synthetic!==true||data.realSeriesUsed!==false)return;
  for(const item of data.documents){const expected='/api/supplier/accounting/test-examples/'+item.kind+'.pdf';if(!['invoice','credit'].includes(item.kind)||item.url!==expected)continue;const link=document.createElement('a');link.className='secondary';link.href=expected;link.textContent=item.kind==='invoice'?'Atsisiųsti TEST komisinio sąskaitą (15,00 EUR)':'Atsisiųsti TEST dalinę kreditinę (5,00 EUR)';link.style.display='block';link.style.whiteSpace='normal';link.style.overflowWrap='anywhere';link.style.boxSizing='border-box';link.style.maxWidth='100%';link.style.marginBottom='12px';section.append(link);}section.hidden=false;loaded=true;
 }finally{pending=false;}}
 document.getElementById('supplierPaymentsBtn')?.addEventListener('click',()=>load().catch(()=>{}));
 document.addEventListener('rentinorbit:auth-ui-updated',()=>{if(panel.classList.contains('open'))load().catch(()=>{});});
 new MutationObserver(()=>{if(panel.classList.contains('open'))load().catch(()=>{});}).observe(panel,{attributes:true,attributeFilter:['class']});
 if(panel.classList.contains('open'))load().catch(()=>{});
})();
