// V254: GDPR rights request user interface. Staging only.
(() => {
  'use strict';
  const names={access:'Susipažinti su duomenimis',rectification:'Ištaisyti duomenis',erasure:'Prašyti ištrinti duomenis',restriction:'Apriboti tvarkymą',portability:'Perkelti duomenis',objection:'Nesutikti su tvarkymu'};
  const statuses={received:'Gautas',in_review:'Nagrinėjamas',awaiting_verification:'Tikrinama tapatybė',completed:'Užbaigtas',rejected:'Atmestas'};
  const btn=document.createElement('button');
  btn.type='button';btn.id='rioPrivacyRequestBtn';btn.textContent='Mano duomenų teisės';
  btn.style.cssText='display:block;margin-top:12px;border:1px solid #3476ae;border-radius:8px;padding:9px 12px;background:transparent;color:inherit;cursor:pointer';
  (document.querySelector('footer .footer-grid > div:last-child')||document.querySelector('footer'))?.appendChild(btn);
  const dialog=document.createElement('dialog'); dialog.id='rioPrivacyDialog'; dialog.setAttribute('aria-labelledby','rioPrivacyHeading');
  dialog.style.cssText='max-width:580px;width:calc(100% - 32px);max-height:85vh;overflow:auto;border:1px solid #b4cce0;border-radius:12px;padding:24px;background:#fff;color:#162d43';
  dialog.innerHTML=`<div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><h2 id="rioPrivacyHeading">Mano duomenų teisės</h2><button id="rioPrivacyClose" type="button">Uždaryti</button></div>
    <p>Čia registruojami prašymai dėl duomenų. Duomenys automatiškai neištrinami ar neperduodami.</p>
    <p id="rioPrivacyIdentity" role="status"></p>
    <form id="rioPrivacyForm"><label for="rioPrivacyType">Prašymo tipas</label><select id="rioPrivacyType" required style="display:block;width:100%;margin:8px 0 14px;padding:8px"></select>
    <label for="rioPrivacyDetails">Papildomas paaiškinimas (nebūtina)</label>
    <textarea id="rioPrivacyDetails" maxlength="1000" rows="3" style="display:block;width:100%;margin:8px 0 14px;padding:8px" placeholder="Nerašykite slaptažodžių, kortelės ar asmens dokumento duomenų."></textarea>
    <button type="submit" id="rioPrivacySubmit">Pateikti prašymą</button></form>
    <p id="rioPrivacyMessage" role="status" aria-live="polite"></p>
    <h3>Mano prašymai</h3><ul id="rioPrivacyHistory"></ul>
    <section id="rioPrivacyAdmin" hidden><h3>Administratoriaus peržiūra</h3><div id="rioPrivacyAdminHealth" role="status" aria-live="polite" style="padding:10px 0;font-weight:600"></div><p>Būsenos pakeitimas savaime neištrina ir neeksportuoja duomenų. Prieš užbaigiant būtina atskira teisėta peržiūra ir atsakymas.</p><div id="rioPrivacyAdminList"></div></section>
    <p>Neturėdami prieigos prie paskyros, kreipkitės privatumo politikoje nurodytu kontaktu.</p>`;
  document.body.appendChild(dialog);
  const $=id=>document.getElementById(id);
  Object.entries(names).forEach(([value,label])=>{const opt=document.createElement('option');opt.value=value;opt.textContent=label;$('rioPrivacyType').appendChild(opt)});
  const setMessage=msg=>{$('rioPrivacyMessage').textContent=msg};
  async function api(url,options={}){
    const response=await fetch(url,{credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},...options});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(response.status===401?'Prisijunkite prie paskyros.':data.error||data.code||'Veiksmas nepavyko.');
    return data;
  }
  function item(parent,value){const li=document.createElement('li');li.textContent=value;parent.appendChild(li)}
  async function refresh(){
    const {user}=await api('/api/auth/me');
    $('rioPrivacyIdentity').textContent=user?'Paskyra: '+user.email:'Norėdami pateikti prašymą, prisijunkite.';
    $('rioPrivacyForm').hidden=!user;$('rioPrivacyAdmin').hidden=user?.role!=='admin';
    $('rioPrivacyHistory').replaceChildren();$('rioPrivacyAdminList').replaceChildren();
    if(!user)return;
    const {requests}=await api('/api/privacy/requests');
    if(!requests.length)item($('rioPrivacyHistory'),'Prašymų nėra.');
    requests.forEach(r=>item($('rioPrivacyHistory'),(names[r.type]||r.type)+' – '+(statuses[r.status]||r.status)+' · '+String(r.createdAt||'').slice(0,19)+' · orientacinė atsakymo data: '+String(r.dueAt||'').slice(0,10)));
    if(user.role!=='admin')return;
    const health=await api('/api/admin/privacy/health');
    const warnings=[];
    if(!health.automaticDeliveryReady)warnings.push('Automatinis administratoriaus informavimas NĖRA patvirtintas: patikrinkite privatumo el. pašto adresą, siuntimo paslaugą ir laiškų darbuotoją.');
    if(health.overdue>0)warnings.push('DĖMESIO: pradelstų prašymų '+health.overdue+'.');
    $('rioPrivacyAdminHealth').textContent='Neperžiūrėti: '+health.unreviewed+' · Atviri: '+health.open+' · Pradelsti: '+health.overdue+
      (health.earliestDueAt?' · Artimiausia orientacinė data: '+String(health.earliestDueAt).slice(0,10):'')+
      (warnings.length?' | '+warnings.join(' '):' | El. pašto konfigūracijos požymiai nustatyti; tikro pristatymo tai neįrodo.');
    const loadPage=async(offset=0)=>{
      const {requests:all,hasMore,nextOffset}=await api('/api/admin/privacy/requests?offset='+offset);
      if(!all.length && offset===0)item($('rioPrivacyAdminList'),'Gautų prašymų nėra.');
      all.forEach(r=>{
      const box=document.createElement('div');box.style.cssText='border-top:1px solid #d9e5ed;padding:12px 0';
      const heading=document.createElement('p');
      heading.textContent=(r.accountEmail||r.userId)+' · '+(names[r.type]||r.type)+' · '+(statuses[r.status]||r.status)+' · iki '+String(r.dueAt||'').slice(0,10)+(r.overdue?' · TERMINAS PRAĖJĘS':'');
      box.appendChild(heading);
      if(r.details){const details=document.createElement('p');details.textContent=r.details;box.appendChild(details)}
      if(!['completed','rejected'].includes(r.status)){
        const select=document.createElement('select');
        ['in_review','awaiting_verification','completed','rejected'].forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=statuses[v];select.appendChild(o)});
        const note=document.createElement('textarea');note.rows=2;note.maxLength=2000;note.placeholder='Užbaigiant / atmetant: sprendimo pagrindas, patikros ir atsakymo registravimo nuoroda (be perteklinių asmens duomenų).';note.setAttribute('aria-label','Sprendimo pagrindas');note.style.cssText='display:block;width:100%;margin:8px 0';
        const save=document.createElement('button');save.type='button';save.textContent='Keisti būseną';
        save.addEventListener('click',async()=>{
          const terminal=['completed','rejected'].includes(select.value);
          if(terminal&&!window.confirm('Ar tikrai atlikta atskira teisėtumo, tapatybės ir atsakymo patikra? Vien būsena duomenų nepašalina.'))return;
          save.disabled=true;
          try{await api('/api/admin/privacy/requests/'+encodeURIComponent(r.requestId)+'/status',{method:'POST',body:JSON.stringify({status:select.value,reviewConfirmed:terminal,resolutionNote:note.value})});setMessage('Būsena atnaujinta.');await refresh()}
          catch(e){setMessage(e.message)}finally{save.disabled=false}
        });
        box.append(select,note,save);
      }
      $('rioPrivacyAdminList').appendChild(box);
      });
      if(hasMore){
        const more=document.createElement('button');more.type='button';more.textContent='Rodyti daugiau prašymų';
        more.addEventListener('click',async()=>{
          more.disabled=true;more.textContent='Įkeliama…';
          try{more.remove();await loadPage(nextOffset)}
          catch(e){more.disabled=false;more.textContent='Rodyti daugiau prašymų';setMessage(e.message);$('rioPrivacyAdminList').appendChild(more)}
        });
        $('rioPrivacyAdminList').appendChild(more);
      }
    };
    await loadPage();
  }
  btn.addEventListener('click',async()=>{dialog.showModal();setMessage('');try{await refresh()}catch(e){setMessage(e.message)}});
  $('rioPrivacyClose').addEventListener('click',()=>dialog.close());
  $('rioPrivacyForm').addEventListener('submit',async e=>{
    e.preventDefault();const submit=$('rioPrivacySubmit');submit.disabled=true;
    try{await api('/api/privacy/requests',{method:'POST',body:JSON.stringify({type:$('rioPrivacyType').value,details:$('rioPrivacyDetails').value})});$('rioPrivacyDetails').value='';setMessage('Prašymas užregistruotas.');await refresh()}
    catch(error){setMessage(error.message)}finally{submit.disabled=false}
  });
})();
