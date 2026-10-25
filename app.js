
const prices = { "Beach Pack for Two":49, "Travel Stroller":39, "Mobility Scooter":89, "Action Camera Kit":59, "Travel Cot":35, "Cooler Box":19 };
let cart = [];
// Declared before availability bootstrapping to avoid temporal-dead-zone failures.
let currentServerUser=null;

const bar = document.getElementById('cartbar');
const count = document.getElementById('cartCount');
const total = document.getElementById('cartTotal');

document.querySelectorAll('.addBtn').forEach(btn=>{
  btn.addEventListener('click', e=>{
    const card = e.target.closest('.product');
    const name = card.querySelector('h3').textContent;
    cart.push({name, price:prices[name]});
    renderCart();
    e.target.textContent='Added ✓';
    setTimeout(()=>e.target.textContent='Add',900);
  });
});

function renderCart(){
  const sum = cart.reduce((a,b)=>a+b.price,0);
  count.textContent = `${cart.length} item${cart.length===1?'':'s'}`;
  total.textContent = `€${sum}`;
  bar.classList.toggle('show', cart.length>0);
}

document.querySelectorAll('.chip').forEach(chip=>{
  chip.addEventListener('click',()=>{
    document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
    chip.classList.add('active');
    const f=chip.dataset.filter;
    if(typeof loadUniversalListings==='function'){
      const source=loadUniversalListings();
      const filtered=f==='all'?source:source.filter(item=>item.category===f);
      if(typeof renderGeoAwareListings==='function') renderGeoAwareListings(filtered);
      else if(typeof renderUniversalListings==='function') renderUniversalListings(filtered);
      document.getElementById('list-item')?.scrollIntoView({behavior:'smooth'});
    }
  });
});

document.getElementById('searchForm').addEventListener('submit',e=>{
  e.preventDefault();
  document.getElementById('browse').scrollIntoView({behavior:'smooth'});
});

document.getElementById('partnerLead')?.addEventListener('submit',e=>{
  e.preventDefault();
  const businessName=document.getElementById('partnerBusinessName')?.value?.trim()||'';
  const email=document.getElementById('partnerEmail')?.value?.trim()||'';
  const phone=document.getElementById('partnerPhone')?.value?.trim()||'';
  openAuth('register');
  const role=document.getElementById('regRole');
  if(role){ role.value='supplier'; role.dispatchEvent(new Event('change',{bubbles:true})); }
  const profile=document.getElementById('regBusinessName'); if(profile) profile.value=businessName;
  const contact=document.getElementById('regContactName'); if(contact && !contact.value) contact.value=businessName;
  const regEmail=document.getElementById('regEmail'); if(regEmail) regEmail.value=email;
  const regPhone=document.getElementById('regPhone'); if(regPhone) regPhone.value=phone;
  const msg=document.getElementById('partnerMsg');
  if(msg) msg.textContent='Continue in the account form and create your password.';
});



const translations = {
  en:{
    nav_browse:'Browse',nav_how:'How it works',nav_partners:'For partners',
    eyebrow:'Mallorca holiday rentals, in one place',
    hero_title:'Rent what you need. <span>Skip buying it.</span>',
    hero_copy:'Beach gear, baby equipment, mobility aids and holiday essentials — delivered to your hotel, villa or apartment.',
    location:'Where are you staying?',from:'From',to:'To',search:'Find available gear',
    trust_1:'Verified local partners',trust_2:'Hotel delivery',trust_3:'One checkout',
    browse_eyebrow:'Browse by category',browse_title:'Holiday essentials without the luggage',
    how_eyebrow:'Simple from booking to pickup',how_title:'How it works',
    step1_t:'Choose your stay',step1_c:"Tell us where and when you're staying in Mallorca.",
    step2_t:'Pick what you need',step2_c:'Compare verified local rental partners in one place.',
    step3_t:'One secure checkout',step3_c:'Book multiple items with one simple payment.',
    step4_t:'Delivery & pickup',step4_c:'Partners deliver to your hotel, villa or apartment and collect after.'
  },
  es:{
    nav_browse:'Explorar',nav_how:'Cómo funciona',nav_partners:'Para socios',
    eyebrow:'Alquiler vacacional en Mallorca, todo en un solo lugar',
    hero_title:'Alquila lo que necesitas. <span>No lo compres.</span>',
    hero_copy:'Equipamiento de playa, bebé, movilidad y otros esenciales — entregados en tu hotel, villa o apartamento.',
    location:'¿Dónde te alojas?',from:'Desde',to:'Hasta',search:'Buscar equipamiento disponible',
    trust_1:'Socios locales verificados',trust_2:'Entrega en hotel',trust_3:'Un solo pago',
    browse_eyebrow:'Explora por categoría',browse_title:'Todo lo que necesitas, sin cargarlo en la maleta',
    how_eyebrow:'Fácil desde la reserva hasta la recogida',how_title:'Cómo funciona',
    step1_t:'Elige tu estancia',step1_c:'Indícanos dónde y cuándo te alojas en Mallorca.',
    step2_t:'Elige lo que necesitas',step2_c:'Compara proveedores locales verificados en un solo lugar.',
    step3_t:'Un solo pago seguro',step3_c:'Reserva varios artículos con un único pago.',
    step4_t:'Entrega y recogida',step4_c:'Los socios entregan en tu hotel, villa o apartamento y recogen al final.'
  }
};

if(!window.RentAllI18n){
document.getElementById('lang').addEventListener('change',e=>{
  const lang=e.target.value;
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const key=el.dataset.i18n;
    if(translations[lang] && translations[lang][key]) el.innerHTML=translations[lang][key];
  });
});
}


const modal = document.getElementById('checkoutModal');
const bookingForm = document.getElementById('bookingForm');
const successPanel = document.getElementById('bookingSuccess');
let bookingStep = 1;

function money(n){ return `€${Number(n).toFixed(2)}`; }
function cartSubtotal(){ return cart.reduce((s,i)=>s+i.price,0); }

function fillCheckout(){
  const items = document.getElementById('checkoutItems');
  items.innerHTML = cart.map(i=>`<div class="checkout-item"><div><b>${i.name}</b><small>1 week rental</small></div><b>${money(i.price)}</b></div>`).join('');
  const rental = cartSubtotal();
  const delivery = cart.length ? 10 : 0;
  document.getElementById('rentalSubtotal').textContent = money(rental);
  document.getElementById('deliveryPreview').textContent = money(delivery);
  document.getElementById('step1Total').textContent = money(rental+delivery);
  document.getElementById('paymentRental').textContent = money(rental);
  document.getElementById('paymentDelivery').textContent = money(delivery);
  document.getElementById('paymentTotal').textContent = money(rental+delivery);
  document.getElementById('payBtn').textContent = `Pay ${money(rental+delivery)}`;
}

function showStep(n){
  bookingStep=n;
  document.querySelectorAll('.checkout-step').forEach(s=>s.classList.toggle('active', Number(s.dataset.step)===n));
  document.querySelectorAll('.progress-step').forEach(s=>s.classList.toggle('active', Number(s.dataset.step)<=n));
  document.dispatchEvent(new CustomEvent('rentall:checkout-step',{detail:{step:n}}));
  if(n===4) renderReview();
}

function validateStep(n){
  const step = document.querySelector(`.checkout-step[data-step="${n}"]`);
  const required = [...step.querySelectorAll('[required]')];
  for(const el of required){
    if(el.type==='checkbox' && !el.checked){ el.reportValidity(); return false; }
    if(!el.value){ el.reportValidity(); return false; }
  }
  if(n===1 && (!document.getElementById('rentalStart').value || !document.getElementById('rentalEnd').value)){
    return false;
  }
  return true;
}

function renderReview(){
  const rental = cartSubtotal(), delivery = 10, total = rental+delivery;
  const names = cart.map(i=>i.name).join(', ');
  const html = `
    <h3>${names}</h3>
    <div class="review-row"><span>Rental period</span><b>${document.getElementById('rentalStart').value || '—'} → ${document.getElementById('rentalEnd').value || '—'}</b></div>
    <div class="review-row"><span>Delivery</span><b>${document.getElementById('hotelName').value || '—'}, ${document.getElementById('deliveryArea').value || '—'}</b></div>
    <div class="review-row"><span>Delivery window</span><b>${document.getElementById('deliveryWindow').value || '—'}</b></div>
    <div class="review-row"><span>Customer</span><b>${document.getElementById('firstName').value || ''} ${document.getElementById('lastName').value || ''}</b></div>
    <div class="review-row"><span>Rental</span><b>${money(rental)}</b></div>
    <div class="review-row"><span>Delivery</span><b>${money(delivery)}</b></div>
    <div class="review-row total"><span>Total</span><b>${money(total)}</b></div>`;
  document.getElementById('reviewCard').innerHTML=html;
}

document.getElementById('checkoutBtn').addEventListener('click',()=>{
  if(!cart.length) return;
  fillCheckout();
  successPanel.classList.remove('show');
  bookingForm.style.display='block';
  showStep(1);
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');
});

document.getElementById('closeCheckout').addEventListener('click',()=>{
  modal.classList.remove('open'); modal.setAttribute('aria-hidden','true');
});
document.getElementById('closeSuccess').addEventListener('click',()=>{
  modal.classList.remove('open'); modal.setAttribute('aria-hidden','true');
});

document.querySelectorAll('.next-step').forEach(btn=>{
  btn.addEventListener('click',()=>{
    if(validateStep(bookingStep)) showStep(Number(btn.dataset.next));
  });
});
document.querySelectorAll('.prev-step').forEach(btn=>{
  btn.addEventListener('click',()=>showStep(Number(btn.dataset.prev)));
});
document.querySelectorAll('.pay-method').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.pay-method').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
  });
});

bookingForm.addEventListener('submit',e=>{
  e.preventDefault();
  if(!validateStep(5)) return;
  const code = 'RA-' + Math.floor(10000 + Math.random()*89999);
  document.getElementById('bookingCode').textContent=code;
  renderReview();
  document.getElementById('successSummary').innerHTML=document.getElementById('reviewCard').innerHTML;
  bookingForm.style.display='none';
  successPanel.classList.add('show');
  cart=[];
  renderCart();
});


const RENTALL_LEGACY_DEMO_RUNTIME=false;
if(RENTALL_LEGACY_DEMO_RUNTIME){
const demoBookings = [
  {id:1, guest:'Anna Smith', product:'Beach Pack for Two', dates:'22–29 Oct', delivery:'Magaluf', value:59, status:'pending'},
  {id:2, guest:'Jonas Meyer', product:'Travel Stroller', dates:'23–27 Oct', delivery:'Palma Nova', value:49, status:'confirmed'},
  {id:3, guest:'Sophie Martin', product:'Mobility Scooter', dates:'24–30 Oct', delivery:'Santa Ponça', value:99, status:'pending'},
  {id:4, guest:'Marek Nowak', product:'Action Camera Kit', dates:'25–28 Oct', delivery:'Palma', value:69, status:'confirmed'},
  {id:5, guest:'Lucía García', product:'Travel Cot', dates:'26–31 Oct', delivery:'Alcúdia', value:45, status:'pending'},
  {id:6, guest:'Emma Wilson', product:'Cooler Box', dates:'27–30 Oct', delivery:'Magaluf', value:29, status:'declined'}
];

const inventory = [
  {name:'Beach Pack for Two', icon:'🏖️', total:8, booked:5, next:'22 Oct', revenue:524},
  {name:'Travel Stroller', icon:'👶', total:10, booked:7, next:'23 Oct', revenue:249},
  {name:'Mobility Scooter', icon:'🛵', total:4, booked:3, next:'24 Oct', revenue:279},
  {name:'Action Camera Kit', icon:'📷', total:5, booked:2, next:'25 Oct', revenue:100},
  {name:'Travel Cot', icon:'🛏️', total:7, booked:4, next:'26 Oct', revenue:132},
  {name:'Cooler Box', icon:'🧊', total:12, booked:6, next:'27 Oct', revenue:88},
  {name:'High Chair', icon:'🪑', total:6, booked:2, next:'—', revenue:64},
  {name:'Beach Wagon', icon:'🛒', total:3, booked:1, next:'29 Oct', revenue:48}
];

function renderBookings(){
  const filter = document.getElementById('bookingFilter').value;
  const rows = demoBookings
    .filter(b=>filter==='all'||b.status===filter)
    .map(b=>{
      const actions = b.status==='pending'
        ? `<div class="action-row"><button class="mini-action accept" data-id="${b.id}" data-action="confirmed">Accept</button><button class="mini-action decline" data-id="${b.id}" data-action="declined">Decline</button></div>`
        : `<button class="mini-action" data-id="${b.id}" data-action="pending">Reset</button>`;
      return `<tr>
        <td><b>${b.guest}</b></td>
        <td>${b.product}</td>
        <td>${b.dates}</td>
        <td>${b.delivery}</td>
        <td><b>€${b.value}</b></td>
        <td><span class="status ${b.status}">${b.status}</span></td>
        <td>${actions}</td>
      </tr>`;
    }).join('');
  document.getElementById('bookingTableBody').innerHTML = rows || `<tr><td colspan="7">No bookings in this view.</td></tr>`;
  document.querySelectorAll('.mini-action').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const booking = demoBookings.find(b=>b.id===Number(btn.dataset.id));
      booking.status = btn.dataset.action;
      renderBookings();
      updateKPIs();
    });
  });
}

function renderInventory(){
  document.getElementById('inventoryGrid').innerHTML = inventory.map((i,idx)=>{
    const available = i.total-i.booked;
    const util = Math.round((i.booked/i.total)*100);
    return `<div class="inventory-card">
      <div class="inventory-card-top"><div><h4>${i.name}</h4><small>${available} available now</small></div><div class="icon">${i.icon}</div></div>
      <div class="inventory-meta">
        <div><span>Total units</span><b>${i.total}</b></div>
        <div><span>Booked</span><b>${i.booked}</b></div>
        <div><span>Next booking</span><b>${i.next}</b></div>
        <div><span>Revenue</span><b>€${i.revenue}</b></div>
      </div>
      <div class="inventory-meter"><i style="width:${util}%"></i></div>
      <div class="inventory-controls">
        <button class="mini-action" data-inv="${idx}" data-op="-1">- booked</button>
        <button class="mini-action" data-inv="${idx}" data-op="1">+ booked</button>
      </div>
    </div>`;
  }).join('');
  document.querySelectorAll('[data-inv]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const i=inventory[Number(btn.dataset.inv)], op=Number(btn.dataset.op);
      i.booked=Math.max(0,Math.min(i.total,i.booked+op));
      renderInventory(); updateKPIs();
    });
  });
}

function updateKPIs(){
  const pending = demoBookings.filter(b=>b.status==='pending').length;
  const confirmed = demoBookings.filter(b=>b.status==='confirmed').length + 15;
  const totalUnits = inventory.reduce((s,i)=>s+i.total,0);
  const totalBooked = inventory.reduce((s,i)=>s+i.booked,0);
  const util = Math.round((totalBooked/totalUnits)*100);
  document.getElementById('kpiPending').textContent=pending;
  document.getElementById('kpiBookings').textContent=confirmed;
  document.getElementById('kpiUtil').textContent=util+'%';
}

document.getElementById('bookingFilter').addEventListener('change',renderBookings);
document.getElementById('markAllAvailable').addEventListener('click',()=>{
  inventory.forEach(i=>i.booked=0);
  renderInventory(); updateKPIs();
});
document.getElementById('toggleDemoBooking').addEventListener('click',()=>{
  const id = Math.max(...demoBookings.map(b=>b.id))+1;
  demoBookings.unshift({id,guest:'New Guest',product:'Beach Pack for Two',dates:'30 Oct–3 Nov',delivery:'Palma Nova',value:59,status:'pending'});
  renderBookings(); updateKPIs();
});
document.getElementById('openDashboardLink').addEventListener('click',()=>{
  setTimeout(()=>document.getElementById('supplier-dashboard').scrollIntoView({behavior:'smooth'}),10);
});

renderBookings();
renderInventory();
updateKPIs();


}
// V105: end quarantined legacy demo runtime.
// Compatibility shim for legacy presentation helpers that are still parsed below.
// It intentionally contains no fabricated bookings; live supplier data replaces it.
const demoBookings=[];
// --- Supplier authentication MVP (front-end prototype only) ---
const SUPPLIER_KEY = 'holidaygear_supplier_accounts';
const SESSION_KEY = 'holidaygear_supplier_session';

const demoSupplier = {
  businessName:'Mallorca Rental Co.',
  contactName:'Demo Partner',
  email:'demo@rentall.test',
  phone:'+34 600 123 456',
  businessType:'Multi-category rental',
  area:'Magaluf',
  plan:'Free',
  address:'Magaluf, Mallorca',
  website:'https://example.com',
  password:'demo123'
};

function loadAccounts(){
  try{
    const existing=JSON.parse(localStorage.getItem(SUPPLIER_KEY)||'[]');
    return Array.isArray(existing)?existing:[];
  }catch{return [];}
}
function saveAccounts(accounts){ localStorage.setItem(SUPPLIER_KEY, JSON.stringify(accounts)); }
function getSession(){ return localStorage.getItem(SESSION_KEY); }
function setSession(email){ localStorage.setItem(SESSION_KEY,email); refreshAuthUI(); }
function clearSession(){ localStorage.removeItem(SESSION_KEY); refreshAuthUI(); }
function currentSupplier(){
  const email=getSession();
  if(!email) return null;
  return loadAccounts().find(a=>a.email===email) || null;
}

const authModal = document.getElementById('authModal');
const accountModal = document.getElementById('accountModal');

function openAuth(tab='login'){
  authModal.classList.add('open');
  authModal.setAttribute('aria-hidden','false');
  switchAuthTab(tab);
}
function closeAuth(){
  authModal.classList.remove('open');
  authModal.setAttribute('aria-hidden','true');
}
function switchAuthTab(tab){
  document.querySelectorAll('.auth-tab').forEach(b=>b.classList.toggle('active',b.dataset.authTab===tab));
  document.querySelectorAll('.auth-view').forEach(v=>v.classList.toggle('active',v.dataset.authView===tab));
}

document.querySelectorAll('.auth-tab').forEach(btn=>btn.addEventListener('click',()=>switchAuthTab(btn.dataset.authTab)));
document.getElementById('supplierAuthBtn').addEventListener('click',()=>openAuth('login'));
document.getElementById('lockedLoginBtn').addEventListener('click',()=>openAuth('login'));
document.getElementById('closeAuth').addEventListener('click',closeAuth);

document.getElementById('fillDemoLogin')?.addEventListener('click',()=>{
  document.getElementById('loginEmail').value=demoSupplier.email;
  document.getElementById('loginPassword').value=demoSupplier.password;
});

document.getElementById('supplierLoginForm').addEventListener('submit',e=>{
  e.preventDefault();
  const email=document.getElementById('loginEmail').value.trim().toLowerCase();
  const password=document.getElementById('loginPassword').value;
  const account=loadAccounts().find(a=>a.email.toLowerCase()===email && a.password===password);
  const msg=document.getElementById('loginMsg');
  if(!account){
    msg.textContent='Incorrect email or password.';
    return;
  }
  msg.textContent='';
  setSession(account.email);
  closeAuth();
  document.getElementById('supplier-dashboard').scrollIntoView({behavior:'smooth'});
});

document.getElementById('supplierRegisterForm').addEventListener('submit',e=>{
  e.preventDefault();
  const email=document.getElementById('regEmail').value.trim().toLowerCase();
  const accounts=loadAccounts();
  const msg=document.getElementById('registerMsg');
  if(accounts.some(a=>a.email.toLowerCase()===email)){
    msg.textContent='An account with this email already exists.';
    return;
  }
  const account={
    businessName:document.getElementById('regBusinessName').value.trim(),
    contactName:document.getElementById('regContactName').value.trim(),
    email,
    phone:document.getElementById('regPhone').value.trim(),
    businessType:document.getElementById('regBusinessType')?.value||'Multiple categories',
    country:document.getElementById('regCountry')?.value || 'ES',
    area:document.getElementById('regArea').value,
    plan:document.getElementById('regPlan')?.value||'Free',
    address:document.getElementById('regAddress')?.value||''.trim(),
    website:document.getElementById('regWebsite')?.value||''.trim(),
    password:document.getElementById('regPassword').value
  };
  accounts.push(account); saveAccounts(accounts); setSession(account.email);
  msg.textContent='';
  closeAuth();
  document.getElementById('supplier-dashboard').scrollIntoView({behavior:'smooth'});
});

function refreshAuthUI(){
  const supplier=currentSupplier();
  const dashboard=document.getElementById('supplier-dashboard');
  const locked=document.getElementById('supplierLocked');
  const authBtn=document.getElementById('supplierAuthBtn');
  if(supplier){
    dashboard.classList.add('unlocked');
    locked.classList.add('hidden');
    authBtn.textContent='Dashboard';
    authBtn.onclick=()=>document.getElementById('supplier-dashboard').scrollIntoView({behavior:'smooth'});
    document.getElementById('supplierBusinessDisplay').textContent=supplier.businessName;
    document.getElementById('supplierPlanDisplay').textContent=`${supplier.plan} plan`;
  } else {
    dashboard.classList.remove('unlocked');
    locked.classList.remove('hidden');
    authBtn.textContent='Supplier login';
    authBtn.onclick=()=>openAuth('login');
  }
}

document.getElementById('supplierLogoutBtn').addEventListener('click',()=>{
  clearSession();
  document.getElementById('supplierLocked').scrollIntoView({behavior:'smooth'});
});

document.getElementById('supplierAccountBtn').addEventListener('click',()=>{
  const s=currentSupplier(); if(!s) return;
  document.getElementById('accBusinessName').value=s.businessName||'';
  document.getElementById('accContactName').value=s.contactName||'';
  document.getElementById('accEmail').value=s.email||'';
  document.getElementById('accPhone').value=s.phone||'';
  document.getElementById('accBusinessType').value=s.businessType||'';
  document.getElementById('accArea').value=s.area||'';
  document.getElementById('accPlan').value=s.plan||'Free';
  document.getElementById('accWebsite').value=s.website||'';
  document.getElementById('accAddress').value=s.address||'';
  accountModal.classList.add('open');
  accountModal.setAttribute('aria-hidden','false');
});
document.getElementById('closeAccount').addEventListener('click',()=>{
  accountModal.classList.remove('open');
  accountModal.setAttribute('aria-hidden','true');
});

document.getElementById('supplierAccountForm').addEventListener('submit',e=>{
  e.preventDefault();
  const email=getSession(); const accounts=loadAccounts();
  const idx=accounts.findIndex(a=>a.email===email); if(idx<0) return;
  accounts[idx]={...accounts[idx],
    businessName:document.getElementById('accBusinessName').value.trim(),
    contactName:document.getElementById('accContactName').value.trim(),
    phone:document.getElementById('accPhone').value.trim(),
    businessType:document.getElementById('accBusinessType').value.trim(),
    area:document.getElementById('accArea').value.trim(),
    plan:document.getElementById('accPlan').value,
    website:document.getElementById('accWebsite').value.trim(),
    address:document.getElementById('accAddress').value.trim()
  };
  saveAccounts(accounts);
  document.getElementById('accountMsg').textContent='Saved.';
  refreshAuthUI();
});

loadAccounts();
refreshAuthUI();

// --- Supplier profile v5: business, delivery zones and payout details ---
function v5SelectedZones(){
  return [...document.querySelectorAll('#deliveryZones input[type="checkbox"]:checked')].map(cb=>cb.value);
}
function v5FillProfile(s){
  document.getElementById('accBusinessName').value=s.businessName||'';
  document.getElementById('accContactName').value=s.contactName||'';
  document.getElementById('accEmail').value=s.email||'';
  document.getElementById('accPhone').value=s.phone||'';
  document.getElementById('accBusinessType').value=s.businessType||'';
  document.getElementById('accPlan').value=s.plan||'Free';
  document.getElementById('accWebsite').value=s.website||'';
  document.getElementById('accAddress').value=s.address||'';

  document.querySelectorAll('#deliveryZones input[type="checkbox"]').forEach(cb=>{
    cb.checked=(s.deliveryZones||[]).includes(cb.value);
  });
  document.getElementById('accDeliveryFee').value=s.deliveryFee ?? '';
  document.getElementById('accFreeDeliveryAbove').value=s.freeDeliveryAbove ?? '';
  document.getElementById('accPayoutName').value=s.payoutName ?? '';
  document.getElementById('accPayoutCountry').value=s.payoutCountry ?? 'Spain';
  document.getElementById('accIban').value=s.iban ?? '';
  document.getElementById('accTaxId').value=s.taxId ?? '';
  document.getElementById('accPayoutSchedule').value=s.payoutSchedule ?? 'Weekly';
}

document.getElementById('supplierAccountBtn').addEventListener('click',(e)=>{
  e.stopImmediatePropagation();
  const s=currentSupplier(); if(!s) return;
  v5FillProfile(s);
  accountModal.classList.add('open');
  accountModal.setAttribute('aria-hidden','false');
}, true);

document.getElementById('supplierAccountForm').addEventListener('submit',(e)=>{
  e.preventDefault();
  e.stopImmediatePropagation();
  const email=getSession();
  const accounts=loadAccounts();
  const idx=accounts.findIndex(a=>a.email===email);
  if(idx<0) return;

  accounts[idx]={...accounts[idx],
    businessName:document.getElementById('accBusinessName').value.trim(),
    contactName:document.getElementById('accContactName').value.trim(),
    phone:document.getElementById('accPhone').value.trim(),
    businessType:document.getElementById('accBusinessType').value.trim(),
    address:document.getElementById('accAddress').value.trim(),
    website:document.getElementById('accWebsite').value.trim(),
    plan:document.getElementById('accPlan').value,
    deliveryZones:v5SelectedZones(),
    deliveryFee:Number(document.getElementById('accDeliveryFee').value||0),
    freeDeliveryAbove:Number(document.getElementById('accFreeDeliveryAbove').value||0),
    payoutName:document.getElementById('accPayoutName').value.trim(),
    payoutCountry:document.getElementById('accPayoutCountry').value,
    iban:document.getElementById('accIban').value.trim(),
    taxId:document.getElementById('accTaxId').value.trim(),
    payoutSchedule:document.getElementById('accPayoutSchedule').value
  };
  saveAccounts(accounts);
  document.getElementById('accountMsg').textContent='Supplier profile saved.';
  refreshAuthUI();
}, true);


// --- Supplier payments settings MVP ---
const paymentHistory = [
  {date:'20 Oct 2026', type:'booking', ref:'RA-20481 · Beach Pack', gross:59, fee:-10.62, net:48.38, status:'Paid'},
  {date:'19 Oct 2026', type:'booking', ref:'RA-20472 · Travel Stroller', gross:49, fee:-8.82, net:40.18, status:'Paid'},
  {date:'18 Oct 2026', type:'payout', ref:'Payout · Week 42', gross:0, fee:0, net:584.20, status:'Sent'},
  {date:'18 Oct 2026', type:'fee', ref:'Platform fees · Week 42', gross:0, fee:-102.60, net:-102.60, status:'Settled'},
  {date:'17 Oct 2026', type:'booking', ref:'RA-20431 · Mobility Scooter', gross:99, fee:-17.82, net:81.18, status:'Paid'},
  {date:'16 Oct 2026', type:'booking', ref:'RA-20405 · Action Camera Kit', gross:69, fee:-12.42, net:56.58, status:'Paid'}
];

function maskIban(iban){
  if(!iban) return 'Not set';
  const clean=iban.replace(/\s+/g,'');
  if(clean.length<8) return iban;
  return clean.slice(0,4)+' •••• •••• '+clean.slice(-4);
}
function renderPaymentHistory(){
  const filter=document.getElementById('paymentHistoryFilter').value;
  const rows=paymentHistory.filter(r=>filter==='all'||r.type===filter).map(r=>`
    <tr>
      <td>${r.date}</td>
      <td>${r.type.charAt(0).toUpperCase()+r.type.slice(1)}</td>
      <td><b>${r.ref}</b></td>
      <td>${r.gross ? money(r.gross) : '—'}</td>
      <td class="${r.fee<0?'amount-negative':''}">${r.fee ? money(r.fee) : '—'}</td>
      <td class="${r.net>=0?'amount-positive':'amount-negative'}">${money(r.net)}</td>
      <td><span class="status ${r.status==='Sent'||r.status==='Paid'?'confirmed':'pending'}">${r.status}</span></td>
    </tr>`).join('');
  document.getElementById('paymentHistoryBody').innerHTML=rows;
}
function refreshPaymentsPanel(){
  const s=currentSupplier(); if(!s) return;
  document.getElementById('bankHolderDisplay').textContent=s.payoutName||s.businessName||'Not set';
  document.getElementById('bankIbanDisplay').textContent=maskIban(s.iban);
  document.getElementById('bankCountryDisplay').textContent=s.payoutCountry||'Spain';
  document.getElementById('paymentsScheduleSelect').value=s.payoutSchedule||'Weekly';
  document.getElementById('payoutScheduleBadge').textContent=s.payoutSchedule||'Weekly';

  const connected=!!s.stripeConnected;
  const stripeBadge=document.getElementById('stripeStatusBadge');
  const bankBadge=document.getElementById('bankStatusBadge');
  stripeBadge.textContent=connected?'Connected':'Not connected';
  stripeBadge.className='status '+(connected?'confirmed':'pending');
  bankBadge.textContent=connected&&s.iban?'Verified':(s.iban?'Added':'Pending');
  bankBadge.className='status '+(connected&&s.iban?'confirmed':'pending');

  document.getElementById('stripeIdentityText').textContent=connected?'Verified':'Not started';
  document.getElementById('stripeBankText').textContent=connected&&s.iban?'Verified':(s.iban?'Added':'Not connected');
  document.getElementById('stripePayoutText').textContent=connected?'Enabled':'Pending';
  document.getElementById('stripeStepIdentity').classList.toggle('done',connected);
  document.getElementById('stripeStepBank').classList.toggle('done',connected&&!!s.iban);
  document.getElementById('stripeStepPayout').classList.toggle('done',connected);
  document.getElementById('connectStripeBtn').textContent=connected?'Stripe Connect ready ✓':'Start Stripe Connect setup';

  renderPaymentHistory();
}

document.getElementById('supplierPaymentsBtn').addEventListener('click',()=>{
  refreshPaymentsPanel();
  document.getElementById('supplierPaymentsPanel').classList.add('open');
  document.getElementById('supplierPaymentsPanel').scrollIntoView({behavior:'smooth',block:'start'});
});
document.getElementById('closePaymentsPanel').addEventListener('click',()=>{
  document.getElementById('supplierPaymentsPanel').classList.remove('open');
});
document.getElementById('paymentHistoryFilter').addEventListener('change',renderPaymentHistory);

document.getElementById('connectStripeBtn').addEventListener('click',()=>{
  const email=getSession();
  const accounts=loadAccounts();
  const idx=accounts.findIndex(a=>a.email===email);
  if(idx<0) return;
  accounts[idx].stripeConnected=true;
  if(!accounts[idx].payoutName) accounts[idx].payoutName=accounts[idx].businessName;
  if(!accounts[idx].iban) accounts[idx].iban='ES12 3456 7890 1234 5678 9012';
  if(!accounts[idx].payoutCountry) accounts[idx].payoutCountry='Spain';
  saveAccounts(accounts);
  refreshPaymentsPanel();
});

document.getElementById('paymentsScheduleSelect').addEventListener('change',(e)=>{
  const email=getSession();
  const accounts=loadAccounts();
  const idx=accounts.findIndex(a=>a.email===email);
  if(idx<0) return;
  accounts[idx].payoutSchedule=e.target.value;
  saveAccounts(accounts);
  refreshPaymentsPanel();
});

document.getElementById('editBankFromPayments').addEventListener('click',()=>{
  document.getElementById('supplierPaymentsPanel').classList.remove('open');
  document.getElementById('supplierAccountBtn').click();
});

if(document.getElementById('paymentHistoryBody')) renderPaymentHistory();


// --- V7: real Stripe Connect test-mode onboarding controller ---
function supplierStableId(){
  const s=currentSupplier();
  if(!s) return null;
  // Demo stable identifier. Use your DB primary key in production.
  return btoa(s.email).replace(/[^a-zA-Z0-9]/g,'').slice(0,32);
}


let activeBookingAttemptKey='';
function currentBookingIdempotencyKey(){
  if(activeBookingAttemptKey) return activeBookingAttemptKey;
  if(globalThis.crypto?.randomUUID) activeBookingAttemptKey=`booking-${crypto.randomUUID()}`;
  else activeBookingAttemptKey=`booking-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  return activeBookingAttemptKey;
}
function resetBookingAttemptKey(){ activeBookingAttemptKey=''; }
function bookingRequestOptions(payload,existing={}){
  const headers={...(existing.headers||{}),'Idempotency-Key':currentBookingIdempotencyKey()};
  return {...existing,method:'POST',headers,body:JSON.stringify(payload)};
}

const bookingSubmitLocks=new WeakSet();
function lockBookingSubmit(form){
  if(!form || bookingSubmitLocks.has(form)) return false;
  bookingSubmitLocks.add(form);
  form.setAttribute('aria-busy','true');
  form.querySelectorAll('button[type="submit"],button[data-booking-submit]').forEach(btn=>{btn.disabled=true;});
  return true;
}
function unlockBookingSubmit(form,{completed=false}={}){
  if(!form) return;
  bookingSubmitLocks.delete(form);
  form.removeAttribute('aria-busy');
  form.querySelectorAll('button[type="submit"],button[data-booking-submit]').forEach(btn=>{btn.disabled=false;});
  if(completed) resetBookingAttemptKey();
}

function bindBookingAttemptIdentity(){
  const ids=['rentalStart','rentalEnd','quantitySearch','deliveryArea','hotelName','deliveryAddress','roomNumber','hotelBookingName'];
  ids.forEach(id=>{
    document.getElementById(id)?.addEventListener('change',()=>{
      const form=document.getElementById('bookingForm') || document.querySelector('[data-booking-form]');
      if(!form || !bookingSubmitLocks.has(form)) resetBookingAttemptKey();
    });
  });
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bindBookingAttemptIdentity,{once:true});
else bindBookingAttemptIdentity();


async function apiJson(url, options={}){
  const res=await fetch(url,{
    headers:{'Content-Type':'application/json',...(options.headers||{})},
    ...options
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok){
    const err=new Error(data.error||`Request failed: ${res.status}`);
    err.status=res.status;
    err.retryable=!!data.retryable;
    err.retryAfterSeconds=Math.max(0,Number(res.headers.get('Retry-After')||0));
    throw err;
  }
  return data;
}

function wait(ms){ return new Promise(resolve=>setTimeout(resolve,ms)); }


function ensureBookingConfirmation(){
  if(document.getElementById('bookingConfirmation')) return;
  const checkout=document.getElementById('checkoutPanel')||document.querySelector('.checkout-panel');
  if(!checkout) return;
  const card=document.createElement('section');
  card.id='bookingConfirmation';
  card.className='booking-confirmation';
  card.hidden=true;
  card.setAttribute('role','status');
  card.setAttribute('aria-live','polite');
  checkout.prepend(card);
}
function renderBookingConfirmation(result){
  ensureBookingConfirmation();
  const card=document.getElementById('bookingConfirmation');
  const booking=result?.booking;
  if(!card||!booking) return;
  const id=escapeHtml(String(booking.bookingId||booking.id||''));
  const start=escapeHtml(String(booking.startDate||''));
  const end=escapeHtml(String(booking.endDate||''));
  const qty=Math.max(1,Number(booking.quantity||1));
  const total=Number(result?.price?.total ?? booking.orderValue ?? 0);
  card.innerHTML=`<div class="booking-confirmation-icon" aria-hidden="true">✓</div>
    <div>
      <h3>Booking request received</h3>
      <p class="booking-confirmation-ref">Reference <strong>${id}</strong></p>
      <div class="booking-confirmation-grid">
        <span>Dates<strong>${start} → ${end}</strong></span>
        <span>Quantity<strong>${qty}</strong></span>
        <span>Verified total<strong>${money(total)}</strong></span>
      </div>
      <p>Your supplier has been notified. You can follow the booking status in <strong>My bookings</strong>.</p>
      <div class="booking-confirmation-actions">
        <button type="button" class="btn primary" id="confirmationMyBookings">View my bookings</button>
        ${result.paymentToken?'<button type="button" class="btn secondary" id="confirmationCopyLink">Copy secure booking link</button>':''}
      </div>
      <p id="confirmationActionStatus" class="booking-confirmation-action-status" role="status" aria-live="polite"></p>
    </div>`;
  card.hidden=false;
  card.querySelector('#confirmationMyBookings')?.addEventListener('click',()=>{
    document.getElementById('myBookingsBtn')?.click();
  });
  card.querySelector('#confirmationCopyLink')?.addEventListener('click',async()=>{
    const status=card.querySelector('#confirmationActionStatus');
    const token=String(result.paymentToken||'');
    if(!token) return;
    const url=`${location.origin}${location.pathname}?booking=${encodeURIComponent(id)}&access=${encodeURIComponent(token)}`;
    try{
      await navigator.clipboard.writeText(url);
      if(status) status.textContent='Secure booking link copied.';
    }catch{
      if(status) status.textContent='Copy failed. Open My bookings to access this booking.';
    }
  });
  card.hidden=false;
  card.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
}

async function createBookingWithSafeRetry(payload){
  const options=bookingRequestOptions(payload);
  try{
    return await apiJson('/api/rentals/bookings',options);
  }catch(err){
    // A concurrent request with the same action identity is still running.
    // Retry once with the exact same Idempotency-Key; the server will either
    // replay the completed result or explicitly fail without creating a duplicate.
    if(err.status===409 && err.retryable){
      const delay=Math.min(5000,Math.max(500,err.retryAfterSeconds*1000||2000));
      await wait(delay);
      return apiJson('/api/rentals/bookings',options);
    }
    throw err;
  }
}

function applyStripeLiveStatus(st){
  if(!st) return;
  const badge=document.getElementById('stripeStatusBadge');
  const bankBadge=document.getElementById('bankStatusBadge');
  const openBtn=document.getElementById('openStripeDashboardBtn');
  const message=document.getElementById('stripeLiveMessage');

  const state=st.state||'not_created';
  const connected=state==='active';
  const submitted=!!st.detailsSubmitted;

  badge.textContent = connected ? 'Connected' :
    state==='needs_information' ? 'Needs information' :
    state==='restricted' ? 'Restricted' :
    submitted ? 'Submitted' :
    state==='not_created' ? 'Not connected' : 'In progress';

  badge.className='status '+(connected?'confirmed':'pending');
  bankBadge.textContent = st.payoutsEnabled ? 'Verified' : 'Pending';
  bankBadge.className='status '+(st.payoutsEnabled?'confirmed':'pending');

  document.getElementById('stripeIdentityText').textContent =
    submitted ? 'Submitted' : 'Not complete';
  document.getElementById('stripeBankText').textContent =
    st.payoutsEnabled ? 'Verified for payouts' : 'Pending verification';
  document.getElementById('stripePayoutText').textContent =
    st.payoutsEnabled ? 'Enabled' : 'Not enabled';

  document.getElementById('stripeStepIdentity').classList.toggle('done', submitted);
  document.getElementById('stripeStepBank').classList.toggle('done', !!st.payoutsEnabled);
  document.getElementById('stripeStepPayout').classList.toggle('done', !!st.payoutsEnabled);

  openBtn.disabled=!submitted;
  message.textContent = st.currentlyDue?.length
    ? `Stripe still requires: ${st.currentlyDue.join(', ')}`
    : connected ? 'Stripe onboarding complete. Payouts are enabled.'
    : 'Stripe account created. Continue onboarding to complete verification.';
}

async function ensureStripeAccount(){
  const s=currentSupplier();
  const supplierId=supplierStableId();
  if(!s||!supplierId) throw new Error('Supplier login required');
  return apiJson('/api/stripe/connect/create-account',{
    method:'POST',
    body:JSON.stringify({
      supplierId,
      email:s.email,
      country:'ES',
      businessName:s.businessName
    })
  });
}

async function refreshLiveStripeStatus(){
  const supplierId=supplierStableId();
  if(!supplierId) return;
  try{
    const st=await apiJson(`/api/stripe/connect/status/${supplierId}`);
    applyStripeLiveStatus(st);
  }catch(err){
    document.getElementById('stripeLiveMessage').textContent=
      `Live Stripe unavailable: ${err.message}`;
  }
}

// Override old simulated connect button.
document.getElementById('connectStripeBtn').addEventListener('click',async(e)=>{
  e.preventDefault();
  e.stopImmediatePropagation();
  const msg=document.getElementById('stripeLiveMessage');
  msg.textContent='Creating Stripe connected account…';
  try{
    const status=await ensureStripeAccount();
    applyStripeLiveStatus(status);

    const supplierId=supplierStableId();
    const link=await apiJson('/api/stripe/connect/onboarding-link',{
      method:'POST',
      body:JSON.stringify({supplierId})
    });
    msg.textContent='Opening Stripe-hosted onboarding…';
    window.location.href=link.url;
  }catch(err){
    msg.textContent=`Could not start Stripe onboarding: ${err.message}`;
  }
}, true);

document.getElementById('refreshStripeStatusBtn').addEventListener('click',refreshLiveStripeStatus);

document.getElementById('openStripeDashboardBtn').addEventListener('click',async()=>{
  const msg=document.getElementById('stripeLiveMessage');
  try{
    const supplierId=supplierStableId();
    const link=await apiJson('/api/stripe/connect/login-link',{
      method:'POST',
      body:JSON.stringify({supplierId})
    });
    window.location.href=link.url;
  }catch(err){
    msg.textContent=`Could not open Stripe Dashboard: ${err.message}`;
  }
});

document.getElementById('simulateWebhookBtn').addEventListener('click',async()=>{
  const result=document.getElementById('webhookSimResult');
  try{
    const type=document.getElementById('webhookEventType').value;
    const event=await apiJson('/api/stripe/connect/simulate-event',{
      method:'POST',
      body:JSON.stringify({type,supplierId:supplierStableId()||'demo'})
    });
    result.textContent=`Simulated ${event.type} · ${event.id}`;
    if(type==='account.updated'){
      // UI-only reaction to illustrate the event-driven state transition.
      applyStripeLiveStatus({
        state:'active',
        detailsSubmitted:true,
        payoutsEnabled:true,
        chargesEnabled:true,
        currentlyDue:[]
      });
    }
    if(type==='payout.failed'){
      document.getElementById('bankStatusBadge').textContent='Attention required';
      document.getElementById('bankStatusBadge').className='status pending';
    }
  }catch(err){
    result.textContent=`Simulation failed: ${err.message}`;
  }
});

// Handle Stripe return / refresh query flags.
(async function handleStripeReturn(){
  const qs=new URLSearchParams(window.location.search);
  if(qs.get('stripe')==='return'){
    setTimeout(refreshLiveStripeStatus,300);
  }
  if(qs.get('stripe')==='refresh'){
    const msg=document.getElementById('stripeLiveMessage');
    if(msg) msg.textContent='Stripe onboarding link expired or was already used. Generate a new one.';
  }
})();


// --- V8: Stripe webhook event log ---
function webhookStatusClass(status){
  if(status==='processed') return 'webhook-ok';
  if(status==='failed') return 'webhook-failed';
  return 'webhook-processing';
}
function formatWebhookTime(iso){
  try{
    return new Date(iso).toLocaleString();
  }catch{
    return iso||'—';
  }
}
async function refreshWebhookLog(){
  const body=document.getElementById('webhookLogBody');
  if(!body) return;
  body.innerHTML='<tr><td colspan="5">Loading webhook events…</td></tr>';
  try{
    const data=await apiJson('/api/stripe/webhook-events?limit=50');
    const events=data.events||[];
    if(!events.length){
      body.innerHTML='<tr><td colspan="5">No webhook events received yet.</td></tr>';
      return;
    }
    body.innerHTML=events.map(e=>`
      <tr>
        <td>${formatWebhookTime(e.receivedAt)}</td>
        <td><b>${e.type||'unknown'}</b></td>
        <td>${e.source||'stripe'}</td>
        <td class="${webhookStatusClass(e.status)}">${e.status||'received'}</td>
        <td class="webhook-error">${e.error||'—'}</td>
      </tr>`).join('');
  }catch(err){
    body.innerHTML=`<tr><td colspan="5" class="webhook-error">Could not load webhook log: ${escapeHtml(err.message||"Unknown error")}</td></tr>`;
  }
}

document.getElementById('refreshWebhookLogBtn')?.addEventListener('click',refreshWebhookLog);

// Refresh the webhook log whenever Payments is opened.
document.getElementById('supplierPaymentsBtn')?.addEventListener('click',()=>{
  setTimeout(refreshWebhookLog,150);
});

// After simulating an event, refresh log automatically.
document.getElementById('simulateWebhookBtn')?.addEventListener('click',()=>{
  setTimeout(refreshWebhookLog,250);
});


// --- V9: webhook log filters ---
let webhookEventCache = [];

function populateWebhookTypeFilter(events){
  const select=document.getElementById('webhookTypeFilter');
  if(!select) return;
  const current=select.value||'all';
  const types=[...new Set(events.map(e=>e.type).filter(Boolean))].sort();
  select.innerHTML='<option value="all">All event types</option>'+
    types.map(t=>`<option value="${t}">${t}</option>`).join('');
  if(types.includes(current)) select.value=current;
}

function webhookPassesDateFilter(iso, fromStr, toStr){
  if(!iso) return true;
  const d=new Date(iso);
  if(Number.isNaN(d.getTime())) return true;

  if(fromStr){
    const from=new Date(fromStr+'T00:00:00');
    if(d < from) return false;
  }
  if(toStr){
    const to=new Date(toStr+'T23:59:59.999');
    if(d > to) return false;
  }
  return true;
}

function getFilteredWebhookEvents(){
  const type=document.getElementById('webhookTypeFilter')?.value||'all';
  const status=document.getElementById('webhookStatusFilter')?.value||'all';
  const from=document.getElementById('webhookFromDate')?.value||'';
  const to=document.getElementById('webhookToDate')?.value||'';

  return webhookEventCache.filter(e=>{
    if(type!=='all' && e.type!==type) return false;
    if(status!=='all' && e.status!==status) return false;
    if(!webhookPassesDateFilter(e.receivedAt, from, to)) return false;
    return true;
  });
}

function renderWebhookLogFiltered(){
  const body=document.getElementById('webhookLogBody');
  if(!body) return;

  const events=getFilteredWebhookEvents();
  const summary=document.getElementById('webhookFilterSummary');
  if(summary){
    summary.textContent=`Showing ${events.length} of ${webhookEventCache.length} webhook events`;
  }

  if(!events.length){
    body.innerHTML='<tr><td colspan="5">No webhook events match the selected filters.</td></tr>';
    return;
  }

  body.innerHTML=events.map(e=>`
    <tr>
      <td>${formatWebhookTime(e.receivedAt)}</td>
      <td><b>${e.type||'unknown'}</b></td>
      <td>${e.source||'stripe'}</td>
      <td class="${webhookStatusClass(e.status)}">${e.status||'received'}</td>
      <td class="webhook-error">${e.error||'—'}</td>
    </tr>`).join('');
}

// Override refresh function from V8 with cached/filterable version.
refreshWebhookLog = async function(){
  const body=document.getElementById('webhookLogBody');
  if(!body) return;
  body.innerHTML='<tr><td colspan="5">Loading webhook events…</td></tr>';

  try{
    const data=await apiJson('/api/stripe/webhook-events?limit=200');
    webhookEventCache=data.events||[];
    populateWebhookTypeFilter(webhookEventCache);
    renderWebhookLogFiltered();
  }catch(err){
    body.innerHTML=`<tr><td colspan="5" class="webhook-error">Could not load webhook log: ${escapeHtml(err.message||"Unknown error")}</td></tr>`;
  }
};

['webhookTypeFilter','webhookStatusFilter','webhookFromDate','webhookToDate'].forEach(id=>{
  document.getElementById(id)?.addEventListener('change',renderWebhookLogFiltered);
});

document.getElementById('clearWebhookFiltersBtn')?.addEventListener('click',()=>{
  document.getElementById('webhookTypeFilter').value='all';
  document.getElementById('webhookStatusFilter').value='all';
  document.getElementById('webhookFromDate').value='';
  document.getElementById('webhookToDate').value='';
  renderWebhookLogFiltered();
});


// --- V10: persistent DB webhook log rendering with duplicate-attempt visibility ---
renderWebhookLogFiltered = function(){
  const body=document.getElementById('webhookLogBody');
  if(!body) return;

  const events=getFilteredWebhookEvents();
  const summary=document.getElementById('webhookFilterSummary');
  if(summary){
    summary.textContent=`Showing ${events.length} of ${webhookEventCache.length} webhook events`;
  }

  if(!events.length){
    body.innerHTML='<tr><td colspan="6">No webhook events match the selected filters.</td></tr>';
    return;
  }

  body.innerHTML=events.map(e=>`
    <tr>
      <td>${formatWebhookTime(e.receivedAt)}</td>
      <td><b>${e.type||'unknown'}</b><small style="display:block;color:var(--muted);margin-top:3px">${e.eventId||''}</small></td>
      <td>${e.source||'stripe'}</td>
      <td class="${webhookStatusClass(e.status)}">${e.status||'received'}</td>
      <td>${e.attemptCount||1}</td>
      <td class="webhook-error">${e.error||'—'}</td>
    </tr>`).join('');
};

// Server-side filtering is now available; keep client-side filtering for responsiveness,
// but request the latest persistent database rows on refresh.
refreshWebhookLog = async function(){
  const body=document.getElementById('webhookLogBody');
  if(!body) return;
  body.innerHTML='<tr><td colspan="6">Loading webhook events…</td></tr>';

  try{
    const data=await apiJson('/api/stripe/webhook-events?limit=200');
    webhookEventCache=data.events||[];
    populateWebhookTypeFilter(webhookEventCache);
    renderWebhookLogFiltered();
  }catch(err){
    body.innerHTML=`<tr><td colspan="6" class="webhook-error">Could not load webhook log: ${escapeHtml(err.message||"Unknown error")}</td></tr>`;
  }
};


// --- V11: global destination selector + multilingual shell ---
const destinationMap = {
  ES: ['Palma de Mallorca','Magaluf','Palma Nova','Santa Ponça','Alcúdia','Barcelona','Málaga','Marbella','Ibiza Town'],
  PT: ['Lisbon','Porto','Albufeira','Faro','Lagos','Funchal'],
  GR: ['Athens','Thessaloniki','Rhodes','Heraklion','Chania','Corfu'],
  CY: ['Paphos','Limassol','Larnaca','Ayia Napa','Protaras'],
  IT: ['Rome','Milan','Naples','Palermo','Cagliari','Olbia'],
  FR: ['Paris','Nice','Cannes','Marseille','Bordeaux']
};

function populateCities(){
  const country=document.getElementById('countrySelect')?.value || 'ES';
  const city=document.getElementById('citySelect');
  if(!city) return;
  city.innerHTML=(destinationMap[country]||[]).map(c=>`<option>${c}</option>`).join('');
}
document.getElementById('countrySelect')?.addEventListener('change',populateCities);
populateCities();

Object.assign(translations, {
  de:{
    nav_browse:'Entdecken',nav_how:'So funktioniert’s',nav_partners:'Für Partner',
    eyebrow:'Urlaubsverleih an einem Ort',
    hero_title:'Miete, was du brauchst. <span>Kaufe es nicht.</span>',
    hero_copy:'Strand-, Baby-, Mobilitäts- und Urlaubsausrüstung — geliefert zu Hotel, Villa oder Apartment.',
    country:'Land',city:'Stadt / Urlaubsort',from:'Von',to:'Bis',search:'Verfügbare Ausrüstung finden',
    trust_1:'Geprüfte lokale Partner',trust_2:'Lieferung zur Unterkunft',trust_3:'Ein Checkout',
    browse_eyebrow:'Nach Kategorie',browse_title:'Urlaubsausrüstung ohne zusätzliches Gepäck',
    how_eyebrow:'Einfach von Buchung bis Abholung',how_title:'So funktioniert’s',
    step1_t:'Reiseziel wählen',step1_c:'Wähle Land, Stadt und Reisedaten.',
    step2_t:'Ausrüstung auswählen',step2_c:'Vergleiche geprüfte lokale Vermieter an einem Ort.',
    step3_t:'Ein sicherer Checkout',step3_c:'Buche mehrere Artikel mit einer Zahlung.',
    step4_t:'Lieferung & Abholung',step4_c:'Partner liefern zur Unterkunft und holen später wieder ab.'
  },
  fr:{
    nav_browse:'Explorer',nav_how:'Comment ça marche',nav_partners:'Pour les partenaires',
    eyebrow:'Location de vacances, au même endroit',
    hero_title:'Louez ce dont vous avez besoin. <span>N’achetez pas.</span>',
    hero_copy:'Équipement de plage, bébé, mobilité et vacances — livré à votre hôtel, villa ou appartement.',
    country:'Pays',city:'Ville / station',from:'Du',to:'Au',search:'Voir le matériel disponible',
    trust_1:'Partenaires locaux vérifiés',trust_2:'Livraison à l’hébergement',trust_3:'Un seul paiement',
    browse_eyebrow:'Par catégorie',browse_title:'Tout le nécessaire sans alourdir vos bagages',
    how_eyebrow:'Simple de la réservation au retour',how_title:'Comment ça marche',
    step1_t:'Choisissez votre destination',step1_c:'Sélectionnez le pays, la ville et vos dates.',
    step2_t:'Choisissez votre équipement',step2_c:'Comparez des loueurs locaux vérifiés.',
    step3_t:'Un paiement sécurisé',step3_c:'Réservez plusieurs articles en une seule fois.',
    step4_t:'Livraison & récupération',step4_c:'Les partenaires livrent et récupèrent à votre hébergement.'
  },
  it:{
    nav_browse:'Esplora',nav_how:'Come funziona',nav_partners:'Per i partner',
    eyebrow:'Noleggi vacanza, tutto in un unico posto',
    hero_title:'Noleggia ciò che ti serve. <span>Non comprarlo.</span>',
    hero_copy:'Attrezzatura da spiaggia, baby, mobilità e vacanza — consegnata in hotel, villa o appartamento.',
    country:'Paese',city:'Città / località',from:'Dal',to:'Al',search:'Trova attrezzatura disponibile',
    trust_1:'Partner locali verificati',trust_2:'Consegna in struttura',trust_3:'Un solo checkout',
    browse_eyebrow:'Sfoglia per categoria',browse_title:'Tutto ciò che serve, senza bagagli extra',
    how_eyebrow:'Semplice dalla prenotazione al ritiro',how_title:'Come funziona',
    step1_t:'Scegli la destinazione',step1_c:'Seleziona paese, città e date.',
    step2_t:'Scegli cosa ti serve',step2_c:'Confronta partner locali verificati.',
    step3_t:'Un pagamento sicuro',step3_c:'Prenota più articoli con un unico pagamento.',
    step4_t:'Consegna e ritiro',step4_c:'I partner consegnano e ritirano presso il tuo alloggio.'
  },
  lt:{
    nav_browse:'Naršyti',nav_how:'Kaip veikia',nav_partners:'Tiekėjams',
    eyebrow:'Atostogų nuoma vienoje vietoje',
    hero_title:'Nuomokis tai, ko reikia. <span>Nepirk vienai kelionei.</span>',
    hero_copy:'Paplūdimio, vaikų, mobilumo ir kita atostogų įranga — pristatoma į viešbutį, vilą ar apartamentus.',
    country:'Šalis',city:'Miestas / kurortas',from:'Nuo',to:'Iki',search:'Rasti laisvą įrangą',
    trust_1:'Patikrinti vietiniai partneriai',trust_2:'Pristatymas į apgyvendinimo vietą',trust_3:'Vienas atsiskaitymas',
    browse_eyebrow:'Rinktis pagal kategoriją',browse_title:'Atostogų daiktai be papildomo bagažo',
    how_eyebrow:'Paprasta nuo rezervacijos iki atsiėmimo',how_title:'Kaip tai veikia',
    step1_t:'Pasirink kelionės vietą',step1_c:'Pasirink šalį, miestą ir kelionės datas.',
    step2_t:'Pasirink, ko reikia',step2_c:'Palygink patikrintus vietinius nuomotojus.',
    step3_t:'Vienas saugus atsiskaitymas',step3_c:'Rezervuok kelis daiktus vienu mokėjimu.',
    step4_t:'Pristatymas ir paėmimas',step4_c:'Partneriai pristato ir pasiima iš tavo apgyvendinimo vietos.'
  }
});

// Add country/city keys to existing English/Spanish translations.
translations.en.country='Country';
translations.en.city='City / resort';
translations.es.country='País';
translations.es.city='Ciudad / zona';

// Store selected destination in the search action for later matching.
document.getElementById('searchForm')?.addEventListener('submit',()=>{
  const selected = {
    country: document.getElementById('countrySelect')?.value || 'ES',
    city: document.getElementById('citySelect')?.value || '',
    from: document.getElementById('fromDate')?.value || '',
    to: document.getElementById('toDate')?.value || ''
  };
  localStorage.setItem('holidaygear_destination', JSON.stringify(selected));
}, true);


// --- V11 supplier service location profile ---
function v11FillServiceLocations(s){
  if(document.getElementById('accServiceCountry')) {
    document.getElementById('accServiceCountry').value=s.serviceCountry||s.country||'ES';
  }
  if(document.getElementById('accServiceCities')) {
    document.getElementById('accServiceCities').value=(s.serviceCities||s.area||'');
  }
}

document.getElementById('supplierAccountBtn')?.addEventListener('click',()=>{
  const s=currentSupplier(); if(!s) return;
  setTimeout(()=>v11FillServiceLocations(s),0);
}, true);

document.getElementById('supplierAccountForm')?.addEventListener('submit',(e)=>{
  const email=getSession();
  const accounts=loadAccounts();
  const idx=accounts.findIndex(a=>a.email===email);
  if(idx>=0){
    accounts[idx].serviceCountry=document.getElementById('accServiceCountry')?.value||'ES';
    accounts[idx].serviceCities=document.getElementById('accServiceCities')?.value.trim()||'';
    saveAccounts(accounts);
  }
}, true);


// --- V12 universal item-rental marketplace ---
const universalDestinations = {
  LT:['Vilnius','Kaunas','Klaipėda','Šiauliai','Panevėžys','Palanga'],
  ES:['Madrid','Barcelona','Valencia','Málaga','Palma de Mallorca','Ibiza Town'],
  PT:['Lisbon','Porto','Faro','Albufeira','Lagos','Funchal'],
  GR:['Athens','Thessaloniki','Rhodes','Heraklion','Chania','Corfu'],
  CY:['Paphos','Limassol','Larnaca','Ayia Napa','Protaras'],
  IT:['Rome','Milan','Naples','Palermo','Cagliari','Olbia'],
  FR:['Paris','Nice','Cannes','Marseille','Bordeaux']
};

function populateUniversalCities(){
  const country=document.getElementById('countrySelect')?.value||'LT';
  const city=document.getElementById('citySelect');
  if(!city) return;
  city.innerHTML=(universalDestinations[country]||[]).map(c=>`<option>${c}</option>`).join('');
}
document.getElementById('countrySelect')?.addEventListener('change',populateUniversalCities);
populateUniversalCities();

const LEGACY_DEMO_LISTINGS = new Map([
  ['1','10 Folding Chairs'],
  ['2','Cordless Drill Set'],
  ['3','Projector + Screen'],
  ['4','Party Table Set'],
  ['5','Lawn Aerator'],
  ['6','Road Bike']
]);
const defaultListings = [];

function isLegacyDemoListing(listing){
  if(!listing || typeof listing!=='object') return false;
  const expected=LEGACY_DEMO_LISTINGS.get(String(listing.id||''));
  if(!expected || listing.title!==expected) return false;
  return !listing.ownerEmail && !listing.supplierId && !listing.createdAt;
}
function purgeLegacyDemoListings(items){
  return Array.isArray(items)?items.filter(item=>!isLegacyDemoListing(item)):[];
}

function loadUniversalListings(){
  let saved=null;
  try{saved=JSON.parse(localStorage.getItem('rentall_listings')||'null');}catch{}
  const source=Array.isArray(saved)?saved:defaultListings;
  const cleaned=purgeLegacyDemoListings(source);
  if(Array.isArray(saved) && cleaned.length!==saved.length){
    localStorage.setItem('rentall_listings',JSON.stringify(cleaned));
  }
  return cleaned;
}
function saveUniversalListings(items){
  localStorage.setItem('rentall_listings',JSON.stringify(items));
}
function renderUniversalListings(items=loadUniversalListings()){
  const grid=document.getElementById('listingPreviewGrid');
  if(!grid) return;
  grid.innerHTML=items.map(l=>`
    <div class="listing-card">
      <small>${l.ownerType==='business'?'Business':'Individual'} · ${l.city}</small>
      <h4>${l.title}</h4>
      <p>${l.description||'Local rental listing'}</p>
      <div class="listing-meta">
        <div><span>Available</span><b>${l.quantity}</b></div>
        <div><span>Per day</span><b>€${Number(l.priceDay||0).toFixed(2)}</b></div>
        <div><span>Per week</span><b>${l.priceWeek?`€${Number(l.priceWeek).toFixed(2)}`:'—'}</b></div>
        <div><span>Deposit</span><b>${l.deposit?`€${Number(l.deposit).toFixed(0)}`:'—'}</b></div>
        <div><span>Delivery</span><b>${l.delivery}</b></div>
      </div>
    </div>`).join('');
}
renderUniversalListings();

const listingModal=document.getElementById('listingModal');
document.getElementById('openListingFormBtn')?.addEventListener('click',()=>{
  if(!currentSupplier()){ openAuth('register'); return; }
  listingModal.classList.add('open');
});
document.getElementById('closeListingModal')?.addEventListener('click',()=>listingModal.classList.remove('open'));

document.getElementById('listingForm')?.addEventListener('submit',e=>{
  e.preventDefault();
  const s=currentSupplier(); if(!s) return;
  const items=loadUniversalListings();
  const listing={
    id:Date.now(),
    title:document.getElementById('listingTitle').value.trim(),
    category:document.getElementById('listingCategory').value,
    quantity:Number(document.getElementById('listingQuantity').value||1),
    country:document.getElementById('listingCountry').value,
    city:document.getElementById('listingCity').value.trim(),
    priceDay:Number(document.getElementById('listingPriceDay').value||0),
    priceWeek:Number(document.getElementById('listingPriceWeek').value||0),
    deposit:Number(document.getElementById('listingDeposit').value||0),
    delivery:document.getElementById('listingDelivery').value,
    description:document.getElementById('listingDescription').value.trim(),
    ownerType:s.accountType||'individual',
    ownerEmail:s.email
  };
  items.unshift(listing);
  saveUniversalListings(items);
  renderUniversalListings(items);
  document.getElementById('listingMsg').textContent='Listing published.';
  e.target.reset();
  setTimeout(()=>listingModal.classList.remove('open'),450);
});

document.getElementById('searchForm')?.addEventListener('submit',e=>{
  e.preventDefault();
  const country=document.getElementById('countrySelect')?.value||'LT';
  const city=document.getElementById('citySelect')?.value||'';
  const keyword=(document.getElementById('keywordSearch')?.value||'').toLowerCase().trim();
  const category=document.getElementById('categorySelect')?.value||'all';
  const qty=Number(document.getElementById('quantitySearch')?.value||1);

  const filtered=loadUniversalListings().filter(l=>{
    if(l.country!==country) return false;
    if(city && l.city!==city) return false;
    if(category!=='all' && l.category!==category) return false;
    if(Number(l.quantity||0)<qty) return false;
    if(keyword && !(l.title+' '+(l.description||'')).toLowerCase().includes(keyword)) return false;
    return true;
  });
  renderUniversalListings(filtered);
  document.getElementById('list-item')?.scrollIntoView({behavior:'smooth'});
}, true);

// Persist Individual / Business choice on registration.
document.getElementById('supplierRegisterForm')?.addEventListener('submit',()=>{
  const email=document.getElementById('regEmail')?.value.trim().toLowerCase();
  const type=document.getElementById('regAccountType')?.value||'individual';
  setTimeout(()=>{
    const accounts=loadAccounts();
    const idx=accounts.findIndex(a=>a.email===email);
    if(idx>=0){
      accounts[idx].accountType=type;
      if(document.getElementById('regCountry')) accounts[idx].country=document.getElementById('regCountry').value;
      saveAccounts(accounts);
    }
  },0);
}, true);


// --- V13 For my trip search flow ---
const tripDestinationMap = {
  ES:['Madrid','Barcelona','Valencia','Málaga','Palma de Mallorca','Magaluf','Palma Nova','Santa Ponça','Ibiza Town'],
  PT:['Lisbon','Porto','Faro','Albufeira','Lagos','Funchal'],
  GR:['Athens','Thessaloniki','Rhodes','Heraklion','Chania','Corfu'],
  CY:['Paphos','Limassol','Larnaca','Ayia Napa','Protaras'],
  IT:['Rome','Milan','Naples','Palermo','Cagliari','Olbia'],
  FR:['Paris','Nice','Cannes','Marseille','Bordeaux'],
  LT:['Vilnius','Kaunas','Klaipėda','Palanga']
};

function populateTripCities(){
  const country=document.getElementById('tripCountrySelect')?.value||'ES';
  const city=document.getElementById('tripCitySelect');
  if(!city) return;
  city.innerHTML=(tripDestinationMap[country]||[]).map(c=>`<option>${c}</option>`).join('');
}
document.getElementById('tripCountrySelect')?.addEventListener('change',populateTripCities);
populateTripCities();

document.querySelectorAll('.search-mode-tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const mode=btn.dataset.searchMode;
    document.querySelectorAll('.search-mode-tab').forEach(b=>b.classList.toggle('active',b===btn));
    document.querySelectorAll('.search-mode-form').forEach(f=>f.classList.toggle('active',f.dataset.mode===mode));
    const summary=document.getElementById('tripSearchSummary');
    if(summary && mode!=='trip') summary.classList.remove('show');
  });
});

function listingSupportsTripDelivery(listing, city){
  if(listing.accommodationDelivery===false) return false;
  if(listing.accommodationDelivery==='no') return false;
  if(listing.delivery==='Pickup only') return false;

  if(Array.isArray(listing.deliveryZones) && listing.deliveryZones.length){
    return listing.deliveryZones.some(z=>String(z).toLowerCase()===String(city).toLowerCase());
  }
  if(typeof listing.deliveryZones==='string' && listing.deliveryZones.trim()){
    return listing.deliveryZones
      .split(',')
      .map(s=>s.trim().toLowerCase())
      .includes(String(city).toLowerCase());
  }

  return listing.city===city || listing.delivery==='Delivery available' || listing.delivery==='Pickup or delivery';
}

document.getElementById('tripSearchForm')?.addEventListener('submit',e=>{
  e.preventDefault();

  const country=document.getElementById('tripCountrySelect').value;
  const city=document.getElementById('tripCitySelect').value;
  const accommodation=document.getElementById('tripAccommodation').value.trim();
  const from=document.getElementById('tripFromDate').value;
  const to=document.getElementById('tripToDate').value;
  const qty=Number(document.getElementById('tripQuantity').value||1);
  const keyword=(document.getElementById('tripKeywordSearch').value||'').toLowerCase().trim();
  const category=document.getElementById('tripCategorySelect').value;

  const filtered=loadUniversalListings().filter(l=>{
    if(l.country!==country) return false;
    if(Number(l.quantity||0)<qty) return false;
    if(category!=='all' && l.category!==category) return false;
    if(keyword && !(l.title+' '+(l.description||'')).toLowerCase().includes(keyword)) return false;
    if(!listingSupportsTripDelivery(l,city)) return false;
    return true;
  });

  renderUniversalListings(filtered);

  const summary=document.getElementById('tripSearchSummary');
  summary.innerHTML=`<b>Deliver to: ${escapeHtml(accommodation)}, ${escapeHtml(city)}</b>${escapeHtml(from)} → ${escapeHtml(to)} · ${qty} item${qty===1?'':'s'} · ${filtered.length} matching rental${filtered.length===1?'':'s'}`;
  summary.classList.add('show');

  localStorage.setItem('rentall_trip_search',JSON.stringify({
    country,city,accommodation,from,to,qty,keyword,category
  }));

  document.getElementById('list-item')?.scrollIntoView({behavior:'smooth'});
});

// Extend listing creation with accommodation-delivery settings.
document.getElementById('listingForm')?.addEventListener('submit',()=>{
  const accommodationDelivery=document.getElementById('listingAccommodationDelivery')?.value||'no';
  const deliveryZones=(document.getElementById('listingDeliveryZones')?.value||'')
    .split(',').map(s=>s.trim()).filter(Boolean);
  setTimeout(()=>{
    const items=loadUniversalListings();
    if(!items.length) return;
    const newest=items[0];
    newest.accommodationDelivery=accommodationDelivery;
    newest.deliveryZones=deliveryZones;
    saveUniversalListings(items);
    renderUniversalListings(items);
  },0);
}, true);

// Enrich demo listings with delivery capability for trip mode.
(function enrichDefaultTripDelivery(){
  const saved=JSON.parse(localStorage.getItem('rentall_listings')||'null');
  if(saved) return;

  defaultListings.forEach(l=>{
    if(l.country==='ES'){
      l.accommodationDelivery='yes';
      l.deliveryZones=[l.city,'Barcelona','Palma de Mallorca','Magaluf','Palma Nova'];
    }else{
      l.accommodationDelivery=l.delivery==='Pickup only'?'no':'yes';
      l.deliveryZones=[l.city];
    }
  });
})();


// --- V14: listing-level hotel delivery settings ---
function normalizeDeliveryZones(value){
  if(Array.isArray(value)) return value;
  return String(value||'')
    .split(',')
    .map(s=>s.trim())
    .filter(Boolean);
}

// Override listing render to include hotel-delivery terms.
renderUniversalListings = function(items=loadUniversalListings()){
  const grid=document.getElementById('listingPreviewGrid');
  if(!grid) return;

  grid.innerHTML=items.map(l=>{
    const hotelDelivery = l.accommodationDelivery==='yes' || l.accommodationDelivery===true;
    const zones = normalizeDeliveryZones(l.deliveryZones);
    return `
      <div class="listing-card">
        <small>${l.ownerType==='business'?'Business':'Individual'} · ${l.city}</small>
        <h4>${l.title}</h4>
        <p>${l.description||'Local rental listing'}</p>

        <div class="listing-meta">
          <div><span>Available</span><b>${l.quantity}</b></div>
          <div><span>Per day</span><b>€${Number(l.priceDay||0).toFixed(2)}</b></div>
          <div><span>Per week</span><b>${l.priceWeek?`€${Number(l.priceWeek).toFixed(2)}`:'—'}</b></div>
          <div><span>Deposit</span><b>${l.deposit?`€${Number(l.deposit).toFixed(0)}`:'—'}</b></div>
          <div><span>Delivery</span><b>${l.delivery}</b></div>
        </div>

        ${hotelDelivery ? `
          <div class="delivery-info-box">
            <b>Hotel / apartment delivery</b>
            <div class="delivery-info-grid">
              <div><span>Zones</span><strong>${zones.length?zones.join(', '):l.city}</strong></div>
              <div><span>Delivery fee</span><strong>€${Number(l.hotelDeliveryFee||0).toFixed(2)}</strong></div>
              <div><span>Minimum order</span><strong>€${Number(l.minOrder||0).toFixed(2)}</strong></div>
              <div><span>Lead time</span><strong>${l.deliveryLeadTime||'Same day'}</strong></div>
              <div><span>Window</span><strong>${l.deliveryWindow||'08:00–20:00'}</strong></div>
            </div>
          </div>` : ''}
      </div>`;
  }).join('');
};

// Extend listing submit persistence.
document.getElementById('listingForm')?.addEventListener('submit',()=>{
  const snapshot={
    accommodationDelivery:document.getElementById('listingAccommodationDelivery')?.value||'no',
    deliveryZones:normalizeDeliveryZones(document.getElementById('listingDeliveryZones')?.value||''),
    hotelDeliveryFee:Number(document.getElementById('listingHotelDeliveryFee')?.value||0),
    minOrder:Number(document.getElementById('listingMinOrder')?.value||0),
    deliveryLeadTime:document.getElementById('listingDeliveryLeadTime')?.value||'same day',
    deliveryWindow:document.getElementById('listingDeliveryWindow')?.value||'08:00–20:00'
  };
  setTimeout(()=>{
    const items=loadUniversalListings();
    if(!items.length) return;
    Object.assign(items[0],snapshot);
    saveUniversalListings(items);
    renderUniversalListings(items);
  },20);
}, true);

// Trip search: require selected location to be in supported zones and enrich summary.
const oldTripForm = document.getElementById('tripSearchForm');
oldTripForm?.addEventListener('submit',()=>{
  setTimeout(()=>{
    const summary=document.getElementById('tripSearchSummary');
    if(!summary) return;

    const city=document.getElementById('tripCitySelect')?.value||'';
    const accommodation=document.getElementById('tripAccommodation')?.value.trim()||'';

    const deliverable=loadUniversalListings().filter(l=>{
      if(!(l.accommodationDelivery==='yes' || l.accommodationDelivery===true)) return false;
      if(l.delivery==='Pickup only') return false;
      const zones=normalizeDeliveryZones(l.deliveryZones);
      if(zones.length && !zones.map(z=>z.toLowerCase()).includes(city.toLowerCase())) return false;
      return true;
    });

    if(deliverable.length){
      const minFee=Math.min(...deliverable.map(l=>Number(l.hotelDeliveryFee||0)));
      const fastest=deliverable[0]?.deliveryLeadTime||'same day';
      summary.innerHTML += `<div style="margin-top:6px;color:var(--muted)">Delivery to ${accommodation}: from €${minFee.toFixed(2)} · fastest option: ${fastest}</div>`;
    }
  },50);
}, true);

// Enrich defaults once for demo.
(function enrichV14Defaults(){
  const current=JSON.parse(localStorage.getItem('rentall_listings')||'null');
  if(current){
    let changed=false;
    current.forEach(l=>{
      if(l.accommodationDelivery==='yes' || l.accommodationDelivery===true){
        if(l.hotelDeliveryFee===undefined){ l.hotelDeliveryFee=10; changed=true; }
        if(l.minOrder===undefined){ l.minOrder=25; changed=true; }
        if(!l.deliveryLeadTime){ l.deliveryLeadTime='same day'; changed=true; }
        if(!l.deliveryWindow){ l.deliveryWindow='08:00–20:00'; changed=true; }
      }
    });
    if(changed){
      saveUniversalListings(current);
      renderUniversalListings(current);
    }
  }
})();


// --- V15 automatic delivery pricing in checkout ---
let activeCheckoutListing = null;

function getTripContext(){
  try{
    return JSON.parse(localStorage.getItem('rentall_trip_search')||'null');
  }catch{
    return null;
  }
}

function normalizeZoneName(v){
  return String(v||'').trim().toLowerCase();
}

function listingServesLocation(listing, city, accommodation){
  if(!listing) return false;
  if(!(listing.accommodationDelivery==='yes' || listing.accommodationDelivery===true)) return false;
  if(listing.delivery==='Pickup only') return false;

  const zones=normalizeDeliveryZones(listing.deliveryZones);
  if(!zones.length){
    return normalizeZoneName(listing.city)===normalizeZoneName(city);
  }

  const cityMatch=zones.some(z=>normalizeZoneName(z)===normalizeZoneName(city));
  if(cityMatch) return true;

  // MVP fallback: allow accommodation name to contain a configured zone.
  const acc=normalizeZoneName(accommodation);
  return zones.some(z=>acc.includes(normalizeZoneName(z)));
}

function getCheckoutRentalSubtotal(){
  if(activeCheckoutListing){
    const start=document.getElementById('rentalStart')?.value||'';
    const end=document.getElementById('rentalEnd')?.value||'';
    const startMs=Date.parse(`${start}T00:00:00Z`),endMs=Date.parse(`${end}T00:00:00Z`);
    const days=(Number.isFinite(startMs)&&Number.isFinite(endMs)&&endMs>startMs)?Math.max(1,Math.round((endMs-startMs)/86400000)):1;
    const trip=getTripContext();
    const qty=Math.max(1,Number(trip?.qty||document.getElementById('quantitySearch')?.value||1));
    const day=Math.max(0,Number(activeCheckoutListing.priceDay||0)),week=Math.max(0,Number(activeCheckoutListing.priceWeek||0));
    const dailyTotal=days*day,weekMix=week>0?Math.floor(days/7)*week+(days%7)*day:dailyTotal;
    return Number((Math.min(dailyTotal,weekMix)*qty).toFixed(2));
  }
  return cartSubtotal();
}

function resolveDeliveryPricing(){
  const trip=getTripContext();
  const city=(document.getElementById('deliveryArea')?.value || trip?.city || '').trim();
  const accommodation=(document.getElementById('hotelName')?.value || trip?.accommodation || '').trim();
  const handoverMethod=(document.getElementById('accommodationType')?.value||'').trim();
  const pickupSelected=/pickup/i.test(handoverMethod);
  const subtotal=getCheckoutRentalSubtotal();

  if(!activeCheckoutListing){
    return {
      eligible:true,
      fee:0,
      minOrder:0,
      reason:'No listing-specific delivery rule found. Delivery fee is €0 in this prototype.'
    };
  }

  const hotelDelivery = activeCheckoutListing.accommodationDelivery==='yes' || activeCheckoutListing.accommodationDelivery===true;
  if(pickupSelected){
    return {
      eligible:true,
      fee:0,
      minOrder:0,
      reason:'Pickup from the owner · no delivery fee.'
    };
  }
  if(!hotelDelivery){
    if(!handoverMethod){
      return {
        eligible:true,
        fee:0,
        minOrder:0,
        reason:'Pickup is available. Choose your handover method in the next step.'
      };
    }
    return {
      eligible:false,
      fee:0,
      minOrder:Number(activeCheckoutListing.minOrder||0),
      reason:'This item is not available for hotel / apartment delivery.'
    };
  }

  if(city && !listingServesLocation(activeCheckoutListing, city, accommodation)){
    return {
      eligible:false,
      fee:0,
      minOrder:Number(activeCheckoutListing.minOrder||0),
      reason:`This owner does not deliver to ${city}.`
    };
  }

  const minOrder=Number(activeCheckoutListing.minOrder||0);
  if(subtotal < minOrder){
    return {
      eligible:false,
      fee:Number(activeCheckoutListing.hotelDeliveryFee||0),
      minOrder,
      reason:`Minimum order for delivery is €${minOrder.toFixed(2)}. Current rental subtotal is €${subtotal.toFixed(2)}.`
    };
  }

  const fee=Number(activeCheckoutListing.hotelDeliveryFee||0);
  return {
    eligible:true,
    fee,
    minOrder,
    reason:`Delivery to ${accommodation || city || 'selected location'}: €${fee.toFixed(2)} · ${activeCheckoutListing.deliveryLeadTime||'same day'} · ${activeCheckoutListing.deliveryWindow||'08:00–20:00'}`
  };
}


function ensureCheckoutPriceBreakdown(){
  if(document.getElementById('checkoutPriceBreakdown')) return;
  const total=document.getElementById('paymentTotal');
  const anchor=total?.parentElement;
  if(!anchor?.parentElement) return;
  const box=document.createElement('div');
  box.id='checkoutPriceBreakdown';
  box.className='checkout-price-breakdown';
  box.setAttribute('aria-live','polite');
  box.setAttribute('aria-atomic','true');
  anchor.parentElement.insertBefore(box,anchor);
}
function renderCheckoutPriceBreakdown({rental,delivery,total,securityDeposit=0}){
  ensureCheckoutPriceBreakdown();
  const box=document.getElementById('checkoutPriceBreakdown');
  if(!box) return;
  const start=document.getElementById('rentalStart')?.value||'',end=document.getElementById('rentalEnd')?.value||'';
  const sm=Date.parse(`${start}T00:00:00Z`),em=Date.parse(`${end}T00:00:00Z`);
  const days=(Number.isFinite(sm)&&Number.isFinite(em)&&em>sm)?Math.max(1,Math.round((em-sm)/86400000)):1;
  const trip=getTripContext();
  const qty=Math.max(1,Number(trip?.qty||document.getElementById('quantitySearch')?.value||1));
  box.innerHTML=`<div class="price-breakdown-row"><span>Rental · ${days} ${days===1?'day':'days'} · ${qty} ${qty===1?'item':'items'}</span><strong>${money(rental)}</strong></div>
  ${delivery>0?`<div class="price-breakdown-row"><span>Delivery</span><strong>${money(delivery)}</strong></div>`:''}
  ${securityDeposit>0?`<div class="price-breakdown-row v97-deposit-row"><span>Refundable security deposit</span><strong>${money(securityDeposit)}</strong></div>`:''}
  <div class="price-breakdown-total"><span>Estimated total</span><strong>${money(total)}</strong></div>
  <p class="price-breakdown-note">Final price is verified securely before the booking is created.</p>`;
}

function refreshCheckoutTotals(){
  const rental=getCheckoutRentalSubtotal();
  const deliveryRule=resolveDeliveryPricing();
  const delivery=deliveryRule.eligible ? deliveryRule.fee : 0;
  const total=rental+delivery;

  document.getElementById('rentalSubtotal').textContent=money(rental);
  document.getElementById('deliveryPreview').textContent=deliveryRule.eligible ? money(delivery) : 'Not available';
  document.getElementById('step1Total').textContent=money(total);
  document.getElementById('paymentRental').textContent=money(rental);
  document.getElementById('paymentDelivery').textContent=deliveryRule.eligible ? money(delivery) : '—';
  document.getElementById('paymentTotal').textContent=money(total);
  document.getElementById('payBtn').textContent=`Continue to secure payment · ${money(total)}`;
  const selectedListing=loadUniversalListings().find(l=>String(l.id)===String(getTripContext()?.listingId||'')) || null;
  const securityDeposit=Math.max(0,Number(selectedListing?.deposit||0));
  renderCheckoutPriceBreakdown({rental,delivery,total,securityDeposit});

  const note=document.getElementById('deliveryRuleNote');
  if(note){
    note.textContent=deliveryRule.reason;
    note.className='delivery-rule-note'+(deliveryRule.eligible?'':' error');
  }

  return {rental,delivery,total,deliveryRule};
}

// Map cart item / trip search to an actual listing where possible.
function inferCheckoutListing(){
  const listings=loadUniversalListings();
  const trip=getTripContext();

  if(trip){
    const selected=listings.find(l=>String(l.id)===String(trip.listingId||''));
    if(selected) return selected;
    const kw=String(trip.keyword||'').toLowerCase();
    const city=trip.city||'';
    const match=listings.find(l=>{
      if(l.country!==trip.country) return false;
      if(city && !listingServesLocation(l,city,trip.accommodation||'')) return false;
      if(kw && !(String(l.title)+' '+String(l.description||'')).toLowerCase().includes(kw)) return false;
      return true;
    });
    if(match) return match;
  }

  if(cart.length){
    const names=cart.map(i=>String(i.name||'').toLowerCase());
    const match=listings.find(l=>names.some(n=>String(l.title||'').toLowerCase().includes(n) || n.includes(String(l.title||'').toLowerCase())));
    if(match) return match;
  }

  return listings[0] || null;
}

// Override checkout fill so totals come from listing delivery rules.
fillCheckout = function(){
  const items = document.getElementById('checkoutItems');
  items.innerHTML = cart.map(i=>`<div class="checkout-item"><div><b>${i.name}</b><small>Rental item</small></div><b>${money(i.price)}</b></div>`).join('');

  activeCheckoutListing=inferCheckoutListing();

  const trip=getTripContext();
  if(trip){
    if(document.getElementById('deliveryArea')) document.getElementById('deliveryArea').value=trip.city||'';
    if(document.getElementById('hotelName')) document.getElementById('hotelName').value=trip.accommodation||'';
    if(document.getElementById('rentalStart')) document.getElementById('rentalStart').value=trip.from||'';
    if(document.getElementById('rentalEnd')) document.getElementById('rentalEnd').value=trip.to||'';
  }

  refreshCheckoutTotals();
};

['deliveryArea','hotelName','rentalStart','rentalEnd'].forEach(id=>{
  document.getElementById(id)?.addEventListener('input',refreshCheckoutTotals);
  document.getElementById(id)?.addEventListener('change',refreshCheckoutTotals);
});

// Re-render review using calculated delivery.
renderReview = function(){
  const price=refreshCheckoutTotals();
  const names = cart.map(i=>i.name).join(', ') || activeCheckoutListing?.title || 'Rental item';
  const html = `
    <h3>${names}</h3>
    <div class="review-row"><span>Rental period</span><b>${document.getElementById('rentalStart').value || '—'} → ${document.getElementById('rentalEnd').value || '—'}</b></div>
    <div class="review-row"><span>Delivery</span><b>${document.getElementById('hotelName').value || '—'}, ${document.getElementById('deliveryArea').value || '—'}</b></div>
    <div class="review-row"><span>Delivery window</span><b>${activeCheckoutListing?.deliveryWindow || document.getElementById('deliveryWindow').value || '—'}</b></div>
    <div class="review-row"><span>Rental</span><b>${money(price.rental)}</b></div>
    <div class="review-row"><span>Delivery</span><b>${price.deliveryRule.eligible ? money(price.delivery) : 'Not available'}</b></div>
    <div class="review-row total"><span>Total</span><b>${money(price.total)}</b></div>`;
  document.getElementById('reviewCard').innerHTML=html;
};

// Prevent checkout progression/payment when delivery is not eligible.
document.querySelectorAll('.next-step').forEach(btn=>{
  btn.addEventListener('click',(e)=>{
    const next=Number(btn.dataset.next);
    if(bookingStep===1 || bookingStep===2){
      const pricing=refreshCheckoutTotals();
      if(!pricing.deliveryRule.eligible){
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }
  }, true);
});

bookingForm.addEventListener('submit',(e)=>{
  const pricing=refreshCheckoutTotals();
  if(!pricing.deliveryRule.eligible){
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}, true);


// --- V16: show delivery + estimated total directly in search/listing cards ---
function getCurrentSearchContext(){
  const trip=getTripContext();
  if(trip){
    return {
      mode:'trip',
      country:trip.country||'',
      city:trip.city||'',
      accommodation:trip.accommodation||'',
      qty:Number(trip.qty||1),
      from:trip.from||'',
      to:trip.to||''
    };
  }

  return {
    mode:'local',
    country:document.getElementById('countrySelect')?.value||'',
    city:document.getElementById('citySelect')?.value||'',
    accommodation:'',
    qty:Number(document.getElementById('quantitySearch')?.value||1),
    from:document.getElementById('fromDate')?.value||'',
    to:document.getElementById('toDate')?.value||''
  };
}

function rentalDays(from,to){
  if(!from || !to) return 1;
  const a=new Date(from+'T00:00:00');
  const b=new Date(to+'T00:00:00');
  const diff=Math.round((b-a)/86400000);
  return Math.max(1,diff);
}

function calculateListingPreview(listing, ctx){
  const days=rentalDays(ctx.from,ctx.to);
  const qty=Math.max(1,Number(ctx.qty||1));

  let rental=0;
  if(listing.priceWeek && days>=7){
    const fullWeeks=Math.floor(days/7);
    const extraDays=days%7;
    rental=(fullWeeks*Number(listing.priceWeek||0) + extraDays*Number(listing.priceDay||0))*qty;
  }else{
    rental=Number(listing.priceDay||0)*days*qty;
  }

  if(ctx.mode!=='trip'){
    return {
      eligible:true,
      rental,
      delivery:0,
      total:rental,
      note:`Estimated for ${days} day${days===1?'':'s'} × ${qty}`
    };
  }

  const serves=listingServesLocation(listing,ctx.city,ctx.accommodation);
  const minOrder=Number(listing.minOrder||0);

  if(!serves){
    return {
      eligible:false,
      rental,
      delivery:0,
      total:rental,
      note:`Delivery not available to ${ctx.city||'selected location'}`
    };
  }

  if(rental<minOrder){
    return {
      eligible:false,
      rental,
      delivery:Number(listing.hotelDeliveryFee||0),
      total:rental,
      note:`Minimum delivery order is €${minOrder.toFixed(2)}`
    };
  }

  const delivery=Number(listing.hotelDeliveryFee||0);
  return {
    eligible:true,
    rental,
    delivery,
    total:rental+delivery,
    note:`Delivery to ${ctx.accommodation||ctx.city}: ${listing.deliveryLeadTime||'same day'}`
  };
}
function localizePreviewNote(preview,ctx){
  const note=String(preview?.note||'');
  let m=note.match(/^Estimated for (\d+) days? × (\d+)$/);
  if(m) return uiText('Estimated for {days} day(s) × {qty}',{days:m[1],qty:m[2]});
  m=note.match(/^Delivery not available to (.+)$/);
  if(m) return uiText('Delivery not available to {location}',{location:m[1]});
  m=note.match(/^Minimum delivery order is €(.+)$/);
  if(m) return uiText('Minimum delivery order is €{amount}',{amount:m[1]});
  m=note.match(/^Delivery to (.+): (.+)$/);
  if(m) return uiText('Delivery to {location}: {leadTime}',{location:m[1],leadTime:uiText(m[2])});
  return note;
}


renderUniversalListings = function(items=loadUniversalListings()){
  const grid=document.getElementById('listingPreviewGrid');
  if(!grid) return;

  const ctx=getCurrentSearchContext();

  grid.innerHTML=items.map(l=>{
    const hotelDelivery = l.accommodationDelivery==='yes' || l.accommodationDelivery===true;
    const zones = normalizeDeliveryZones(l.deliveryZones);
    const preview=calculateListingPreview(l,ctx);

    return `
      <div class="listing-card">
        <small>${l.ownerType==='business'?'Business':'Individual'} · ${l.city}</small>
        <h4>${l.title}</h4>
        <p>${l.description||'Local rental listing'}</p>

        <div class="listing-meta">
          <div><span>Available</span><b>${l.quantity}</b></div>
          <div><span>Per day</span><b>€${Number(l.priceDay||0).toFixed(2)}</b></div>
          <div><span>Per week</span><b>${l.priceWeek?`€${Number(l.priceWeek).toFixed(2)}`:'—'}</b></div>
          <div><span>Deposit</span><b>${l.deposit?`€${Number(l.deposit).toFixed(0)}`:'—'}</b></div>
          <div><span>Delivery</span><b>${l.delivery}</b></div>
        </div>

        ${hotelDelivery ? `
          <div class="delivery-info-box">
            <b>Hotel / apartment delivery</b>
            <div class="delivery-info-grid">
              <div><span>Zones</span><strong>${zones.length?zones.join(', '):l.city}</strong></div>
              <div><span>Delivery fee</span><strong>€${Number(l.hotelDeliveryFee||0).toFixed(2)}</strong></div>
              <div><span>Minimum order</span><strong>€${Number(l.minOrder||0).toFixed(2)}</strong></div>
              <div><span>Lead time</span><strong>${l.deliveryLeadTime||'Same day'}</strong></div>
              <div><span>Window</span><strong>${l.deliveryWindow||'08:00–20:00'}</strong></div>
            </div>
          </div>` : ''}

        <div class="price-preview-box">
          <div class="price-preview-row"><span>Rental estimate</span><b>€${preview.rental.toFixed(2)}</b></div>
          <div class="price-preview-row"><span>Delivery</span><b>${ctx.mode==='trip' ? (preview.eligible ? `€${preview.delivery.toFixed(2)}` : 'Not available') : 'Calculated at checkout'}</b></div>
          <div class="price-preview-row total"><span>Estimated total</span><b>€${preview.total.toFixed(2)}</b></div>
          <div class="price-preview-note ${preview.eligible?'ok':'error'}">${preview.note}</div>
        </div>
      </div>`;
  }).join('');
};

// Re-render after local/trip search values change.
['countrySelect','citySelect','keywordSearch','categorySelect','quantitySearch','fromDate','toDate',
 'tripCountrySelect','tripCitySelect','tripAccommodation','tripFromDate','tripToDate','tripQuantity',
 'tripKeywordSearch','tripCategorySelect'].forEach(id=>{
  document.getElementById(id)?.addEventListener('change',()=>renderUniversalListings());
  document.getElementById(id)?.addEventListener('input',()=>renderUniversalListings());
});

// After trip search, persist context first and then re-render to ensure delivery pricing is visible.
document.getElementById('tripSearchForm')?.addEventListener('submit',()=>{
  setTimeout(()=>renderUniversalListings(
    getFilteredWebhookEvents ? loadUniversalListings().filter(l=>{
      const trip=getTripContext();
      if(!trip) return true;
      if(l.country!==trip.country) return false;
      if(Number(l.quantity||0)<Number(trip.qty||1)) return false;
      if(trip.category && trip.category!=='all' && l.category!==trip.category) return false;
      if(trip.keyword && !(String(l.title)+' '+String(l.description||'')).toLowerCase().includes(String(trip.keyword).toLowerCase())) return false;
      return listingServesLocation(l,trip.city,trip.accommodation||'');
    }) : loadUniversalListings()
  ),80);
}, true);


// --- V17: accommodation address, room number and delivery instructions ---
function getDeliveryFormData(){
  return {
    accommodationName: document.getElementById('hotelName')?.value.trim() || '',
    address: document.getElementById('deliveryAddress')?.value.trim() || '',
    bookingName: document.getElementById('hotelBookingName')?.value.trim() || '',
    roomNumber: document.getElementById('roomNumber')?.value.trim() || '',
    instructions: document.getElementById('deliveryInstructions')?.value.trim() || ''
  };
}

function saveDeliveryFormData(){
  const data=getDeliveryFormData();
  localStorage.setItem('rentall_delivery_details', JSON.stringify(data));
}

function loadDeliveryFormData(){
  let saved=null;
  try{
    saved=JSON.parse(localStorage.getItem('rentall_delivery_details')||'null');
  }catch{}

  const trip=getTripContext();

  if(document.getElementById('hotelName') && !document.getElementById('hotelName').value){
    document.getElementById('hotelName').value=saved?.accommodationName || trip?.accommodation || '';
  }
  if(document.getElementById('deliveryAddress') && !document.getElementById('deliveryAddress').value){
    document.getElementById('deliveryAddress').value=saved?.address || '';
  }
  if(document.getElementById('hotelBookingName') && !document.getElementById('hotelBookingName').value){
    document.getElementById('hotelBookingName').value=saved?.bookingName || '';
  }
  if(document.getElementById('roomNumber') && !document.getElementById('roomNumber').value){
    document.getElementById('roomNumber').value=saved?.roomNumber || '';
  }
  if(document.getElementById('deliveryInstructions') && !document.getElementById('deliveryInstructions').value){
    document.getElementById('deliveryInstructions').value=saved?.instructions || '';
  }
}

['hotelName','deliveryAddress','hotelBookingName','roomNumber','deliveryInstructions'].forEach(id=>{
  document.getElementById(id)?.addEventListener('input',()=>{
    saveDeliveryFormData();
    if(typeof refreshCheckoutTotals==='function') refreshCheckoutTotals();
  });
});

const previousFillCheckout = fillCheckout;
fillCheckout = function(){
  previousFillCheckout();
  loadDeliveryFormData();
  refreshCheckoutTotals();
};

renderReview = function(){
  const price=refreshCheckoutTotals();
  const names = cart.map(i=>i.name).join(', ') || activeCheckoutListing?.title || 'Rental item';
  const delivery=getDeliveryFormData();

  const html = `
    <h3>${names}</h3>
    <div class="review-row"><span>Rental period</span><b>${document.getElementById('rentalStart').value || '—'} → ${document.getElementById('rentalEnd').value || '—'}</b></div>
    <div class="review-row"><span>Hotel / apartment</span><b>${delivery.accommodationName || '—'}</b></div>
    <div class="review-row"><span>Address</span><b>${delivery.address || '—'}</b></div>
    <div class="review-row"><span>City / area</span><b>${document.getElementById('deliveryArea').value || '—'}</b></div>
    <div class="review-row"><span>Guest / booking name</span><b>${delivery.bookingName || '—'}</b></div>
    <div class="review-row"><span>Room / apartment</span><b>${delivery.roomNumber || 'Not provided'}</b></div>
    <div class="review-row"><span>Delivery window</span><b>${activeCheckoutListing?.deliveryWindow || document.getElementById('deliveryWindow').value || '—'}</b></div>
    ${delivery.instructions ? `<div class="delivery-instructions-preview"><b>Delivery instructions</b><br>${delivery.instructions}</div>` : ''}
    <div class="review-row"><span>Rental</span><b>${money(price.rental)}</b></div>
    <div class="review-row"><span>Delivery</span><b>${price.deliveryRule.eligible ? money(price.delivery) : 'Not available'}</b></div>
    <div class="review-row total"><span>Total</span><b>${money(price.total)}</b></div>`;
  document.getElementById('reviewCard').innerHTML=html;
};

// Require accommodation address for delivery bookings before advancing from delivery step.
document.querySelectorAll('.next-step').forEach(btn=>{
  btn.addEventListener('click',(e)=>{
    if(bookingStep===2){
      const addr=document.getElementById('deliveryAddress');
      if(addr && !addr.value.trim()){
        e.preventDefault();
        e.stopImmediatePropagation();
        addr.reportValidity();
      }
    }
  }, true);
});


// --- V18: richer delivery summary in booking review ---
renderReview = function(){
  const price=refreshCheckoutTotals();
  const names = cart.map(i=>i.name).join(', ') || activeCheckoutListing?.title || 'Rental item';
  const delivery=getDeliveryFormData();

  const html = `
    <h3>${names}</h3>

    <div class="review-row">
      <span>Rental period</span>
      <b>${document.getElementById('rentalStart').value || '—'} → ${document.getElementById('rentalEnd').value || '—'}</b>
    </div>

    <div class="delivery-summary-card">
      <h4>Delivery details</h4>
      <div class="delivery-summary-grid">
        <div>
          <span>Hotel / apartment</span>
          <b>${delivery.accommodationName || '—'}</b>
        </div>
        <div>
          <span>City / area</span>
          <b>${document.getElementById('deliveryArea').value || '—'}</b>
        </div>
        <div>
          <span>Address</span>
          <b>${delivery.address || '—'}</b>
        </div>
        <div>
          <span>Room / apartment number</span>
          <b>${delivery.roomNumber || 'Not provided'}</b>
        </div>
        <div>
          <span>Contact person</span>
          <b>${delivery.bookingName || '—'}</b>
        </div>
        <div>
          <span>Delivery window</span>
          <b>${activeCheckoutListing?.deliveryWindow || document.getElementById('deliveryWindow').value || '—'}</b>
        </div>
        <div class="delivery-summary-instructions">
          <span>Delivery instructions</span>
          <b>${delivery.instructions || 'No special instructions'}</b>
        </div>
      </div>
    </div>

    <div class="review-row"><span>Rental</span><b>${money(price.rental)}</b></div>
    <div class="review-row"><span>Delivery</span><b>${price.deliveryRule.eligible ? money(price.delivery) : 'Not available'}</b></div>
    <div class="review-row total"><span>Total</span><b>${money(price.total)}</b></div>`;

  document.getElementById('reviewCard').innerHTML=html;
};


// --- V19: supplier booking detail view with delivery information ---
const bookingDeliveryDefaults = {
  1:{accommodationName:'Caramelo Calviá Beach',address:'Avinguda de Magaluf 18, 07181 Magaluf',roomNumber:'214',contactPerson:'Anna Smith',instructions:'Leave with reception if guest is not in the room.'},
  2:{accommodationName:'Palmanova Suites',address:'Carrer de Torrenova 34, 07181 Palma Nova',roomNumber:'A-12',contactPerson:'Jonas Meyer',instructions:'Call on arrival. Meet guest in the lobby.'},
  3:{accommodationName:'Santa Ponça Apartments',address:'Via de la Creu 8, 07180 Santa Ponça',roomNumber:'',contactPerson:'Sophie Martin',instructions:'Reception accepts deliveries until 18:00.'},
  4:{accommodationName:'Private apartment',address:'Carrer de Sant Miquel 22, Palma',roomNumber:'3B',contactPerson:'Marek Nowak',instructions:'Use intercom 3B and call if there is no answer.'},
  5:{accommodationName:'Alcúdia Garden Hotel',address:'Avinguda de la Platja 1, 07400 Alcúdia',roomNumber:'108',contactPerson:'Lucía García',instructions:'Deliver to reception under guest booking name.'},
  6:{accommodationName:'Magaluf Apartment',address:'Carrer Contralmirall Riera 5, Magaluf',roomNumber:'7',contactPerson:'Emma Wilson',instructions:'Meet outside main entrance.'}
};

demoBookings.forEach(b=>{
  const d=bookingDeliveryDefaults[b.id]||{};
  b.accommodationName=b.accommodationName||d.accommodationName||'';
  b.deliveryAddress=b.deliveryAddress||d.address||'';
  b.roomNumber=b.roomNumber||d.roomNumber||'';
  b.contactPerson=b.contactPerson||d.contactPerson||b.guest||'';
  b.deliveryInstructions=b.deliveryInstructions||d.instructions||'';
});

function closeSupplierOrder(){
  const modal=document.getElementById('supplierOrderModal');
  if(!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden','true');
}

function openSupplierOrder(bookingId){
  const booking=demoBookings.find(b=>b.id===Number(bookingId));
  if(!booking) return;

  document.getElementById('supplierOrderTitle').textContent=`${booking.product} · ${booking.guest}`;
  document.getElementById('supplierOrderSummary').innerHTML=`
    <div class="supplier-order-card">
      <h3>Booking</h3>
      <div class="supplier-order-grid">
        <div><span>Guest</span><b>${booking.guest}</b></div>
        <div><span>Status</span><b>${booking.status}</b></div>
        <div><span>Rental dates</span><b>${booking.dates}</b></div>
        <div><span>Order value</span><b>€${booking.value}</b></div>
      </div>
    </div>

    <div class="supplier-order-card">
      <h3>Delivery details</h3>
      <div class="supplier-order-grid">
        <div><span>Hotel / apartment</span><b>${booking.accommodationName||'—'}</b></div>
        <div><span>Delivery area</span><b>${booking.delivery||'—'}</b></div>
        <div><span>Address</span><b>${booking.deliveryAddress||'—'}</b></div>
        <div><span>Room / apartment number</span><b>${booking.roomNumber||'Not provided'}</b></div>
        <div><span>Contact person</span><b>${booking.contactPerson||booking.guest||'—'}</b></div>
        <div class="supplier-order-instructions"><span>Delivery instructions</span><b>${booking.deliveryInstructions||'No special instructions'}</b></div>
      </div>
    </div>`;

  const actions=document.getElementById('supplierOrderActions');

  if(booking.status==='pending'){
    actions.innerHTML=`
      <button class="mini-action decline" data-order-action="declined" data-order-id="${booking.id}">Decline</button>
      <button class="mini-action accept" data-order-action="confirmed" data-order-id="${booking.id}">Accept booking</button>`;
  }else{
    actions.innerHTML=`<button class="secondary" id="closeOrderActionBtn">Close</button>`;
  }

  document.querySelectorAll('[data-order-action]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      booking.status=btn.dataset.orderAction;
      renderBookings();
      updateKPIs();
      openSupplierOrder(booking.id);
    });
  });

  document.getElementById('closeOrderActionBtn')?.addEventListener('click',closeSupplierOrder);

  const modal=document.getElementById('supplierOrderModal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');
}

document.getElementById('closeSupplierOrderModal')?.addEventListener('click',closeSupplierOrder);

// Override dashboard booking table to include detailed order view.
renderBookings = function(){
  const filter = document.getElementById('bookingFilter').value;
  const rows = demoBookings
    .filter(b=>filter==='all'||b.status===filter)
    .map(b=>{
      const actions = b.status==='pending'
        ? `<div class="action-row">
             <button class="view-order-btn" data-view-order="${b.id}">View</button>
             <button class="mini-action accept" data-id="${b.id}" data-action="confirmed">Accept</button>
             <button class="mini-action decline" data-id="${b.id}" data-action="declined">Decline</button>
           </div>`
        : `<div class="action-row">
             <button class="view-order-btn" data-view-order="${b.id}">View</button>
             <button class="mini-action" data-id="${b.id}" data-action="pending">Reset</button>
           </div>`;

      return `<tr>
        <td><b>${b.guest}</b></td>
        <td>${b.product}</td>
        <td>${b.dates}</td>
        <td>${b.delivery}</td>
        <td><b>€${b.value}</b></td>
        <td><span class="status ${b.status}">${b.status}</span></td>
        <td>${actions}</td>
      </tr>`;
    }).join('');

  document.getElementById('bookingTableBody').innerHTML =
    rows || `<tr><td colspan="7">No bookings in this view.</td></tr>`;

  document.querySelectorAll('.mini-action[data-id]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const booking = demoBookings.find(b=>b.id===Number(btn.dataset.id));
      booking.status = btn.dataset.action;
      renderBookings();
      updateKPIs();
    });
  });

  document.querySelectorAll('[data-view-order]').forEach(btn=>{
    btn.addEventListener('click',()=>openSupplierOrder(btn.dataset.viewOrder));
  });
};

renderBookings();


// --- V20: delivery-focused supplier booking list ---
function extractDeliveryDate(booking){
  if(booking.deliveryDate) return booking.deliveryDate;
  if(booking.dates){
    const parts=String(booking.dates).split('–');
    return parts[0]?.trim() || booking.dates;
  }
  return '—';
}

renderBookings = function(){
  const filter = document.getElementById('bookingFilter').value;

  const rows = demoBookings
    .filter(b=>filter==='all'||b.status===filter)
    .map(b=>{
      const actions = b.status==='pending'
        ? `<div class="action-row">
             <button class="view-order-btn" data-view-order="${b.id}">View</button>
             <button class="mini-action accept" data-id="${b.id}" data-action="confirmed">Accept</button>
             <button class="mini-action decline" data-id="${b.id}" data-action="declined">Decline</button>
           </div>`
        : `<div class="action-row">
             <button class="view-order-btn" data-view-order="${b.id}">View</button>
             <button class="mini-action" data-id="${b.id}" data-action="pending">Reset</button>
           </div>`;

      return `<tr>
        <td><b>${b.guest}</b></td>
        <td>${b.product}</td>
        <td class="hotel-cell">
          <b>${b.accommodationName||'—'}</b>
          <small>${b.deliveryAddress||''}</small>
        </td>
        <td>${b.delivery||'—'}</td>
        <td class="date-cell">${extractDeliveryDate(b)}</td>
        <td class="contact-cell">${b.contactPerson||b.guest||'—'}</td>
        <td><span class="status ${b.status}">${b.status}</span></td>
        <td>${actions}</td>
      </tr>`;
    }).join('');

  document.getElementById('bookingTableBody').innerHTML =
    rows || `<tr><td colspan="8">No bookings in this view.</td></tr>`;

  document.querySelectorAll('.mini-action[data-id]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const booking = demoBookings.find(b=>b.id===Number(btn.dataset.id));
      booking.status = btn.dataset.action;
      renderBookings();
      updateKPIs();
    });
  });

  document.querySelectorAll('[data-view-order]').forEach(btn=>{
    btn.addEventListener('click',()=>openSupplierOrder(btn.dataset.viewOrder));
  });
};

renderBookings();


// --- V21: supplier booking filters by status, city and delivery date ---
function normalizeBookingDate(value){
  if(!value) return '';
  const raw=String(value).trim();

  // Already ISO-like.
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // Demo values such as "22 Oct" are interpreted in 2026 for MVP display data.
  const m=raw.match(/^(\d{1,2})\s+([A-Za-z]{3})$/);
  if(m){
    const months={Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
    const month=months[m[2]];
    if(month) return `2026-${month}-${String(m[1]).padStart(2,'0')}`;
  }
  return '';
}

populateBookingCityFilter = function(){
  const select=document.getElementById('bookingCityFilter');
  if(!select) return;
  const current=select.value||'all';
  const cities=[...new Set(demoBookings.map(b=>b.delivery).filter(Boolean))].sort();
  select.innerHTML='<option value="all">All cities</option>'+
    cities.map(c=>`<option value="${c}">${c}</option>`).join('');
  if(cities.includes(current)) select.value=current;
}

function getFilteredBookings(){
  const status=document.getElementById('bookingFilter')?.value||'all';
  const city=document.getElementById('bookingCityFilter')?.value||'all';
  const date=document.getElementById('bookingDateFilter')?.value||'';

  return demoBookings.filter(b=>{
    if(status!=='all' && b.status!==status) return false;
    if(city!=='all' && b.delivery!==city) return false;
    if(date){
      const bookingDate=normalizeBookingDate(extractDeliveryDate(b));
      if(bookingDate!==date) return false;
    }
    return true;
  });
}

renderBookings = function(){
  populateBookingCityFilter();
  const filtered=getFilteredBookings();

  const rows = filtered.map(b=>{
    const actions = b.status==='pending'
      ? `<div class="action-row">
           <button class="view-order-btn" data-view-order="${b.id}">View</button>
           <button class="mini-action accept" data-id="${b.id}" data-action="confirmed">Accept</button>
           <button class="mini-action decline" data-id="${b.id}" data-action="declined">Decline</button>
         </div>`
      : `<div class="action-row">
           <button class="view-order-btn" data-view-order="${b.id}">View</button>
           <button class="mini-action" data-id="${b.id}" data-action="pending">Reset</button>
         </div>`;

    return `<tr>
      <td><b>${b.guest}</b></td>
      <td>${b.product}</td>
      <td class="hotel-cell">
        <b>${b.accommodationName||'—'}</b>
        <small>${b.deliveryAddress||''}</small>
      </td>
      <td>${b.delivery||'—'}</td>
      <td class="date-cell">${extractDeliveryDate(b)}</td>
      <td class="contact-cell">${b.contactPerson||b.guest||'—'}</td>
      <td><span class="status ${b.status}">${b.status}</span></td>
      <td>${actions}</td>
    </tr>`;
  }).join('');

  document.getElementById('bookingTableBody').innerHTML =
    rows || `<tr><td colspan="8">No bookings match the selected filters.</td></tr>`;

  const summary=document.getElementById('bookingFilterSummary');
  if(summary){
    summary.textContent=`Showing ${filtered.length} of ${demoBookings.length} bookings`;
  }

  document.querySelectorAll('.mini-action[data-id]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const booking = demoBookings.find(b=>b.id===Number(btn.dataset.id));
      booking.status = btn.dataset.action;
      renderBookings();
      updateKPIs();
    });
  });

  document.querySelectorAll('[data-view-order]').forEach(btn=>{
    btn.addEventListener('click',()=>openSupplierOrder(btn.dataset.viewOrder));
  });
};

['bookingFilter','bookingCityFilter','bookingDateFilter'].forEach(id=>{
  document.getElementById(id)?.addEventListener('change',renderBookings);
});

document.getElementById('clearBookingFiltersBtn')?.addEventListener('click',()=>{
  document.getElementById('bookingFilter').value='all';
  document.getElementById('bookingCityFilter').value='all';
  document.getElementById('bookingDateFilter').value='';
  renderBookings();
});

renderBookings();


// --- V22: persist supplier booking filters across order view / return ---
const BOOKING_FILTERS_KEY = 'rentall_supplier_booking_filters';

function saveBookingFilters(){
  const state = {
    status: document.getElementById('bookingFilter')?.value || 'all',
    city: document.getElementById('bookingCityFilter')?.value || 'all',
    date: document.getElementById('bookingDateFilter')?.value || ''
  };
  localStorage.setItem(BOOKING_FILTERS_KEY, JSON.stringify(state));
}

function loadBookingFilters(){
  let state = null;
  try{
    state = JSON.parse(localStorage.getItem(BOOKING_FILTERS_KEY) || 'null');
  }catch{}

  if(!state) return;

  const statusEl = document.getElementById('bookingFilter');
  const cityEl = document.getElementById('bookingCityFilter');
  const dateEl = document.getElementById('bookingDateFilter');

  if(statusEl) statusEl.value = state.status || 'all';

  // Populate city options first, then restore saved city if still valid.
  populateBookingCityFilter();
  if(cityEl){
    const valid = [...cityEl.options].some(o=>o.value===state.city);
    cityEl.value = valid ? state.city : 'all';
  }

  if(dateEl) dateEl.value = state.date || '';
}

['bookingFilter','bookingCityFilter','bookingDateFilter'].forEach(id=>{
  document.getElementById(id)?.addEventListener('change',()=>{
    saveBookingFilters();
    renderBookings();
  });
});

document.getElementById('clearBookingFiltersBtn')?.addEventListener('click',()=>{
  localStorage.removeItem(BOOKING_FILTERS_KEY);
  document.getElementById('bookingFilter').value='all';
  document.getElementById('bookingCityFilter').value='all';
  document.getElementById('bookingDateFilter').value='';
  renderBookings();
}, true);

// Preserve scroll position before opening an order.
const BOOKING_SCROLL_KEY = 'rentall_supplier_booking_scroll';
document.addEventListener('click',e=>{
  const btn=e.target.closest('[data-view-order]');
  if(btn){
    sessionStorage.setItem(BOOKING_SCROLL_KEY, String(window.scrollY));
    saveBookingFilters();
  }
});

// When order view closes, restore the same filtered list and approximate scroll position.
const originalCloseSupplierOrder = closeSupplierOrder;
closeSupplierOrder = function(){
  originalCloseSupplierOrder();
  loadBookingFilters();
  renderBookings();

  const savedScroll = Number(sessionStorage.getItem(BOOKING_SCROLL_KEY) || 0);
  if(savedScroll){
    setTimeout(()=>window.scrollTo({top:savedScroll,behavior:'smooth'}),50);
  }
};

// Initial restore after all booking controls are available.
loadBookingFilters();
renderBookings();


// --- V23: supplier-scoped booking filter persistence ---
function supplierFilterStorageKey(){
  const s = currentSupplier?.();
  const identity = s?.email || s?.businessName || 'anonymous';
  return `rentall_supplier_booking_filters:${identity}`;
}

function supplierScrollStorageKey(){
  const s = currentSupplier?.();
  const identity = s?.email || s?.businessName || 'anonymous';
  return `rentall_supplier_booking_scroll:${identity}`;
}

saveBookingFilters = function(){
  const state = {
    status: document.getElementById('bookingFilter')?.value || 'all',
    city: document.getElementById('bookingCityFilter')?.value || 'all',
    date: document.getElementById('bookingDateFilter')?.value || ''
  };
  localStorage.setItem(supplierFilterStorageKey(), JSON.stringify(state));
};

loadBookingFilters = function(){
  let state = null;
  try{
    state = JSON.parse(localStorage.getItem(supplierFilterStorageKey()) || 'null');
  }catch{}

  const statusEl = document.getElementById('bookingFilter');
  const cityEl = document.getElementById('bookingCityFilter');
  const dateEl = document.getElementById('bookingDateFilter');

  if(!state){
    if(statusEl) statusEl.value='all';
    populateBookingCityFilter();
    if(cityEl) cityEl.value='all';
    if(dateEl) dateEl.value='';
    return;
  }

  if(statusEl) statusEl.value = state.status || 'all';

  populateBookingCityFilter();
  if(cityEl){
    const valid = [...cityEl.options].some(o=>o.value===state.city);
    cityEl.value = valid ? state.city : 'all';
  }

  if(dateEl) dateEl.value = state.date || '';
};

document.getElementById('clearBookingFiltersBtn')?.addEventListener('click',()=>{
  localStorage.removeItem(supplierFilterStorageKey());
  document.getElementById('bookingFilter').value='all';
  document.getElementById('bookingCityFilter').value='all';
  document.getElementById('bookingDateFilter').value='';
  renderBookings();
}, true);

document.addEventListener('click',e=>{
  const btn=e.target.closest('[data-view-order]');
  if(btn){
    sessionStorage.setItem(supplierScrollStorageKey(), String(window.scrollY));
    saveBookingFilters();
  }
});

const v23OriginalCloseSupplierOrder = closeSupplierOrder;
closeSupplierOrder = function(){
  v23OriginalCloseSupplierOrder();
  loadBookingFilters();
  renderBookings();

  const savedScroll = Number(sessionStorage.getItem(supplierScrollStorageKey()) || 0);
  if(savedScroll){
    setTimeout(()=>window.scrollTo({top:savedScroll,behavior:'smooth'}),50);
  }
};

// Restore the correct supplier's state after login/logout/account switch.
const v23OriginalRefreshAuthUI = refreshAuthUI;
refreshAuthUI = function(){
  v23OriginalRefreshAuthUI();
  if(currentSupplier?.()){
    setTimeout(()=>{
      loadBookingFilters();
      renderBookings();
    },0);
  }
};

loadBookingFilters();
renderBookings();


// --- V24: real quantity-aware availability + anti-double-booking ---
let activeAvailabilityListing = null;

async function syncListingsToServer(){
  const user=currentServerUser;
  if(!user || !['supplier','admin'].includes(user.role)) return;
  try{
    const listings=loadUniversalListings().filter(l=>{
      if(user.role==='admin') return true;
      return String(l.ownerEmail||'').toLowerCase()===String(user.email||'').toLowerCase();
    });
    if(!listings.length) return;
    await apiJson('/api/rentals/listings/sync',{
      method:'POST',
      body:JSON.stringify({listings})
    });
  }catch(err){
    console.warn('Listing sync failed', err);
  }
}

async function fetchAvailability(listingId,startDate,endDate,quantity=1){
  return apiJson(`/api/rentals/availability?listingId=${encodeURIComponent(listingId)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&quantity=${encodeURIComponent(quantity)}`);
}

async function createRealBooking(listingId,startDate,endDate,quantity=1){
  return apiJson('/api/rentals/bookings',bookingRequestOptions(
    {listingId,startDate,endDate,quantity,status:'confirmed'}
  ));
}

function availabilityClass(day){
  return window.rentallAvailabilityClass?.(day)||'free';
}

async function openAvailabilityCalendar(listingId){
  return window.rentallOpenAvailabilityV145?.(listingId);
}

async function renderAvailabilityCalendar(){
  return window.rentallRenderAvailabilityCalendar?.();
}

document.getElementById('refreshAvailabilityBtn')?.addEventListener('click',renderAvailabilityCalendar);
document.getElementById('closeAvailabilityModal')?.addEventListener('click',()=>{
  document.getElementById('availabilityModal').classList.remove('open');
});

const v24PreviousRenderListings = renderUniversalListings;
renderUniversalListings = function(items=loadUniversalListings()){
  v24PreviousRenderListings(items);
  const cards=[...document.querySelectorAll('.listing-card')];
  cards.forEach((card,idx)=>{
    const listing=items[idx];
    if(!listing) return;
    const btn=document.createElement('button');
    btn.className='secondary availability-btn';
    btn.type='button';
    btn.textContent='View availability';
    btn.addEventListener('click',()=>openAvailabilityCalendar(listing.id));
    card.appendChild(btn);
  });
};

// availability check for cards based on current dates/quantity
async function refreshCardAvailability(){
  await syncListingsToServer();
  const ctx=getCurrentSearchContext();
  if(!ctx.from || !ctx.to) return;

  const cards=[...document.querySelectorAll('.listing-card')];
  const listings=loadUniversalListings();

  for(let i=0;i<cards.length;i++){
    const card=cards[i];
    const title=card.querySelector('h4')?.textContent;
    const listing=listings.find(l=>l.title===title);
    if(!listing) continue;

    try{
      const a=await fetchAvailability(listing.id,ctx.from,ctx.to,ctx.qty||1);
      let line=card.querySelector('.live-availability-line');
      if(!line){
        line=document.createElement('div');
        line.className='price-preview-note live-availability-line';
        const box=card.querySelector('.price-preview-box') || card;
        box.appendChild(line);
      }
      line.textContent=a.available
        ? `${a.remainingQuantity} of ${a.totalQuantity} available for selected dates`
        : `Unavailable: only ${a.remainingQuantity} left for selected dates`;
      line.classList.toggle('error',!a.available);
      line.classList.toggle('ok',a.available);
    }catch{}
  }
}

['fromDate','toDate','quantitySearch','tripFromDate','tripToDate','tripQuantity'].forEach(id=>{
  document.getElementById(id)?.addEventListener('change',()=>setTimeout(refreshCardAvailability,50));
});

// Replace prototype final booking with atomic server booking when listing/date context exists.
bookingForm.addEventListener('submit',async(e)=>{
  e.preventDefault();
  e.stopImmediatePropagation();

  const pricing=refreshCheckoutTotals();
  if(!pricing.deliveryRule.eligible) return;

  const listing=activeCheckoutListing || inferCheckoutListing();
  const startDate=document.getElementById('rentalStart').value;
  const endDate=document.getElementById('rentalEnd').value;
  const trip=getTripContext();
  const quantity=Number(trip?.qty || 1);

  if(!listing || !startDate || !endDate){
    return;
  }

  const payBtn=document.getElementById('payBtn');
  const oldText=payBtn.textContent;
  payBtn.disabled=true;
  payBtn.textContent='Checking availability…';

  try{
    await syncListingsToServer();
    const result=await createRealBooking(listing.id,startDate,endDate,quantity);

    const code=result.booking?.bookingId || ('RB-'+Date.now());
    document.getElementById('bookingCode').textContent=code;
    renderReview();
    document.getElementById('successSummary').innerHTML=document.getElementById('reviewCard').innerHTML +
      `<div class="review-row"><span>Remaining quantity after booking</span><b>${result.availabilityAfter?.remainingQuantity ?? '—'}</b></div>`;
    bookingForm.style.display='none';
    successPanel.classList.add('show');
    cart=[];
    renderCart();
    await refreshCardAvailability();
  }catch(err){
    const note=document.getElementById('deliveryRuleNote');
    if(note){
      note.textContent=err.message || 'Selected quantity is no longer available.';
      note.className='delivery-rule-note error';
    }
  }finally{
    payBtn.disabled=false;
    payBtn.textContent=oldText;
  }
}, true);

syncListingsToServer().then(()=>refreshCardAvailability());


// --- V25: supplier inventory calendar + cancellation / return lifecycle ---

function supplierOwnedListings(){
  const supplier=currentSupplier?.();
  const email=supplier?.email || '';
  const all=loadUniversalListings();
  const owned=all.filter(l=>!email || !l.ownerEmail || l.ownerEmail===email);
  return owned.length ? owned : all;
}

function initSupplierCalendarDates(){
  const fromEl=document.getElementById('supplierCalendarFrom');
  const toEl=document.getElementById('supplierCalendarTo');
  if(!fromEl||!toEl) return;
  if(!fromEl.value){
    const today=new Date();
    fromEl.value=today.toISOString().slice(0,10);
    const end=new Date(today);
    end.setDate(end.getDate()+28);
    toEl.value=end.toISOString().slice(0,10);
  }
}

function populateSupplierCalendarListings(){
  const select=document.getElementById('supplierCalendarListing');
  if(!select) return;
  const current=select.value;
  const listings=supplierOwnedListings();
  select.innerHTML=listings.map(l=>`<option value="${escapeHtml(l.id)}">${escapeHtml(l.title)} · ${Number(l.quantity||0)} total</option>`).join('');
  if(listings.some(l=>String(l.id)===String(current))) select.value=current;
}

async function renderSupplierAvailability(){
  const grid=document.getElementById('supplierCalendarGrid');
  const summary=document.getElementById('supplierCalendarSummary');
  const listingId=document.getElementById('supplierCalendarListing')?.value;
  const from=document.getElementById('supplierCalendarFrom')?.value;
  const to=document.getElementById('supplierCalendarTo')?.value;
  if(!grid||!listingId||!from||!to) return;

  grid.innerHTML='<div>Loading…</div>';
  try{
    await syncListingsToServer();
    const data=await apiJson(`/api/rentals/calendar?listingId=${encodeURIComponent(listingId)}&fromDate=${encodeURIComponent(from)}&toDate=${encodeURIComponent(to)}`);
    grid.innerHTML=data.days.map(day=>{
      const cls=availabilityClass(day);
      return `<div class="supplier-cal-day ${cls}">
        <b>${day.date}</b>
        <small>Booked: ${day.bookedQuantity}</small>
        <small>Available: ${day.remainingQuantity} / ${day.totalQuantity}</small>
      </div>`;
    }).join('');

    const lowest=data.days.reduce((m,d)=>Math.min(m,d.remainingQuantity),Infinity);
    const total=data.days[0]?.totalQuantity ?? 0;
    summary.textContent=data.days.length
      ? `Total inventory: ${total} · Lowest remaining quantity in selected period: ${lowest}`
      : 'No dates in selected period.';
  }catch(err){
    grid.innerHTML=`<div class="webhook-error">${escapeHtml(err.message||"Unknown error")}</div>`;
    summary.textContent='';
  }
}

function initSupplierAvailability(){
  initSupplierCalendarDates();
  populateSupplierCalendarListings();
  renderSupplierAvailability();
}

['supplierCalendarListing','supplierCalendarFrom','supplierCalendarTo'].forEach(id=>{
  document.getElementById(id)?.addEventListener('change',renderSupplierAvailability);
});
document.getElementById('refreshSupplierAvailabilityBtn')?.addEventListener('click',renderSupplierAvailability);

async function updateBackendBookingStatus(bookingId,status,reason=null){
  return apiJson(`/api/rentals/bookings/${encodeURIComponent(bookingId)}/status`,{
    method:'POST',
    body:JSON.stringify({status,reason})
  });
}

function lifecycleButtonsFor(booking){
  const id=booking.bookingId;
  if(!id) return '';

  if(booking.status==='pending'){
    return `<button class="mini-action accept backend-status-action" data-booking-id="${id}" data-status="confirmed">Confirm</button>
            <button class="mini-action decline backend-status-action" data-booking-id="${id}" data-status="declined">Decline</button>`;
  }
  if(booking.status==='confirmed'){
    return `<button class="mini-action backend-status-action" data-booking-id="${id}" data-status="active">Mark handed over</button>
            <button class="mini-action decline backend-status-action" data-booking-id="${id}" data-status="cancelled">Cancel</button>`;
  }
  if(booking.status==='active'){
    return `<button class="mini-action accept backend-status-action" data-booking-id="${id}" data-status="returned">Mark returned</button>
            <button class="mini-action backend-status-action" data-booking-id="${id}" data-status="completed">Complete</button>`;
  }
  if(booking.status==='returned'){
    return `<button class="mini-action accept backend-status-action" data-booking-id="${id}" data-status="completed">Complete</button>`;
  }
  return '';
}

async function loadBackendSupplierBookings(){
  const supplier=currentSupplier?.();
  const ownerEmail=supplier?.email || '';
  try{
    const data=await apiJson('/api/rentals/bookings');
    return data.bookings || [];
  }catch{
    return [];
  }
}

async function renderBackendBookingLifecycle(){
  const target=document.getElementById('supplierOrderSummary');
  if(!target) return;
}

document.addEventListener('click',async e=>{
  const btn=e.target.closest('.backend-status-action');
  if(!btn) return;

  btn.disabled=true;
  const status=btn.dataset.status;
  let reason=null;
  if(status==='cancelled'){
    reason=window.prompt('Cancellation reason (optional):','') || null;
  }

  try{
    const result=await updateBackendBookingStatus(btn.dataset.bookingId,status,reason);
    await refreshCardAvailability();
    await renderSupplierAvailability();

    const note=btn.closest('.supplier-order-actions') || btn.parentElement;
    if(note){
      const msg=document.createElement('div');
      msg.className='lifecycle-note';
      msg.textContent=`Status updated to ${result.booking.status}. Remaining quantity: ${result.availability?.remainingQuantity ?? '—'}.`;
      note.appendChild(msg);
    }
  }catch(err){
    alert(err.message);
  }finally{
    btn.disabled=false;
  }
});

const v25OriginalRefreshAuthUI=refreshAuthUI;
refreshAuthUI=function(){
  v25OriginalRefreshAuthUI();
  if(currentSupplier?.()){
    setTimeout(initSupplierAvailability,0);
  }
};

window.addEventListener('load',()=>setTimeout(initSupplierAvailability,100));


// Add real backend booking lifecycle panel to supplier modal when available.
const v25OriginalOpenSupplierOrder=openSupplierOrder;
openSupplierOrder=async function(bookingId){
  v25OriginalOpenSupplierOrder(bookingId);

  const supplier=currentSupplier?.();
  const ownerEmail=supplier?.email || '';
  try{
    const data=await apiJson('/api/rentals/bookings');
    const real=(data.bookings||[]).find(b=>String(b.bookingId)===String(bookingId));
    if(!real) return;

    const actions=document.getElementById('supplierOrderActions');
    actions.innerHTML=`
      <div>
        <b>Inventory booking status: ${real.status}</b>
        <div class="lifecycle-actions">${lifecycleButtonsFor(real)}</div>
      </div>`;
  }catch{}
};


// --- V26: live customer booking data -> supplier order list ---
createRealBooking = async function(listingId,startDate,endDate,quantity=1,extra={}){
  return apiJson('/api/rentals/bookings',{
    method:'POST',
    body:JSON.stringify({
      listingId,startDate,endDate,quantity,
      status:'pending',
      ...extra
    })
  });
};

// Final checkout handler with delivery/customer metadata.
bookingForm.addEventListener('submit',async(e)=>{
  e.preventDefault();
  e.stopImmediatePropagation();

  const pricing=refreshCheckoutTotals();
  if(!pricing.deliveryRule.eligible) return;

  const listing=activeCheckoutListing || inferCheckoutListing();
  const startDate=document.getElementById('rentalStart').value;
  const endDate=document.getElementById('rentalEnd').value;
  const trip=getTripContext();
  const quantity=Number(trip?.qty || 1);
  const delivery=getDeliveryFormData();

  if(!listing || !startDate || !endDate) return;

  const payBtn=document.getElementById('payBtn');
  const oldText=payBtn.textContent;
  payBtn.disabled=true;
  payBtn.textContent='Checking availability…';

  const customerName =
    document.getElementById('customerName')?.value?.trim() ||
    delivery.bookingName || '';
  const customerEmail =
    document.getElementById('email')?.value?.trim() || '';
  const customerPhone =
    document.getElementById('phone')?.value?.trim() || '';

  try{
    await syncListingsToServer();
    const result=await createRealBooking(listing.id,startDate,endDate,quantity,{
      customerName,
      customerEmail,
      customerPhone,
      accommodationName:delivery.accommodationName,
      deliveryCity:document.getElementById('deliveryArea')?.value?.trim() || '',
      deliveryAddress:delivery.address,
      roomNumber:delivery.roomNumber,
      contactPerson:delivery.bookingName || customerName,
      deliveryInstructions:delivery.instructions,
      orderValue:pricing.total
    });

    const code=result.booking?.bookingId || ('RB-'+Date.now());
    document.getElementById('bookingCode').textContent=code;
    renderReview();
    document.getElementById('successSummary').innerHTML=
      document.getElementById('reviewCard').innerHTML +
      `<div class="review-row"><span>Booking status</span><b>Pending supplier confirmation</b></div>` +
      `<div class="review-row"><span>Remaining quantity</span><b>${result.availabilityAfter?.remainingQuantity ?? '—'}</b></div>`;

    bookingForm.style.display='none';
    successPanel.classList.add('show');
    cart=[];
    renderCart();
    await refreshCardAvailability();
  }catch(err){
    const note=document.getElementById('deliveryRuleNote');
    if(note){
      note.textContent=err.message || 'Selected quantity is no longer available.';
      note.className='delivery-rule-note error';
    }
  }finally{
    payBtn.disabled=false;
    payBtn.textContent=oldText;
  }
}, true);

let liveSupplierBookings=[];

async function refreshLiveSupplierBookings(){
  const supplier=currentSupplier?.();
  const ownerEmail=supplier?.email || '';
  try{
    const data=await apiJson('/api/rentals/bookings');
    liveSupplierBookings=data.bookings||[];
  }catch{
    liveSupplierBookings=[];
  }
  return liveSupplierBookings;
}

function populateBookingCityFilter(){
  const select=document.getElementById('bookingCityFilter');
  if(!select) return;
  const current=select.value||'all';
  const cities=[...new Set(liveSupplierBookings.map(b=>b.deliveryCity).filter(Boolean))].sort();
  select.innerHTML='<option value="all">All cities</option>'+
    cities.map(c=>`<option value="${c}">${c}</option>`).join('');
  if(cities.includes(current)) select.value=current;
};

function liveFilteredBookings(){
  const status=document.getElementById('bookingFilter')?.value||'all';
  const city=document.getElementById('bookingCityFilter')?.value||'all';
  const date=document.getElementById('bookingDateFilter')?.value||'';

  return liveSupplierBookings.filter(b=>{
    if(status!=='all' && b.status!==status) return false;
    if(city!=='all' && b.deliveryCity!==city) return false;
    if(date && b.startDate!==date) return false;
    return true;
  });
}

renderBookings=async function(){
  await refreshLiveSupplierBookings();
  populateBookingCityFilter();

  const filtered=liveFilteredBookings();
  const rows=filtered.map(b=>`
    <tr>
      <td><b>${b.customerName||b.contactPerson||'Customer'}</b></td>
      <td>${b.title||'Rental item'} × ${b.quantity}</td>
      <td class="hotel-cell">
        <b>${b.accommodationName||'—'}</b>
        <small>${b.deliveryAddress||''}</small>
      </td>
      <td>${b.deliveryCity||'—'}</td>
      <td class="date-cell">${b.startDate||'—'}</td>
      <td class="contact-cell">${b.contactPerson||b.customerName||'—'}</td>
      <td><span class="status ${b.status}">${b.status}</span></td>
      <td><button class="view-order-btn" data-live-view-order="${b.bookingId}">View</button></td>
    </tr>`).join('');

  document.getElementById('bookingTableBody').innerHTML=
    rows || `<tr><td colspan="8">No live bookings match the selected filters.</td></tr>`;

  const summary=document.getElementById('bookingFilterSummary');
  if(summary) summary.textContent=`Showing ${filtered.length} of ${liveSupplierBookings.length} live bookings`;

  document.querySelectorAll('[data-live-view-order]').forEach(btn=>{
    btn.addEventListener('click',()=>openLiveSupplierOrder(btn.dataset.liveViewOrder));
  });
};

function liveOrderActions(b){
  return lifecycleButtonsFor(b);
}

function openLiveSupplierOrder(bookingId){
  const b=liveSupplierBookings.find(x=>String(x.bookingId)===String(bookingId));
  if(!b) return;

  document.getElementById('supplierOrderTitle').textContent=`${b.title||'Rental item'} · ${b.customerName||'Customer'}`;
  document.getElementById('supplierOrderSummary').innerHTML=`
    <div class="supplier-order-card">
      <h3>Booking</h3>
      <div class="supplier-order-grid">
        <div><span>Booking ID</span><b>${b.bookingId}</b></div>
        <div><span>Status</span><b>${b.status}</b></div>
        <div><span>Rental dates</span><b>${b.startDate} → ${b.endDate}</b></div>
        <div><span>Quantity</span><b>${b.quantity}</b></div>
        <div><span>Order value</span><b>${b.orderValue!=null?money(b.orderValue):'—'}</b></div>
        <div><span>Customer</span><b>${b.customerName||'—'}</b></div>
      </div>
    </div>
    <div class="supplier-order-card">
      <h3>Delivery details</h3>
      <div class="supplier-order-grid">
        <div><span>Hotel / apartment</span><b>${b.accommodationName||'—'}</b></div>
        <div><span>City</span><b>${b.deliveryCity||'—'}</b></div>
        <div><span>Address</span><b>${b.deliveryAddress||'—'}</b></div>
        <div><span>Room / apartment</span><b>${b.roomNumber||'Not provided'}</b></div>
        <div><span>Contact person</span><b>${b.contactPerson||b.customerName||'—'}</b></div>
        <div><span>Phone</span><b>${b.customerPhone||'—'}</b></div>
        <div class="supplier-order-instructions"><span>Delivery instructions</span><b>${b.deliveryInstructions||'No special instructions'}</b></div>
      </div>
    </div>`;

  const actions=document.getElementById('supplierOrderActions');
  actions.innerHTML=`
    <div>
      <div class="lifecycle-actions">${liveOrderActions(b)}</div>
      <div class="lifecycle-note">Only valid next statuses are shown. Cancelled/declined/returned/completed bookings release inventory.</div>
    </div>`;

  document.querySelectorAll('.backend-status-action').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      btn.disabled=true;
      const status=btn.dataset.status;
      let reason=null;
      if(status==='cancelled') reason=window.prompt('Cancellation reason (optional):','')||null;
      try{
        await updateBackendBookingStatus(btn.dataset.bookingId,status,reason);
        await refreshLiveSupplierBookings();
        await renderBookings();
        await renderSupplierAvailability();
        openLiveSupplierOrder(btn.dataset.bookingId);
      }catch(err){
        alert(err.message);
      }finally{
        btn.disabled=false;
      }
    });
  });

  const modal=document.getElementById('supplierOrderModal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');
}

['bookingFilter','bookingCityFilter','bookingDateFilter'].forEach(id=>{
  document.getElementById(id)?.addEventListener('change',()=>{
    saveBookingFilters();
    renderBookings();
  });
});

document.getElementById('clearBookingFiltersBtn')?.addEventListener('click',()=>{
  localStorage.removeItem(supplierFilterStorageKey());
  document.getElementById('bookingFilter').value='all';
  document.getElementById('bookingCityFilter').value='all';
  document.getElementById('bookingDateFilter').value='';
  renderBookings();
}, true);

const v26RefreshAuthUI=refreshAuthUI;
refreshAuthUI=function(){
  v26RefreshAuthUI();
  if(currentSupplier?.()){
    setTimeout(async()=>{
      loadBookingFilters();
      await renderBookings();
      initSupplierAvailability();
    },0);
  }
};

setTimeout(()=>renderBookings(),150);


// --- V27: cancellation policies, returns, listing details and reviews ---

function cancellationPolicyText(policy){
  if(policy==='flexible') return 'Flexible: full refund ≥24h before start; 50% within 24h.';
  if(policy==='strict') return 'Strict: 50% refund ≥7 days before start; otherwise non-refundable.';
  return 'Moderate: full refund ≥72h; 50% refund 24–72h; otherwise non-refundable.';
}

// Capture cancellation policy in newly created/edited listings.
document.getElementById('listingForm')?.addEventListener('submit',()=>{
  const cancellationPolicy=document.getElementById('listingCancellationPolicy')?.value || 'moderate';
  setTimeout(()=>{
    const listings=loadUniversalListings();
    const latest=listings[0];
    if(latest){
      latest.cancellationPolicy=cancellationPolicy;
      localStorage.setItem('rentall_listings',JSON.stringify(listings));
    }
  },20);
}, true);

async function openListingDetail(listingId){
  const listing=loadUniversalListings().find(l=>String(l.id)===String(listingId)); if(!listing) return;
  let reviewData={reviews:[],summary:{reviewCount:0,averageRating:null}};
  try{reviewData=await apiJson(`/api/rentals/reviews?listingId=${encodeURIComponent(listingId)}`)}catch{}
  const ctx=getCurrentSearchContext(),preview=calculateListingPreview(listing,ctx);
  const rating=reviewData.summary?.averageRating,reviewCount=reviewData.summary?.reviewCount||0;
  const location=[listing.city,listing.country].filter(Boolean).join(', ');
  const fulfillment=[listing.pickupEnabled!==false?'Pickup':null,listing.deliveryEnabled?'Delivery':null].filter(Boolean);
  const quantity=Math.max(1,Number(ctx.qty||1)),dateReady=Boolean(ctx.from&&ctx.to);
  const dateLabel=dateReady?`${escapeHtml(ctx.from)} → ${escapeHtml(ctx.to)}`:'Choose rental dates';
  const supplierName=listing.ownerName||listing.company||'Verified RentAll supplier';
  document.getElementById('listingDetailContent').innerHTML=`
    <div class="v92-listing-layout">
      <div class="v92-listing-main">
        <div class="v92-photo-stage" aria-label="${escapeHtml(listing.title)}"><div class="v92-photo-icon">${listing.category==='Photo & video'?'📷':listing.category==='Furniture'?'🪑':listing.category==='Tools & equipment'?'🛠️':listing.category==='Transport'?'🚲':'📦'}</div><span class="v92-availability-pill">● Live availability</span></div>
        <div class="eyebrow">${escapeHtml(listing.category||'Rental item')}</div>
        <h2>${escapeHtml(listing.title)}</h2>
        <div class="v92-listing-subline"><b>${rating?`★ ${Number(rating).toFixed(1)} · ${reviewCount} review${reviewCount===1?'':'s'}`:'New listing'}</b><span>•</span><span>${escapeHtml(location||'Location shown after booking')}</span></div>
        <p class="v92-description">${escapeHtml(listing.description||'Rental listing')}</p>
        <div class="v92-trust-row" aria-label="Rental protections"><div><b>✓ Secure booking</b><span>Protected checkout</span></div><div><b>✓ Verified supplier</b><span>${escapeHtml(supplierName)}</span></div><div><b>✓ Clear cancellation</b><span>${escapeHtml((listing.cancellationPolicy||'moderate').toUpperCase())}</span></div></div>
        <div class="v92-facts"><div><span>Available</span><b>${Number(listing.quantity||1)} unit${Number(listing.quantity||1)===1?'':'s'}</b></div><div><span>Fulfilment</span><b>${escapeHtml(fulfillment.join(' + ')||'Pickup')}</b></div><div><span>Deposit</span><b>${listing.deposit?`€${Number(listing.deposit).toFixed(2)}`:'No deposit'}</b></div><div><span>Cancellation</span><b>${escapeHtml(listing.cancellationPolicy||'Moderate')}</b></div></div>
        <section class="v92-reviews"><div class="v92-section-head"><h3>Reviews</h3><span>${rating?`★ ${Number(rating).toFixed(1)}`:'Not rated yet'}</span></div><div class="listing-review-list">${reviewData.reviews?.length?reviewData.reviews.slice(0,4).map(r=>`<div class="listing-review"><b>${'★'.repeat(Math.max(0,Math.min(5,Number(r.rating)||0)))} · ${escapeHtml(r.customerName||'Customer')}</b><p>${escapeHtml(r.comment||'')}</p></div>`).join(''):'<p class="muted">No reviews yet. Be the first renter to review this item.</p>'}</div></section>
      </div>
      <aside class="v92-booking-card" aria-label="Booking summary">
        <div class="v92-price"><b>€${Number(listing.priceDay||0).toFixed(2)}</b><span> / day</span></div>${listing.priceWeek?`<p class="v92-weekly">Weekly rate €${Number(listing.priceWeek).toFixed(2)}</p>`:''}
        <button class="v92-selection" id="detailAvailabilityBtn" type="button"><span><small>DATES</small><b>${dateLabel}</b></span><span>›</span></button>
        <div class="v92-selection v92-static"><span><small>QUANTITY</small><b>${quantity}</b></span></div>
        <div class="v92-estimate"><span>${dateReady?'Estimated rental total':'Estimated from current search'}</span><b>€${Number(preview.total||0).toFixed(2)}</b></div>
        <button class="primary v92-rent-cta" type="button" id="detailRentBtn">${dateReady?'Check availability & continue':'Choose dates'}</button>
        <p class="v92-nocharge">You won’t be charged yet.</p><div class="v92-safe-note">🔒 Secure booking · Supplier confirmation · Cancellation policy shown before payment</div>
      </aside>
    </div>`;
  const proceed=()=>{const modal=document.getElementById('listingDetailModal');modal.classList.remove('open');modal.setAttribute('aria-hidden','true');openAvailabilityCalendar(listing.id)};
  document.getElementById('detailAvailabilityBtn')?.addEventListener('click',proceed);document.getElementById('detailRentBtn')?.addEventListener('click',proceed);
  const modal=document.getElementById('listingDetailModal');modal.classList.add('open');modal.setAttribute('aria-hidden','false');setTimeout(()=>document.getElementById('detailRentBtn')?.focus(),0);
}
document.getElementById('closeListingDetailModal')?.addEventListener('click',()=>{const modal=document.getElementById('listingDetailModal');modal.classList.remove('open');modal.setAttribute('aria-hidden','true')});

const v27RenderListings=renderUniversalListings;
renderUniversalListings=function(items=loadUniversalListings()){
  v27RenderListings(items);
  const cards=[...document.querySelectorAll('.listing-card')];
  cards.forEach((card,idx)=>{
    const listing=items[idx];
    if(!listing) return;
    if(card.querySelector('.detail-btn')) return;
    const btn=document.createElement('button');
    btn.className='secondary detail-btn';
    btn.type='button';
    btn.textContent='View details';
    btn.addEventListener('click',()=>openListingDetail(listing.id));
    card.appendChild(btn);

    const policy=document.createElement('div');
    policy.className='price-preview-note';
    policy.textContent=cancellationPolicyText(listing.cancellationPolicy||'moderate');
    card.appendChild(policy);
  });
};

async function cancelLiveBooking(bookingId){
  const reason=window.prompt('Cancellation reason (optional):','')||null;
  return apiJson(`/api/rentals/bookings/${encodeURIComponent(bookingId)}/cancel`,{
    method:'POST',
    body:JSON.stringify({reason})
  });
}

async function returnLiveBooking(bookingId){
  const condition=window.prompt('Return condition: good / damaged / missing parts','good')||'good';
  const notes=window.prompt('Return notes (optional):','')||null;
  return apiJson(`/api/rentals/bookings/${encodeURIComponent(bookingId)}/return`,{
    method:'POST',
    body:JSON.stringify({condition,notes})
  });
}

// Enrich lifecycle actions.
lifecycleButtonsFor=function(booking){
  const id=booking.bookingId;
  if(!id) return '';

  if(booking.status==='pending'){
    return `<button class="mini-action accept backend-status-action" data-booking-id="${id}" data-status="confirmed">Confirm</button>
            <button class="mini-action decline backend-status-action" data-booking-id="${id}" data-status="declined">Decline</button>
            <button class="mini-action decline cancel-booking-action" data-booking-id="${id}">Cancel + refund</button>`;
  }
  if(booking.status==='confirmed'){
    return `<button class="mini-action backend-status-action" data-booking-id="${id}" data-status="active">Mark handed over</button>
            <button class="mini-action decline cancel-booking-action" data-booking-id="${id}">Cancel + refund</button>`;
  }
  if(booking.status==='active'){
    return `<button class="mini-action accept return-booking-action" data-booking-id="${id}">Mark returned</button>
            <button class="mini-action backend-status-action" data-booking-id="${id}" data-status="completed">Complete</button>`;
  }
  if(booking.status==='returned'){
    return `<button class="mini-action accept backend-status-action" data-booking-id="${id}" data-status="completed">Complete</button>`;
  }
  return '';
};

document.addEventListener('click',async e=>{
  const cancelBtn=e.target.closest('.cancel-booking-action');
  if(cancelBtn){
    cancelBtn.disabled=true;
    try{
      const result=await cancelLiveBooking(cancelBtn.dataset.bookingId);
      alert(`Booking cancelled. Refund: ${money(result.refundAmount||0)}. Policy: ${result.cancellationPolicy}.`);
      await refreshLiveSupplierBookings();
      await renderBookings();
      await renderSupplierAvailability();
    }catch(err){ alert(err.message); }
    finally{ cancelBtn.disabled=false; }
    return;
  }

  const returnBtn=e.target.closest('.return-booking-action');
  if(returnBtn){
    returnBtn.disabled=true;
    try{
      await returnLiveBooking(returnBtn.dataset.bookingId);
      await refreshLiveSupplierBookings();
      await renderBookings();
      await renderSupplierAvailability();
      openLiveSupplierOrder(returnBtn.dataset.bookingId);
    }catch(err){ alert(err.message); }
    finally{returnBtn.disabled=false;}
  }
});

// Add return/refund details into supplier order view by wrapping it.
const v27OpenLiveSupplierOrder=openLiveSupplierOrder;
openLiveSupplierOrder=function(bookingId){
  v27OpenLiveSupplierOrder(bookingId);
  const b=liveSupplierBookings.find(x=>String(x.bookingId)===String(bookingId));
  if(!b) return;
  const summary=document.getElementById('supplierOrderSummary');
  if(!summary) return;

  const extra=document.createElement('div');
  extra.className='supplier-order-card';
  extra.innerHTML=`
    <h3>Policy & return</h3>
    <div class="supplier-order-grid">
      <div><span>Refund amount</span><b>${b.refundAmount!=null?money(b.refundAmount):'—'}</b></div>
      <div><span>Return condition</span><b>${b.returnCondition||'—'}</b></div>
      <div class="supplier-order-instructions"><span>Return notes</span><b>${b.returnNotes||'—'}</b></div>
    </div>`;
  summary.appendChild(extra);
};

// Review modal API.
function openReviewModal(bookingId){
  document.getElementById('reviewBookingId').value=bookingId;
  document.getElementById('reviewModal').classList.add('open');
}
document.getElementById('closeReviewModal')?.addEventListener('click',()=>{
  const modal=document.getElementById('reviewModal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden','true');
});

document.getElementById('reviewForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  try{
    await apiJson('/api/rentals/reviews',{
      method:'POST',
      body:JSON.stringify({
        bookingId:document.getElementById('reviewBookingId').value,
        rating:Number(document.getElementById('reviewRating').value),
        comment:document.getElementById('reviewComment').value.trim()
      })
    });
    document.getElementById('reviewModal').classList.remove('open');
    alert('Review submitted.');
  }catch(err){
    alert(err.message);
  }
});

setTimeout(()=>renderUniversalListings(),120);


// --- V28: platform admin / moderation / disputes ---
async function loadAdminDashboard(){
  const data=await apiJson('/api/admin/dashboard');
  document.getElementById('adminKpiListings').textContent=data.kpis.listings;
  document.getElementById('adminKpiActiveListings').textContent=data.kpis.activeListings;
  document.getElementById('adminKpiBookings').textContent=data.kpis.bookings;
  document.getElementById('adminKpiDisputes').textContent=data.kpis.openDisputes;
  document.getElementById('adminKpiGmv').textContent=money(data.kpis.gmv);

  document.getElementById('adminListingsBody').innerHTML=data.listings.map(l=>`
    <tr>
      <td><b>${l.title}</b><small>${l.listingId}</small></td>
      <td>${l.ownerEmail||'—'}</td>
      <td><span class="status ${l.moderationStatus}">${l.moderationStatus}</span></td>
      <td>
        <div class="moderation-actions">
          <button class="mini-action admin-listing-status" data-id="${l.listingId}" data-status="active">Activate</button>
          <button class="mini-action admin-listing-status" data-id="${l.listingId}" data-status="paused">Pause</button>
          <button class="mini-action decline admin-listing-status" data-id="${l.listingId}" data-status="blocked">Block</button>
        </div>
      </td>
    </tr>`).join('') || '<tr><td colspan="4">No listings.</td></tr>';

  document.getElementById('adminDisputesBody').innerHTML=data.disputes.map(d=>`
    <tr>
      <td>${d.disputeId}</td>
      <td>${d.bookingId}</td>
      <td><b>${d.reason}</b><small>${d.details||''}</small></td>
      <td>${d.status}</td>
      <td>${d.status==='open'?`<button class="mini-action accept resolve-dispute-btn" data-id="${d.disputeId}">Resolve</button>`:'—'}</td>
    </tr>`).join('') || '<tr><td colspan="5">No disputes.</td></tr>';

  document.querySelectorAll('.admin-listing-status').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      const reason=btn.dataset.status==='blocked' ? (prompt('Reason for blocking:','')||null) : null;
      await apiJson(`/api/admin/listings/${encodeURIComponent(btn.dataset.id)}/moderation`,{
        method:'POST',body:JSON.stringify({status:btn.dataset.status,reason})
      });
      await loadAdminDashboard();
    });
  });

  document.querySelectorAll('.resolve-dispute-btn').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      const resolution=prompt('Resolution:','Resolved by admin')||'Resolved';
      await apiJson(`/api/admin/disputes/${encodeURIComponent(btn.dataset.id)}/resolve`,{
        method:'POST',body:JSON.stringify({resolution})
      });
      await loadAdminDashboard();
    });
  });
}

document.getElementById('refreshAdminBtn')?.addEventListener('click',loadAdminDashboard);

// Supplier can open dispute on live booking.
const v28OpenLiveSupplierOrder=openLiveSupplierOrder;
openLiveSupplierOrder=function(bookingId){
  v28OpenLiveSupplierOrder(bookingId);
  const actions=document.getElementById('supplierOrderActions');
  if(!actions) return;
  const disputeBtn=document.createElement('button');
  disputeBtn.className='secondary';
  disputeBtn.type='button';
  disputeBtn.textContent='Open dispute';
  disputeBtn.addEventListener('click',async()=>{
    const reason=prompt('Dispute reason:','Damage / missing item / payment issue');
    if(!reason) return;
    const details=prompt('Details (optional):','')||null;
    try{
      await apiJson('/api/rentals/disputes',{
        method:'POST',
        body:JSON.stringify({bookingId,openedBy:'supplier',reason,details})
      });
      alert('Dispute opened.');
      loadAdminDashboard();
    }catch(err){ alert(err.message); }
  });
  actions.appendChild(disputeBtn);
};

setTimeout(()=>loadAdminDashboard().catch(()=>{}),250);


// --- V29: customer "My bookings" end-to-end ---

function rememberCustomerEmail(){
  const email=document.getElementById('email')?.value?.trim();
  if(email) localStorage.setItem('rentall_customer_email',email);
}

bookingForm.addEventListener('submit',rememberCustomerEmail,true);

function renderCustomerBookings(bookings=[]){
  const list=document.getElementById('customerBookingsList');
  if(!list) return;
  if(!bookings.length){
    list.innerHTML='<div class="customer-booking-card">No bookings yet.</div>';
    return;
  }
  list.innerHTML=bookings.map(b=>`
    <div class="customer-booking-card">
      <div class="customer-booking-head">
        <div><small>${escapeHtml(b.bookingId||'')}</small><h3>${escapeHtml(b.title||b.listingTitle||'Rental item')} × ${Number(b.quantity||1)}</h3></div>
        <span class="status ${escapeHtml(b.status||'pending')}">${escapeHtml(b.status||'pending')}</span>
      </div>
      <div class="customer-booking-grid">
        <div><span>Rental dates</span><b>${escapeHtml(b.startDate||'—')} → ${escapeHtml(b.endDate||'—')}</b></div>
        <div><span>Delivery</span><b>${escapeHtml(b.accommodationName||b.deliveryCity||'—')}</b></div>
        <div><span>Total</span><b>${b.orderValue!=null?money(b.orderValue):'—'}</b></div>
        <div><span>Payment</span><b>${escapeHtml(window.customerBookingPaymentCopy(b))}</b></div>
      </div><div class="v127-booking-state"><div><small>Next action</small><strong>${escapeHtml(window.customerBookingNextAction(b))}</strong></div><div><small>Security deposit</small><strong>${escapeHtml(window.customerBookingDepositCopy(b))}</strong></div></div>
    </div>`).join('');
}

async function loadCustomerBookings(){
  const list=document.getElementById('customerBookingsList');
  if(!list) return;

  list.innerHTML='<div class="customer-booking-card">Loading…</div>';

  if(currentServerUser){
    try{
      const data=await apiJson('/api/customer/bookings');
      renderCustomerBookings(data.bookings||[]);
      return data.bookings||[];
    }catch(err){
      list.innerHTML=`<div class="customer-booking-card">${escapeHtml(err.message||'Could not load bookings')}</div>`;
      return [];
    }
  }

  const email=document.getElementById('customerBookingsEmail')?.value?.trim()
    || localStorage.getItem('rentall_customer_email') || '';
  if(!email){
    list.innerHTML='<div class="customer-booking-card">Sign in to see bookings on every device, or enter the email used for a guest booking.</div>';
    return [];
  }

  document.getElementById('customerBookingsEmail').value=email;
  localStorage.setItem('rentall_customer_email',email);

  // Guest history is intentionally not exposed by email alone.
  // Existing access-token links remain the secure way to open guest bookings.
  list.innerHTML='<div class="customer-booking-card">For privacy, guest bookings are opened from their secure booking link. Sign in to keep your full booking history across devices.</div>';
  return [];
}
document.getElementById('loadCustomerBookingsBtn')?.addEventListener('click',loadCustomerBookings);
document.getElementById('refreshCustomerBookingsBtn')?.addEventListener('click',loadCustomerBookings);

const rememberedCustomerEmail=localStorage.getItem('rentall_customer_email');
if(rememberedCustomerEmail && document.getElementById('customerBookingsEmail')){
  document.getElementById('customerBookingsEmail').value=rememberedCustomerEmail;
  setTimeout(()=>loadCustomerBookings(),300);
}

// Refresh customer bookings after review submission.
document.getElementById('reviewForm')?.addEventListener('submit',()=>{
  setTimeout(()=>loadCustomerBookings().catch(()=>{}),150);
});


// --- V30: real listing photo upload + gallery + favorites ---
let pendingListingPhotoUrls=[];

async function fileToDataUrl(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=reject;
    reader.readAsDataURL(file);
  });
}

async function uploadListingPhotos(files){
  const selected=[...files].slice(0,6);
  const urls=[];
  for(const file of selected){
    const dataUrl=await fileToDataUrl(file);
    const result=await apiJson('/api/uploads/image',{
      method:'POST',
      body:JSON.stringify({dataUrl,fileName:file.name})
    });
    urls.push(result.url);
  }
  return urls;
}

document.getElementById('listingPhotos')?.addEventListener('change',async e=>{
  const preview=document.getElementById('listingPhotoPreview');
  preview.innerHTML='<small>Uploading…</small>';
  try{
    pendingListingPhotoUrls=await uploadListingPhotos(e.target.files);
    preview.innerHTML=pendingListingPhotoUrls.map(url=>`<img src="${url}" alt="">`).join('');
  }catch(err){
    pendingListingPhotoUrls=[];
    preview.innerHTML=`<small>${escapeHtml(err.message||'Upload failed')}</small>`;
  }
});

document.getElementById('listingForm')?.addEventListener('submit',()=>{
  setTimeout(()=>{
    if(!pendingListingPhotoUrls.length) return;
    const listings=loadUniversalListings();
    const latest=listings[0];
    if(!latest) return;
    latest.photos=[...pendingListingPhotoUrls];
    latest.coverPhoto=pendingListingPhotoUrls[0];
    localStorage.setItem('rentall_listings',JSON.stringify(listings));
    pendingListingPhotoUrls=[];
    const input=document.getElementById('listingPhotos');
    if(input) input.value='';
    const preview=document.getElementById('listingPhotoPreview');
    if(preview) preview.innerHTML='';
    renderUniversalListings();
  },80);
}, true);

function favoriteIds(){
  try{return JSON.parse(localStorage.getItem('rentall_favorites')||'[]');}
  catch{return [];}
}
function isFavorite(id){ return favoriteIds().map(String).includes(String(id)); }
function toggleFavorite(id){
  let ids=favoriteIds().map(String);
  const sid=String(id);
  ids=ids.includes(sid)?ids.filter(x=>x!==sid):[...ids,sid];
  localStorage.setItem('rentall_favorites',JSON.stringify(ids));
  return ids.includes(sid);
}

const v30RenderListings=renderUniversalListings;
renderUniversalListings=function(items=loadUniversalListings()){
  v30RenderListings(items);
  const cards=[...document.querySelectorAll('.listing-card')];
  cards.forEach((card,idx)=>{
    const listing=items[idx];
    if(!listing) return;

    if(listing.coverPhoto && !card.querySelector('.listing-card-cover')){
      const img=document.createElement('img');
      img.className='listing-card-cover';
      img.src=listing.coverPhoto;
      img.alt=listing.title;
      card.prepend(img);
    }

    if(!card.querySelector('.favorite-btn')){
      const fav=document.createElement('button');
      fav.type='button';
      fav.className='favorite-btn'+(isFavorite(listing.id)?' active':'');
      fav.textContent=isFavorite(listing.id)?'♥':'♡';
      fav.title='Save to favorites';
      fav.addEventListener('click',()=>{
        const active=toggleFavorite(listing.id);
        fav.classList.toggle('active',active);
        fav.textContent=active?'♥':'♡';
      });
      card.appendChild(fav);
    }
  });
};

const v30OpenListingDetail=openListingDetail;
openListingDetail=async function(listingId){
  await v30OpenListingDetail(listingId);
  const listing=loadUniversalListings().find(l=>String(l.id)===String(listingId));
  if(!listing?.photos?.length) return;

  const content=document.getElementById('listingDetailContent');
  if(!content || content.querySelector('.listing-detail-gallery')) return;

  const gallery=document.createElement('div');
  gallery.className='listing-detail-gallery';
  gallery.innerHTML=listing.photos
    .map(url=>safeImageUrl(url))
    .filter(Boolean)
    .map(url=>`<img src="${escapeHtml(url)}" alt="${escapeHtml(listing.title)}" loading="lazy" decoding="async">`)
    .join('');
  content.prepend(gallery);
};

setTimeout(()=>renderUniversalListings(),150);


// --- V31: server-backed authentication and listing persistence ---
let serverUser=null;
// Canonical account alias used by later customer/search/booking features.
// Keep it synchronized with serverUser to avoid cross-version runtime regressions.

async function refreshServerUser(){
  try{
    const data=await apiJson('/api/auth/me');
    serverUser=data.user||null;
  }catch{
    serverUser=null;
  }
  currentServerUser=serverUser;

  document.body.classList.toggle('is-admin',serverUser?.role==='admin');

  if(serverUser){
    localStorage.setItem('rentall_server_user',JSON.stringify(serverUser));
  }else{
    localStorage.removeItem('rentall_server_user');
  }

  return serverUser;
}

currentSupplier=function(){
  if(serverUser && ['supplier','admin'].includes(serverUser.role)){
    return {
      id:serverUser.userId,
      email:serverUser.email,
      businessName:serverUser.businessName||serverUser.displayName||'Supplier',
      contactName:serverUser.displayName||'',
      country:serverUser.country||'LT',
      city:serverUser.city||'',
      role:serverUser.role
    };
  }
  try{
    const cached=JSON.parse(localStorage.getItem('rentall_server_user')||'null');
    if(cached && ['supplier','admin'].includes(cached.role)){
      return {
        id:cached.userId,email:cached.email,
        businessName:cached.businessName||cached.displayName||'Supplier',
        contactName:cached.displayName||'',country:cached.country||'LT',
        city:cached.city||'',role:cached.role
      };
    }
  }catch{}
  return null;
};

async function serverLogin(email,password){
  const data=await apiJson('/api/auth/login',{
    method:'POST',
    body:JSON.stringify({email,password})
  });
  serverUser=data.user;
  currentServerUser=serverUser;
  await refreshServerUser();
  refreshAuthUI();
  return data.user;
}

async function serverRegister(payload){
  const data=await apiJson('/api/auth/register',{
    method:'POST',
    body:JSON.stringify(payload)
  });
  serverUser=data.user;
  currentServerUser=serverUser;
  await refreshServerUser();
  refreshAuthUI();
  return data.user;
}

async function serverLogout(){
  try{await apiJson('/api/auth/logout',{method:'POST',body:'{}'});}catch{}
  serverUser=null;
  currentServerUser=null;
  localStorage.removeItem('rentall_server_user');
  refreshAuthUI();
  document.body.classList.remove('is-admin');
}

// Capture existing supplier login form and use backend.
document.getElementById('supplierLoginForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  e.stopImmediatePropagation();
  const email=e.currentTarget.querySelector('input[type="email"]')?.value?.trim()||'';
  const password=e.currentTarget.querySelector('input[type="password"]')?.value||'';
  try{
    await serverLogin(email,password);
    document.getElementById('supplierAuthModal')?.classList.remove('open');
    await hydrateListingsFromServer();
    if(serverUser?.role==='admin') loadAdminDashboard().catch(()=>{});
  }catch(err){
    alert(err.message);
  }
}, true);

// Capture supplier registration.
document.getElementById('supplierRegisterForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  e.stopImmediatePropagation();
  const form=e.currentTarget;
  const inputs=[...form.querySelectorAll('input')];
  const email=form.querySelector('input[type="email"]')?.value?.trim()||'';
  const password=form.querySelector('input[type="password"]')?.value||'';
  const textValues=inputs.filter(i=>i.type==='text').map(i=>i.value.trim()).filter(Boolean);
  try{
    await serverRegister({
      email,password,role:'supplier',
      displayName:textValues[1]||textValues[0]||'Supplier',
      businessName:textValues[0]||'Rental business'
    });
    document.getElementById('supplierAuthModal')?.classList.remove('open');
    await hydrateListingsFromServer();
  }catch(err){alert(err.message);}
}, true);

// Capture logout buttons that exist in the old frontend.
document.addEventListener('click',e=>{
  const target=e.target;
  if(target?.id==='logoutBtn' || target?.dataset?.action==='logout'){
    e.preventDefault();
    e.stopImmediatePropagation();
    serverLogout();
  }
}, true);

async function hydrateListingsFromServer(){
  try{
    const data=await apiJson('/api/listings');
    const listings=purgeLegacyDemoListings(Array.isArray(data.listings)?data.listings:[]);
    // Server inventory is authoritative even when empty: stale demo/local listings must disappear.
    localStorage.setItem('rentall_listings',JSON.stringify(listings));
    if(typeof renderGeoAwareListings==='function') renderGeoAwareListings(listings);
    else renderUniversalListings(listings);
    return listings;
  }catch{
    return loadUniversalListings();
  }
}

async function persistLatestListingToServer(){
  if(!currentSupplier()) return;
  const listings=loadUniversalListings();
  const latest=listings[0];
  if(!latest) return;
  latest.ownerEmail=currentSupplier().email;
  try{
    const result=await apiJson('/api/supplier/listings',{
      method:'POST',
      body:JSON.stringify({listing:latest})
    });
    const idx=listings.findIndex(l=>String(l.id)===String(latest.id));
    if(idx>=0) listings[idx]=result.listing;
    localStorage.setItem('rentall_listings',JSON.stringify(listings));
  }catch(err){
    console.warn('Server listing save failed',err);
  }
}

// Persist listings after existing listing form completes.
document.getElementById('listingForm')?.addEventListener('submit',()=>{
  setTimeout(()=>persistLatestListingToServer(),180);
}, true);

// Enhance auth UI to show role and protect supplier sections.
const v31RefreshAuthUI=refreshAuthUI;
refreshAuthUI=function(){
  v31RefreshAuthUI();
  const supplier=currentSupplier();
  const authBtn=document.getElementById('supplierAuthBtn');
  if(authBtn && supplier){
    const accountName=supplier.businessName||supplier.displayName||supplier.email||'Account';
    authBtn.innerHTML=`${escapeHtml(accountName)} <span class="auth-role-badge">${supplier.role||'supplier'}</span>`;
  }else if(authBtn && serverUser?.role==='customer'){
    const accountName=serverUser.displayName||serverUser.email||'Account';
    authBtn.innerHTML=`${escapeHtml(accountName)} <span class="auth-role-badge">customer</span>`;
    authBtn.onclick=()=>document.getElementById('myBookingsBtn')?.click();
  }else if(authBtn && !serverUser){
    authBtn.textContent='Log in';
    authBtn.onclick=()=>openAuth('login');
  }
  document.body.classList.toggle('is-admin',serverUser?.role==='admin');
};

// Admin loader now only attempts when admin.
const v31LoadAdminDashboard=loadAdminDashboard;
loadAdminDashboard=async function(){
  if(serverUser?.role!=='admin') return;
  return v31LoadAdminDashboard();
};

(async()=>{
  await refreshServerUser();
  await hydrateListingsFromServer();
  refreshAuthUI();
  if(serverUser?.role==='admin') loadAdminDashboard().catch(()=>{});
})();


// --- V32: persistent Stripe Connect + booking PaymentIntent ---
let stripeClient=null;
let stripeElements=null;
let activePaymentToken=null;
let activePaymentBookingId=null;

function loadStripeJs(){
  return new Promise((resolve,reject)=>{
    if(window.Stripe) return resolve();
    const existing=document.querySelector('script[data-rentall-stripe]');
    if(existing){
      existing.addEventListener('load',resolve,{once:true});
      existing.addEventListener('error',reject,{once:true});
      return;
    }
    const s=document.createElement('script');
    s.src='https://js.stripe.com/v3/';
    s.async=true;
    s.dataset.rentallStripe='1';
    s.onload=resolve;
    s.onerror=()=>reject(new Error('Could not load Stripe.js'));
    document.head.appendChild(s);
  });
}

async function prepareStripePayment(bookingId,paymentToken){
  const panel=document.getElementById('securePaymentPanel');
  const message=document.getElementById('securePaymentMessage');
  const state=document.getElementById('stripePaymentState');
  const breakdown=document.getElementById('paymentBreakdown');

  activePaymentBookingId=bookingId;
  activePaymentToken=paymentToken;

  try{
    const config=await apiJson('/api/config');
    if(!config.stripeConfigured || !config.stripePublishableKey){
      panel.hidden=false;
      message.textContent='Booking created. Stripe payment is not configured on this server yet.';
      state.textContent='Payment setup is incomplete. Please contact RentAll support.';
      document.getElementById('confirmStripePaymentBtn').hidden=true;
      return;
    }

    const intent=await apiJson('/api/payments/create-intent',{
      method:'POST',
      body:JSON.stringify({bookingId,paymentToken})
    });

    await loadStripeJs();
    stripeClient=Stripe(config.stripePublishableKey);
    stripeElements=stripeClient.elements({clientSecret:intent.clientSecret});

    const container=document.getElementById('stripePaymentElement');
    container.innerHTML='';
    const paymentElement=stripeElements.create('payment');
    paymentElement.mount('#stripePaymentElement');

    breakdown.innerHTML=`
      <div><span>Customer total</span><b>${money(intent.amount)}</b></div>
      <div><span>Platform fee</span><b>${money(intent.platformFee)}</b></div>
      <div><span>Supplier share</span><b>${money(intent.supplierAmount)}</b></div>`;
    panel.hidden=false;
    message.textContent='Complete payment securely with Stripe.';
    state.textContent='';
    document.getElementById('confirmStripePaymentBtn').hidden=false;
  }catch(err){
    panel.hidden=false;
    message.textContent='Booking created, but payment could not be initialized.';
    state.textContent=err.message;
    document.getElementById('confirmStripePaymentBtn').hidden=true;
  }
}

document.getElementById('confirmStripePaymentBtn')?.addEventListener('click',async()=>{
  if(!stripeClient||!stripeElements) return;
  const btn=document.getElementById('confirmStripePaymentBtn');
  const state=document.getElementById('stripePaymentState');
  btn.disabled=true;
  state.textContent='Processing payment…';

  const {error}=await stripeClient.confirmPayment({
    elements:stripeElements,
    confirmParams:{return_url:window.location.href}
  });

  if(error){
    state.textContent=error.message||'Payment failed.';
    btn.disabled=false;
  }
});

// Attach payment initialization to the latest booking success.
document.addEventListener('rentall:booking-created',e=>{
  const {bookingId,paymentToken}=e.detail||{};
  if(bookingId&&paymentToken) prepareStripePayment(bookingId,paymentToken);
});

// Patch the booking confirmation flow by observing the booking code/data from API.
// We retain the original checkout logic; this wrapper emits the event after the real booking call.
const v32CreateRealBooking=createRealBooking;
createRealBooking=async function(listingId,startDate,endDate,quantity=1,extra={}){
  const result=await v32CreateRealBooking(listingId,startDate,endDate,quantity,extra);
  setTimeout(()=>{
    document.dispatchEvent(new CustomEvent('rentall:booking-created',{
      detail:{bookingId:result.booking?.bookingId,paymentToken:result.paymentToken}
    }));
  },0);
  return result;
};


// --- V33 authoritative checkout ---
// Earlier MVP iterations registered multiple listeners on the same form.
// Replace the interactive checkout nodes with clean clones so only this
// final handler controls the live flow.
let liveBookingForm=null;

function bookingAccessMap(){
  try{return JSON.parse(localStorage.getItem('rentall_booking_access')||'{}');}
  catch{return {};}
}
function saveBookingAccess(bookingId,accessToken){
  if(!bookingId||!accessToken) return;
  const map=bookingAccessMap();
  map[bookingId]=accessToken;
  localStorage.setItem('rentall_booking_access',JSON.stringify(map));
}
function bookingAccessToken(bookingId){
  return bookingAccessMap()[bookingId]||'';
}

function authoritativeCustomerData(){
  const first=document.getElementById('firstName')?.value?.trim()||'';
  const last=document.getElementById('lastName')?.value?.trim()||'';
  return {
    name:`${first} ${last}`.trim(),
    email:document.getElementById('email')?.value?.trim()||'',
    phone:document.getElementById('phone')?.value?.trim()||''
  };
}

function wireAuthoritativeCheckout(){
  const oldForm=document.getElementById('bookingForm');
  if(!oldForm) return;

  const cleanForm=oldForm.cloneNode(true);
  oldForm.replaceWith(cleanForm);
  liveBookingForm=cleanForm;

  const oldCheckout=document.getElementById('checkoutBtn');
  if(oldCheckout){
    const cleanCheckout=oldCheckout.cloneNode(true);
    oldCheckout.replaceWith(cleanCheckout);
    cleanCheckout.addEventListener('click',()=>{
      if(!cart.length) return;
      fillCheckout();
      document.getElementById('bookingSuccess')?.classList.remove('show');
      liveBookingForm.style.display='block';
      showStep(1);
      modal.classList.add('open');
      modal.setAttribute('aria-hidden','false');
    });
  }

  cleanForm.querySelectorAll('.next-step').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      const pricing=refreshCheckoutTotals();
      if((bookingStep===1 || bookingStep===2) && !pricing.deliveryRule.eligible) return;
      if(!validateStep(bookingStep)) return;
      if(bookingStep===1){
        const listing=activeCheckoutListing || inferCheckoutListing();
        const startDate=document.getElementById('rentalStart')?.value||'';
        const endDate=document.getElementById('rentalEnd')?.value||'';
        const trip=getTripContext();
        const quantity=Math.max(1,Number(trip?.qty||document.getElementById('quantitySearch')?.value||1));
        btn.disabled=true;
        try{
          const available=await window.rentallCheckoutAvailabilityPreflight?.({listing,startDate,endDate,quantity});
          if(!available) return;
        }finally{btn.disabled=false;}
      }
      if(bookingStep===4) renderReview();
      showStep(Number(btn.dataset.next));
    });
  });

  cleanForm.querySelectorAll('.prev-step').forEach(btn=>{
    btn.addEventListener('click',()=>showStep(Number(btn.dataset.prev)));
  });

  ['accommodationType','deliveryArea','hotelName','rentalStart','rentalEnd'].forEach(id=>{
    document.getElementById(id)?.addEventListener('input',refreshCheckoutTotals);
    document.getElementById(id)?.addEventListener('change',refreshCheckoutTotals);
  });

  ['hotelName','deliveryAddress','hotelBookingName','roomNumber','deliveryInstructions'].forEach(id=>{
    document.getElementById(id)?.addEventListener('input',saveDeliveryFormData);
  });

  cleanForm.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!lockBookingSubmit(cleanForm)) return;

    const pricing=refreshCheckoutTotals();
    if(!pricing.deliveryRule.eligible){ unlockBookingSubmit(cleanForm); return; }
    if(!validateStep(5)){ unlockBookingSubmit(cleanForm); return; }

    const listing=activeCheckoutListing || inferCheckoutListing();
    const startDate=document.getElementById('rentalStart')?.value||'';
    const endDate=document.getElementById('rentalEnd')?.value||'';
    const trip=getTripContext();
    const quantity=Number(trip?.qty || document.getElementById('quantitySearch')?.value || 1);
    const delivery=getDeliveryFormData();
    const customer=authoritativeCustomerData();

    if(!listing || !startDate || !endDate){ unlockBookingSubmit(cleanForm); return; }

    const payBtn=document.getElementById('payBtn');
    const oldText=payBtn?.textContent||'Reserve & continue';
    if(payBtn){
      payBtn.disabled=true;
      payBtn.textContent='Checking availability…';
    }

    try{
      const result=await createBookingWithSafeRetry({
          listingId:listing.id,
          startDate,endDate,quantity,
          status:'pending',
          customerName:customer.name,
          customerEmail:customer.email,
          customerPhone:customer.phone,
          accommodationName:delivery.accommodationName,
          deliveryCity:document.getElementById('deliveryArea')?.value?.trim()||'',
          deliveryAddress:delivery.address,
          roomNumber:delivery.roomNumber,
          contactPerson:delivery.bookingName || customer.name,
          deliveryInstructions:delivery.instructions,
          orderValue:pricing.total,
          termsAccepted:document.getElementById('termsCheck')?.checked===true
        });

      renderBookingConfirmation(result);
      const bookingId=result.booking?.bookingId;
      const accessToken=result.paymentToken;
      saveBookingAccess(bookingId,accessToken);
      if(customer.email) localStorage.setItem('rentall_customer_email',customer.email);

      document.getElementById('bookingCode').textContent=bookingId || `RA-${Date.now()}`;
      renderReview();
      document.getElementById('successSummary').innerHTML=
        document.getElementById('reviewCard').innerHTML+
        `<div class="review-row"><span>Booking status</span><b>Pending supplier confirmation</b></div>`+
        `<div class="review-row"><span>Remaining quantity</span><b>${result.availabilityAfter?.remainingQuantity ?? '—'}</b></div>`;

      liveBookingForm.style.display='none';
      document.getElementById('bookingSuccess')?.classList.add('show');
      cart=[];
      renderCart();
      await refreshCardAvailability();

      document.dispatchEvent(new CustomEvent('rentall:booking-created',{
        detail:{bookingId,paymentToken:accessToken}
      }));
      loadCustomerBookingsSecure().catch(()=>{});
      unlockBookingSubmit(cleanForm,{completed:true});
    }catch(err){
      const note=document.getElementById('deliveryRuleNote');
      if(note){
        note.textContent=err.message||'Selected quantity is no longer available.';
        note.className='delivery-rule-note error';
      }
    }finally{
      unlockBookingSubmit(cleanForm);
      if(payBtn){
        payBtn.disabled=false;
        payBtn.textContent=oldText;
      }
    }
  });
}


function wireAuthoritativeAuth(){
  const oldLogin=document.getElementById('supplierLoginForm');
  if(oldLogin){
    const form=oldLogin.cloneNode(true);
    oldLogin.replaceWith(form);
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const email=form.querySelector('input[type="email"]')?.value?.trim()||'';
      const password=form.querySelector('input[type="password"]')?.value||'';
      try{
        await serverLogin(email,password);
        closeAuth();
        await hydrateListingsFromServer();
        await renderBookings();
        if(typeof showToast==='function') showToast('Signed in successfully.','success',2200);
        if(serverUser?.role==='supplier') document.getElementById('supplier-dashboard')?.scrollIntoView({behavior:'smooth'});
        if(serverUser?.role==='admin') loadAdminDashboard().catch(()=>{});
      }catch(err){alert(err.message);}
    });
  }

  const oldRegister=document.getElementById('supplierRegisterForm');
  if(oldRegister){
    const form=oldRegister.cloneNode(true);
    oldRegister.replaceWith(form);
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const email=form.querySelector('input[type="email"]')?.value?.trim()||'';
      const password=form.querySelector('input[type="password"]')?.value||'';
      const role=document.getElementById('regRole')?.value==='supplier'?'supplier':'customer';
      const profileName=document.getElementById('regBusinessName')?.value?.trim()
        || document.getElementById('regContactName')?.value?.trim()
        || 'RentAll user';
      const contactName=document.getElementById('regContactName')?.value?.trim()||profileName;
      try{
        await serverRegister({
          email,password,role,
          displayName:contactName,businessName:role==='supplier'?profileName:null,
          country:document.getElementById('regCountry')?.value||null,
          city:document.getElementById('regArea')?.value?.trim()||null
        });
        closeAuth();
        await hydrateListingsFromServer();
        if(typeof showToast==='function') showToast('Account created — you are now signed in.','success',2600);
        if(role==='supplier') document.getElementById('supplier-dashboard')?.scrollIntoView({behavior:'smooth'});
      }catch(err){alert(err.message);}
    });
  }
}


async function loadCustomerBookingsSecure(){
  const list=document.getElementById('customerBookingsList');
  if(!list) return;

  const access=bookingAccessMap();
  const entries=Object.entries(access);
  if(!entries.length){
    list.innerHTML='<div class="customer-booking-card">No bookings saved on this device yet.</div>';
    return;
  }

  list.innerHTML='<div class="customer-booking-card">Loading…</div>';
  const bookings=[];

  for(const [bookingId,token] of entries){
    try{
      const data=await apiJson(`/api/customer/bookings/${encodeURIComponent(bookingId)}?accessToken=${encodeURIComponent(token)}`);
      if(data.booking) bookings.push(data.booking);
    }catch{}
  }

  bookings.sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));

  list.innerHTML=bookings.map(b=>{
    const canCancel=['pending','confirmed'].includes(b.status);
    const canReview=['returned','completed'].includes(b.status);
    return `
      <div class="customer-booking-card">
        <div class="customer-booking-head">
          <div>
            <small>${b.bookingId}</small>
            <h3>${b.title||'Rental item'} × ${b.quantity}</h3>
          </div>
          <span class="status ${b.status}">${b.status}</span>
        </div>
        <div class="customer-booking-grid">
          <div><span>Rental dates</span><b>${b.startDate} → ${b.endDate}</b></div>
          <div><span>Delivery</span><b>${b.accommodationName||b.deliveryCity||'—'}</b></div>
          <div><span>Total</span><b>${b.orderValue!=null?money(b.orderValue):'—'}</b></div>
          <div><span>Refund</span><b>${b.refundAmount!=null?money(b.refundAmount):'—'}</b></div>
        </div>
        <p class="muted">${cancellationPolicyText(b.cancellationPolicy||'moderate')}</p>
        <div class="customer-booking-actions">
          ${canCancel?`<button class="secondary secure-customer-cancel" data-id="${b.bookingId}">Cancel booking</button>`:''}
          ${canReview?`<button class="primary secure-customer-review" data-id="${b.bookingId}">Leave review</button>`:''}
        </div>
      </div>`;
  }).join('') || '<div class="customer-booking-card">No accessible bookings found.</div>';

  document.querySelectorAll('.secure-customer-cancel').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      const id=btn.dataset.id;
      const token=bookingAccessToken(id);
      const reason=prompt('Cancellation reason (optional):','')||null;
      try{
        const result=await apiJson(`/api/rentals/bookings/${encodeURIComponent(id)}/cancel`,{
          method:'POST',
          body:JSON.stringify({reason,accessToken:token})
        });
        alert(`Booking cancelled. Refund: ${money(result.refundAmount||0)}.`);
        await loadCustomerBookingsSecure();
        await refreshCardAvailability();
      }catch(err){alert(err.message);}
    });
  });

  document.querySelectorAll('.secure-customer-review').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const id=btn.dataset.id;
      document.getElementById('reviewBookingId').value=id;
      document.getElementById('reviewModal').classList.add('open');
    });
  });
}

// Override old email-based portal loader.
loadCustomerBookings=loadCustomerBookingsSecure;

document.getElementById('loadCustomerBookingsBtn')?.addEventListener('click',loadCustomerBookingsSecure);
document.getElementById('refreshCustomerBookingsBtn')?.addEventListener('click',loadCustomerBookingsSecure);

// Secure review submission by replacing the old form node.
function wireSecureReviewForm(){
  const old=document.getElementById('reviewForm');
  if(!old) return;
  const form=old.cloneNode(true);
  old.replaceWith(form);
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const bookingId=document.getElementById('reviewBookingId').value;
    try{
      await apiJson('/api/rentals/reviews',{
        method:'POST',
        body:JSON.stringify({
          bookingId,
          accessToken:bookingAccessToken(bookingId),
          rating:Number(document.getElementById('reviewRating').value),
          comment:document.getElementById('reviewComment').value.trim()
        })
      });
      document.getElementById('reviewModal').classList.remove('open');
      showToast('Review published. Thank you.','success',1800);
      form.reset();
      await loadCustomerBookingsSecure();
    }catch(err){
      const message=String(err.message||'Unable to submit review');
      if(/already been reviewed|REVIEW_ALREADY_EXISTS/i.test(message)){
        document.getElementById('reviewModal').classList.remove('open');
        showToast('You have already reviewed this booking.','error',2200);
        await loadCustomerBookingsSecure();
      }else{
        showToast(message,'error',2400);
      }
    }
  });
}


function updateRegistrationRoleUI(){
  const role=document.getElementById('regRole')?.value||'customer';
  document.querySelectorAll('[data-supplier-register-field]').forEach(el=>el.hidden=role!=='supplier');
  const note=document.getElementById('registerNextNote');
  if(note) note.textContent=role==='supplier'?'Next: publish your first rental item and configure availability.':'Next: browse rentals, save bookings and message suppliers.';
}
document.getElementById('regRole')?.addEventListener('change',updateRegistrationRoleUI);
setTimeout(updateRegistrationRoleUI,0);

// V33 final boot.
(async()=>{
  wireAuthoritativeCheckout();
  wireAuthoritativeAuth();
  wireSecureReviewForm();
  wireSecureCustomerPortalButtons();
  await refreshServerUser();
  refreshAuthUI();
  loadCustomerBookingsSecure().catch(()=>{});
})();


function wireSecureCustomerPortalButtons(){
  for(const id of ['loadCustomerBookingsBtn','refreshCustomerBookingsBtn']){
    const old=document.getElementById(id);
    if(!old) continue;
    const btn=old.cloneNode(true);
    old.replaceWith(btn);
    btn.addEventListener('click',loadCustomerBookingsSecure);
  }
}


// --- V34: booking hold countdown ---
let bookingHoldTimer=null;

function startBookingHoldCountdown(expiresAt){
  const state=document.getElementById('stripePaymentState');
  if(!state || !expiresAt) return;
  if(bookingHoldTimer) clearInterval(bookingHoldTimer);

  const tick=()=>{
    const ms=new Date(expiresAt).getTime()-Date.now();
    if(ms<=0){
      clearInterval(bookingHoldTimer);
      state.textContent='Reservation hold expired. Inventory has been released; create a new reservation to pay.';
      const btn=document.getElementById('confirmStripePaymentBtn');
      if(btn) btn.disabled=true;
      return;
    }
    const min=Math.floor(ms/60000);
    const sec=Math.floor((ms%60000)/1000);
    state.textContent=`Inventory reserved for ${min}:${String(sec).padStart(2,'0')} more.`;
  };
  tick();
  bookingHoldTimer=setInterval(tick,1000);
}

const v34CreateRealBooking=createRealBooking;
createRealBooking=async function(listingId,startDate,endDate,quantity=1,extra={}){
  const result=await v34CreateRealBooking(listingId,startDate,endDate,quantity,extra);
  if(result.booking?.expiresAt) startBookingHoldCountdown(result.booking.expiresAt);
  return result;
};


// --- V35: notification center + booking timeline ---
async function loadSupplierNotifications(){
  if(!currentSupplier()) return;
  const list=document.getElementById('supplierNotificationList');
  if(!list) return;

  try{
    const data=await apiJson('/api/supplier/notifications?limit=100');
    const notifications=data.notifications||[];
    const unread=notifications.filter(n=>!n.readAt).length;
    document.getElementById('supplierUnreadCount').textContent=unread;

    list.innerHTML=notifications.map(n=>`
      <div class="notification-item ${n.readAt?'':'unread'}">
        <div>
          <h4>${n.title}</h4>
          <p>${n.message}</p>
          <small>${new Date(n.createdAt).toLocaleString()}</small>
        </div>
        ${n.readAt?'':`<button class="mini-action mark-notification-read" data-id="${n.notificationId}">Mark read</button>`}
      </div>`).join('') || '<div class="notification-item">No notifications yet.</div>';

    document.querySelectorAll('.mark-notification-read').forEach(btn=>{
      btn.addEventListener('click',async()=>{
        await apiJson(`/api/supplier/notifications/${encodeURIComponent(btn.dataset.id)}/read`,{
          method:'POST',body:'{}'
        });
        await loadSupplierNotifications();
      });
    });
  }catch(err){
    list.innerHTML=`<div class="notification-item">${escapeHtml(err.message||"Could not load notifications")}</div>`;
  }
}

document.getElementById('refreshNotificationsBtn')?.addEventListener('click',loadSupplierNotifications);

const v35RefreshAuthUI=refreshAuthUI;
refreshAuthUI=function(){
  v35RefreshAuthUI();
  if(currentSupplier()) setTimeout(()=>loadSupplierNotifications(),0);
};

// Secure customer portal with timeline enrichment.
const v35CustomerLoader=loadCustomerBookingsSecure;
loadCustomerBookingsSecure=async function(){
  const list=document.getElementById('customerBookingsList');
  if(!list) return;

  const access=bookingAccessMap();
  const entries=Object.entries(access);
  if(!entries.length){
    list.innerHTML='<div class="customer-booking-card">No bookings saved on this device yet.</div>';
    return;
  }

  const records=[];
  for(const [bookingId,token] of entries){
    try{
      const data=await apiJson(`/api/customer/bookings/${encodeURIComponent(bookingId)}?accessToken=${encodeURIComponent(token)}`);
      if(data.booking) records.push({booking:data.booking,timeline:data.timeline||[]});
    }catch{}
  }
  records.sort((a,b)=>String(b.booking.createdAt||'').localeCompare(String(a.booking.createdAt||'')));

  list.innerHTML=records.map(({booking:b,timeline})=>{
    const canCancel=['pending','confirmed'].includes(b.status);
    const canReview=['returned','completed'].includes(b.status);
    return `
      <div class="customer-booking-card">
        <div class="customer-booking-head">
          <div><small>${b.bookingId}</small><h3>${b.title||'Rental item'} × ${b.quantity}</h3></div>
          <span class="status ${b.status}">${b.status}</span>
        </div>
        <div class="customer-booking-grid">
          <div><span>Rental dates</span><b>${b.startDate} → ${b.endDate}</b></div>
          <div><span>Delivery</span><b>${b.accommodationName||b.deliveryCity||'—'}</b></div>
          <div><span>Total</span><b>${b.orderValue!=null?money(b.orderValue):'—'}</b></div>
          <div><span>Refund</span><b>${b.refundAmount!=null?money(b.refundAmount):'—'}</b></div>
        </div>
        <div class="booking-timeline">
          ${timeline.map(t=>`
            <div class="booking-timeline-item">
              <b>${t.title}</b>
              <span>${t.message} · ${new Date(t.createdAt).toLocaleString()}</span>
            </div>`).join('')}
        </div>
        <div class="customer-booking-actions">
          ${canCancel?`<button class="secondary secure-customer-cancel" data-id="${b.bookingId}">Cancel booking</button>`:''}
          ${canReview?`<button class="primary secure-customer-review" data-id="${b.bookingId}">Leave review</button>`:''}
        </div>
      </div>`;
  }).join('');

  document.querySelectorAll('.secure-customer-cancel').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      const id=btn.dataset.id;
      const reason=prompt('Cancellation reason (optional):','')||null;
      try{
        await apiJson(`/api/rentals/bookings/${encodeURIComponent(id)}/cancel`,{
          method:'POST',
          body:JSON.stringify({reason,accessToken:bookingAccessToken(id)})
        });
        await loadCustomerBookingsSecure();
        await refreshCardAvailability();
      }catch(err){alert(err.message);}
    });
  });
  document.querySelectorAll('.secure-customer-review').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.getElementById('reviewBookingId').value=btn.dataset.id;
      document.getElementById('reviewModal').classList.add('open');
    });
  });
};

setTimeout(()=>loadSupplierNotifications().catch(()=>{}),300);


// --- V36 output escaping for user-provided marketplace content ---
function escapeHtml(value){
  return String(value??'')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

function safeImageUrl(value){
  const v=String(value||'');
  return /^\/uploads\/[a-zA-Z0-9._-]+$/.test(v) ? v : '';
}

// Localize RentAll system labels; supplier-entered listing content stays in its original language.
function uiText(key,vars){
  return window.RentAllI18n?.t?.(key,vars)||key;
}

// Final sanitized listing renderer.
renderUniversalListings=function(items=loadUniversalListings()){
  const grid=document.getElementById('listingPreviewGrid');
  if(!grid) return;
  const ctx=getCurrentSearchContext();
  const cleanItems=purgeLegacyDemoListings(items);

  if(!cleanItems.length){
    const template=document.getElementById('listingEmptyStateTemplate');
    grid.innerHTML=template?.innerHTML||`<div class="empty-state"><h3>${escapeHtml(uiText('No rentals found'))}</h3><p>${escapeHtml(uiText('Try a larger radius, different dates, or another category.'))}</p></div>`;
    grid.querySelector('#resetSearchFromEmpty')?.addEventListener('click',()=>resetDiscoveryFilters());
    return;
  }

  grid.innerHTML=cleanItems.map(l=>{
    const preview=calculateListingPreview(l,ctx);
    const zones=normalizeDeliveryZones(l.deliveryZones);
    const cover=safeImageUrl(l.coverPhoto);
    const favorite=isFavorite(l.id);
    const ownerLabel=l.ownerType==='business'?uiText('Business'):uiText('Individual');
    const leadTime=uiText(l.deliveryLeadTime||'Same day');
    const deliveryValue=ctx.mode==='trip'
      ? (preview.eligible?`€${preview.delivery.toFixed(2)}`:uiText('Not available'))
      : uiText('Calculated at checkout');

    return `
      <div class="listing-card" data-listing-id="${escapeHtml(l.id)}">
        ${cover?`<img class="listing-card-cover" src="${cover}" alt="${escapeHtml(l.title)}">`:''}
        <button class="favorite-btn ${favorite?'active':''}" type="button" data-favorite-id="${escapeHtml(l.id)}" aria-pressed="${favorite?'true':'false'}" aria-label="${escapeHtml(uiText(favorite?'Remove from favorites':'Save to favorites'))}">${favorite?'♥':'♡'}</button>
        <small>${escapeHtml(ownerLabel)} · ${escapeHtml(l.city||'')}</small>
        <h4>${escapeHtml(l.title)}</h4>
        <p>${escapeHtml(l.description||uiText('Local rental listing'))}</p>

        <div class="listing-meta">
          <div><span>${escapeHtml(uiText('Available'))}</span><b>${Number(l.quantity||0)}</b></div>
          <div><span>${escapeHtml(uiText('Per day'))}</span><b>€${Number(l.priceDay||0).toFixed(2)}</b></div>
          <div><span>${escapeHtml(uiText('Per week'))}</span><b>${l.priceWeek?`€${Number(l.priceWeek).toFixed(2)}`:'—'}</b></div>
          <div><span>${escapeHtml(uiText('Deposit'))}</span><b>${l.deposit?`€${Number(l.deposit).toFixed(2)}`:'—'}</b></div>
        </div>

        ${(l.accommodationDelivery==='yes'||l.accommodationDelivery===true)?`
          <div class="delivery-info-box">
            <b>${escapeHtml(uiText('Hotel / apartment delivery'))}</b>
            <div class="delivery-info-grid">
              <div><span>${escapeHtml(uiText('Zones'))}</span><strong>${escapeHtml(zones.length?zones.join(', '):(l.city||''))}</strong></div>
              <div><span>${escapeHtml(uiText('Delivery fee'))}</span><strong>€${Number(l.hotelDeliveryFee||0).toFixed(2)}</strong></div>
              <div><span>${escapeHtml(uiText('Minimum order'))}</span><strong>€${Number(l.minOrder||0).toFixed(2)}</strong></div>
              <div><span>${escapeHtml(uiText('Lead time'))}</span><strong>${escapeHtml(leadTime)}</strong></div>
            </div>
          </div>`:''}

        <div class="price-preview-box">
          <div class="price-preview-row"><span>${escapeHtml(uiText('Rental estimate'))}</span><b>€${preview.rental.toFixed(2)}</b></div>
          <div class="price-preview-row"><span>${escapeHtml(uiText('Delivery'))}</span><b>${escapeHtml(deliveryValue)}</b></div>
          <div class="price-preview-row total"><span>${escapeHtml(uiText('Estimated total'))}</span><b>€${preview.total.toFixed(2)}</b></div>
          <div class="price-preview-note ${preview.eligible?'ok':'error'}">${escapeHtml(localizePreviewNote(preview,ctx))}</div>
        </div>

        <button class="secondary detail-btn" type="button" data-detail-id="${escapeHtml(l.id)}">${escapeHtml(uiText('View details'))}</button>
        <button class="secondary availability-btn" type="button" data-availability-id="${escapeHtml(l.id)}">${escapeHtml(uiText('View availability'))}</button>
        <div class="price-preview-note">${escapeHtml(cancellationPolicyText(l.cancellationPolicy||'moderate'))}</div>
      </div>`;
  }).join('');

  grid.querySelectorAll('[data-favorite-id]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const active=toggleFavorite(btn.dataset.favoriteId);
      btn.classList.toggle('active',active);
      btn.textContent=active?'♥':'♡';
      btn.setAttribute('aria-pressed',active?'true':'false');
      btn.setAttribute('aria-label',uiText(active?'Remove from favorites':'Save to favorites'));
    });
  });
  grid.querySelectorAll('[data-detail-id]').forEach(btn=>{
    btn.addEventListener('click',()=>openListingDetail(btn.dataset.detailId));
  });
  grid.querySelectorAll('[data-availability-id]').forEach(btn=>{
    btn.addEventListener('click',()=>openAvailabilityCalendar(btn.dataset.availabilityId));
  });
};

async function checkPlatformHealth(){
  const target=document.getElementById('platformHealthResult');
  if(!target) return;
  target.textContent='Checking…';
  try{
    const data=await apiJson('/api/health');
    target.innerHTML=`
      <span class="${data.ok?'health-ok':'health-error'}">${data.ok?'Healthy':'Problem detected'}</span><br>
      Database: ${escapeHtml(data.database)}<br>
      Stripe: ${escapeHtml(data.stripe)}<br>
      Version: ${escapeHtml(data.version)}<br>
      ${escapeHtml(data.timestamp)}`;
  }catch(err){
    target.innerHTML=`<span class="health-error">${escapeHtml(err.message)}</span>`;
  }
}
document.getElementById('checkPlatformHealthBtn')?.addEventListener('click',checkPlatformHealth);


// --- V37: distance search + List/Map results ---
const CITY_COORDS={
  'klaipėda':[55.7033,21.1443],
  'vilnius':[54.6872,25.2797],
  'kaunas':[54.8985,23.9036],
  'palanga':[55.9175,21.0686],
  'magaluf':[39.5102,2.5357],
  'palma nova':[39.5246,2.5388],
  'palma':[39.5696,2.6502],
  'santa ponça':[39.5084,2.4760],
  'alcúdia':[39.8533,3.1214],
  'barcelona':[41.3874,2.1686],
  'madrid':[40.4168,-3.7038],
  'lisbon':[38.7223,-9.1393],
  'lisboa':[38.7223,-9.1393],
  'rome':[41.9028,12.4964],
  'roma':[41.9028,12.4964]
};

let userGeo=null;
let resultsMap=null;
let resultsMarkerLayer=null;
let currentResultItems=[];

function normalizeCityKey(v){
  return String(v||'').trim().toLowerCase();
}

function listingCoordinates(listing){
  const lat=Number(listing.latitude);
  const lng=Number(listing.longitude);
  if(Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180){
    return [lat,lng];
  }
  return CITY_COORDS[normalizeCityKey(listing.city)]||null;
}

function haversineKm(a,b){
  if(!a||!b) return null;
  const R=6371;
  const toRad=d=>d*Math.PI/180;
  const dLat=toRad(b[0]-a[0]);
  const dLon=toRad(b[1]-a[1]);
  const lat1=toRad(a[0]);
  const lat2=toRad(b[0]);
  const h=Math.sin(dLat/2)**2+
    Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}

function listingDistanceKm(listing){
  if(!userGeo) return null;
  const coords=listingCoordinates(listing);
  return coords?haversineKm(userGeo,coords):null;
}

function getGeoFilteredSortedListings(items){
  let result=[...items];
  const radius=Number(document.getElementById('radiusFilter')?.value||0);
  const sort=document.getElementById('listingSort')?.value||'relevance';

  result=result.map(l=>({...l,_distanceKm:listingDistanceKm(l)}));

  if(userGeo && radius>0){
    result=result.filter(l=>l._distanceKm==null || l._distanceKm<=radius);
  }

  if(sort==='distance'){
    result.sort((a,b)=>(a._distanceKm??Infinity)-(b._distanceKm??Infinity));
  }else if(sort==='price_asc'){
    result.sort((a,b)=>Number(a.priceDay||0)-Number(b.priceDay||0));
  }else if(sort==='price_desc'){
    result.sort((a,b)=>Number(b.priceDay||0)-Number(a.priceDay||0));
  }

  return result;
}

function setGeoStatus(text,isError=false){
  const el=document.getElementById('geoStatus');
  if(!el) return;
  el.textContent=text;
  el.classList.toggle('error',isError);
}

document.getElementById('useMyLocationBtn')?.addEventListener('click',()=>{
  if(!navigator.geolocation){
    setGeoStatus('Geolocation is not supported by this browser.',true);
    return;
  }
  setGeoStatus('Getting location…');
  navigator.geolocation.getCurrentPosition(pos=>{
    userGeo=[pos.coords.latitude,pos.coords.longitude];
    setGeoStatus(`Location set · accuracy ±${Math.round(pos.coords.accuracy)} m`);
    renderGeoAwareListings(loadUniversalListings());
  },err=>{
    setGeoStatus(err.message||'Could not access location.',true);
  },{
    enableHighAccuracy:false,
    timeout:10000,
    maximumAge:300000
  });
});

document.getElementById('useListingLocationBtn')?.addEventListener('click',()=>{
  if(!navigator.geolocation){
    alert('Geolocation is not supported by this browser.');
    return;
  }
  navigator.geolocation.getCurrentPosition(pos=>{
    document.getElementById('listingLatitude').value=pos.coords.latitude.toFixed(6);
    document.getElementById('listingLongitude').value=pos.coords.longitude.toFixed(6);
  },err=>alert(err.message||'Could not access location.'),{
    enableHighAccuracy:true,timeout:10000,maximumAge:60000
  });
});

function renderResultsMap(items){
  const shell=document.getElementById('resultsMapShell');
  if(!shell || shell.hidden || !window.L) return;

  if(!resultsMap){
    resultsMap=L.map('resultsMap',{scrollWheelZoom:true});
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:19,
      attribution:'&copy; OpenStreetMap contributors'
    }).addTo(resultsMap);
    resultsMarkerLayer=L.layerGroup().addTo(resultsMap);
  }

  resultsMarkerLayer.clearLayers();
  const points=[];
  const countEl=document.getElementById('v101MapCount'); if(countEl) countEl.textContent=`${items.length} place${items.length===1?'':'s'}`;

  if(userGeo){
    L.circleMarker(userGeo,{
      radius:7,
      weight:2,
      fillOpacity:.8
    }).bindPopup('Your location').addTo(resultsMarkerLayer);
    points.push(userGeo);
  }

  items.forEach(l=>{
    const coords=listingCoordinates(l);
    if(!coords) return;
    const distance=l._distanceKm!=null?`${l._distanceKm.toFixed(1)} km away`:'';
    const marker=L.marker(coords).bindPopup(`<div class="map-popup"><b>${escapeHtml(l.title)}</b><small>${escapeHtml(l.city||'')}</small><small>€${Number(l.priceDay||0).toFixed(2)} / day</small>${distance?`<small>${escapeHtml(distance)}</small>`:''}</div>`).addTo(resultsMarkerLayer);
    marker.on('click',()=>renderMapListingPreviewV101(l));
    points.push(coords);
  });

  if(points.length===1){
    resultsMap.setView(points[0],12);
  }else if(points.length>1){
    resultsMap.fitBounds(points,{padding:[28,28],maxZoom:13});
  }else{
    resultsMap.setView([54.7,24.0],6);
  }
  setTimeout(()=>resultsMap.invalidateSize(),50);
}

function renderGeoAwareListings(items=loadUniversalListings()){
  const filtered=getGeoFilteredSortedListings(items);
  currentResultItems=filtered;

  // Use the sanitized V36 renderer as the base.
  renderUniversalListingsBaseV37(filtered);

  document.querySelectorAll('.listing-card').forEach(card=>{
    const id=card.dataset.listingId;
    const listing=filtered.find(l=>String(l.id)===String(id));
    if(!listing || listing._distanceKm==null) return;
    const pill=document.createElement('div');
    pill.className='distance-pill';
    pill.textContent=`${listing._distanceKm.toFixed(1)} km away`;
    const title=card.querySelector('h4');
    title?.insertAdjacentElement('afterend',pill);
  });

  renderResultsMap(filtered);
}

// Capture the previous secure renderer once, then make geo-aware rendering authoritative.
const renderUniversalListingsBaseV37=renderUniversalListings;
renderUniversalListings=function(items=loadUniversalListings()){
  renderGeoAwareListings(items);
};

['radiusFilter','listingSort'].forEach(id=>{
  document.getElementById(id)?.addEventListener('change',()=>renderGeoAwareListings(loadUniversalListings()));
});

document.querySelectorAll('[data-results-view]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('[data-results-view]').forEach(b=>b.classList.toggle('active',b===btn));
    const mapMode=btn.dataset.resultsView==='map';
    document.getElementById('resultsMapShell').hidden=!mapMode;
    document.getElementById('listingPreviewGrid').hidden=mapMode;
    if(mapMode) renderResultsMap(currentResultItems.length?currentResultItems:loadUniversalListings());
  });
});

// Persist exact coordinates onto the newest listing after existing listing creation.
document.getElementById('listingForm')?.addEventListener('submit',()=>{
  const lat=Number(document.getElementById('listingLatitude')?.value);
  const lng=Number(document.getElementById('listingLongitude')?.value);
  const validCoords=Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180;
  setTimeout(()=>{
    const listings=loadUniversalListings();
    const latest=listings[0];
    if(!latest) return;
    if(validCoords){
      latest.latitude=lat;
      latest.longitude=lng;
      localStorage.setItem('rentall_listings',JSON.stringify(listings));
    }
    renderGeoAwareListings(listings);
  },220);
},true);

// Use selected city center as a fallback for distance-sort if the user has not shared precise location.
function setGeoFromSelectedCity(){
  if(userGeo) return;
  const city=document.getElementById('citySelect')?.value || '';
  const coords=CITY_COORDS[normalizeCityKey(city)];
  if(coords){
    userGeo=[...coords];
    setGeoStatus(uiText('Using {city} city center',{city}));
  }
}
document.getElementById('citySelect')?.addEventListener('change',()=>{
  if(!userGeo) setGeoFromSelectedCity();
  renderGeoAwareListings(loadUniversalListings());
});

// Initial map/search render.
setTimeout(()=>{
  setGeoFromSelectedCity();
  renderGeoAwareListings(loadUniversalListings());
},350);



// --- V39: motion, sticky-header state and mobile navigation ---
function initV39Polish(){
  const topbar=document.querySelector('.topbar');

  const updateTopbar=()=>{
    topbar?.classList.toggle('scrolled',window.scrollY>12);
  };
  updateTopbar();
  window.addEventListener('scroll',updateTopbar,{passive:true});

  const revealTargets=[
    ...document.querySelectorAll(
      '.section-head,.product,.listing-card,.step,.plan,.dashboard-panel,.payment-card,.inventory-card,.notification-item,.customer-booking-card,.admin-card'
    )
  ];

  if('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    revealTargets.forEach(el=>el.classList.add('reveal-ready'));
    const observer=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          entry.target.classList.add('reveal-visible');
          observer.unobserve(entry.target);
        }
      });
    },{threshold:.08,rootMargin:'0px 0px -30px 0px'});
    revealTargets.forEach(el=>observer.observe(el));
  }else{
    revealTargets.forEach(el=>el.classList.add('reveal-visible'));
  }

  const accountBtn=document.getElementById('mobileAccountBtn');
  accountBtn?.addEventListener('click',()=>{
    document.getElementById('supplierAuthBtn')?.click();
  });

  const mobileItems=[...document.querySelectorAll('.mobile-nav-item[data-mobile-section]')];
  mobileItems.forEach(item=>{
    item.addEventListener('click',()=>{
      document.querySelectorAll('.mobile-nav-item').forEach(x=>x.classList.remove('active'));
      item.classList.add('active');
    });
  });

  const watchedSections=[
    ['browse',document.getElementById('browse')],
    ['how',document.getElementById('how')],
    ['pricing',document.getElementById('pricing')]
  ].filter(([,el])=>el);

  if('IntersectionObserver' in window && watchedSections.length){
    const navObserver=new IntersectionObserver(entries=>{
      const visible=entries
        .filter(e=>e.isIntersecting)
        .sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
      if(!visible) return;
      const id=visible.target.id;
      document.querySelectorAll('.mobile-nav-item').forEach(x=>x.classList.remove('active'));
      document.querySelector(`.mobile-nav-item[data-mobile-section="${id}"]`)?.classList.add('active');
    },{threshold:[.2,.45,.7]});
    watchedSections.forEach(([,el])=>navObserver.observe(el));
  }
}

window.addEventListener('DOMContentLoaded',initV39Polish);


// --- V40: quick categories, empty state, skeletons, toasts ---
function ensureToastStack(){
  let stack=document.querySelector('.toast-stack');
  if(!stack){
    stack=document.createElement('div');
    stack.className='toast-stack';
    document.body.appendChild(stack);
  }
  return stack;
}
function showToast(message,type='success',duration=2600){
  const stack=ensureToastStack();
  const el=document.createElement('div');
  el.className=`toast ${type}`;
  el.textContent=message;
  stack.appendChild(el);
  setTimeout(()=>el.remove(),duration);
}

function renderListingSkeletons(count=6){
  const grid=document.getElementById('listingPreviewGrid');
  if(!grid) return;
  grid.innerHTML=Array.from({length:count},()=>`
    <div class="skeleton-card">
      <div class="skeleton skeleton-block lg"></div>
      <div class="skeleton skeleton-block sm"></div>
      <div class="skeleton skeleton-block md"></div>
      <div class="skeleton skeleton-block"></div>
      <div class="skeleton skeleton-block md"></div>
    </div>`).join('');
}

function renderEmptyListingState(){
  const grid=document.getElementById('listingPreviewGrid');
  const tpl=document.getElementById('listingEmptyStateTemplate');
  if(!grid||!tpl) return;
  grid.innerHTML='';
  grid.appendChild(tpl.content.cloneNode(true));
  document.getElementById('resetSearchFromEmpty')?.addEventListener('click',()=>{
    document.getElementById('radiusFilter').value='0';
    document.getElementById('listingSort').value='relevance';
    document.querySelectorAll('.quick-category').forEach(b=>b.classList.remove('active'));
    renderGeoAwareListings(loadUniversalListings());
  });
}

const v40BaseGeoRender=renderGeoAwareListings;
renderGeoAwareListings=function(items=loadUniversalListings()){
  const filtered=getGeoFilteredSortedListings(items);
  currentResultItems=filtered;
  if(!filtered.length){
    renderEmptyListingState();
    renderResultsMap(filtered);
    return;
  }
  return v40BaseGeoRender(items);
};

document.querySelectorAll('.quick-category').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const category=btn.dataset.quickCategory;
    const wasActive=btn.classList.contains('active');
    document.querySelectorAll('.quick-category').forEach(b=>b.classList.remove('active'));
    if(wasActive){
      renderGeoAwareListings(loadUniversalListings());
      return;
    }
    btn.classList.add('active');
    const items=loadUniversalListings().filter(l=>l.category===category);
    renderGeoAwareListings(items);
    showToast(`${category} selected`,'success',1500);
  });
});

// Lightweight skeleton when refreshing server listings.
const v40HydrateListings=hydrateListingsFromServer;
hydrateListingsFromServer=async function(){
  renderListingSkeletons(6);
  try{
    const result=await v40HydrateListings();
    return result;
  }catch(err){
    showToast(err.message||'Could not refresh listings','error');
    throw err;
  }
};

// Friendly toasts for common actions.
document.addEventListener('click',e=>{
  if(e.target.closest('.favorite-btn')){
    setTimeout(()=>showToast('Favorites updated','success',1200),20);
  }
  if(e.target.closest('.mark-notification-read')){
    setTimeout(()=>showToast('Notification marked as read','success',1200),20);
  }
});

// Initial polish
setTimeout(()=>{
  if(!document.querySelector('#listingPreviewGrid .listing-card')){
    renderGeoAwareListings(loadUniversalListings());
  }
},450);


// --- V41: installable PWA + first-run onboarding ---
let deferredInstallPrompt=null;

function showOnboardingStep(step){
  document.querySelectorAll('[data-onboarding-step]').forEach(el=>{
    el.classList.toggle('active',Number(el.dataset.onboardingStep)===Number(step));
  });
  document.querySelectorAll('[data-onboarding-dot]').forEach(el=>{
    el.classList.toggle('active',Number(el.dataset.onboardingDot)<=Number(step));
  });
}

function openOnboarding(){
  const modal=document.getElementById('onboardingModal');
  if(!modal) return;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');
  showOnboardingStep(1);
}

function closeOnboarding(){
  const modal=document.getElementById('onboardingModal');
  if(!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden','true');
}

function onboardingPrefs(){
  try{return JSON.parse(localStorage.getItem('rentall_onboarding_prefs')||'{}');}
  catch{return {};}
}
function saveOnboardingPrefs(prefs){
  localStorage.setItem('rentall_onboarding_prefs',JSON.stringify(prefs));
}

document.querySelectorAll('[data-onboarding-intent]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('[data-onboarding-intent]').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const prefs=onboardingPrefs();
    prefs.intent=btn.dataset.onboardingIntent;
    saveOnboardingPrefs(prefs);
  });
});

document.querySelectorAll('[data-next-onboarding]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const next=Number(btn.dataset.nextOnboarding);
    if(next===3){
      const prefs=onboardingPrefs();
      prefs.language=document.getElementById('onboardingLanguage')?.value||'en';
      prefs.currency=document.getElementById('onboardingCurrency')?.value||'EUR';
      saveOnboardingPrefs(prefs);
      const summary=document.getElementById('onboardingSummary');
      if(summary){
        summary.innerHTML=`
          <b>Mode:</b> ${escapeHtml(prefs.intent==='trip'?'For my trip':'Near me')}<br>
          <b>Language:</b> ${escapeHtml(prefs.language.toUpperCase())}<br>
          <b>Currency:</b> ${escapeHtml(prefs.currency)}`;
      }
    }
    showOnboardingStep(next);
  });
});

document.querySelectorAll('[data-back-onboarding]').forEach(btn=>{
  btn.addEventListener('click',()=>showOnboardingStep(Number(btn.dataset.backOnboarding)));
});

document.getElementById('skipOnboardingBtn')?.addEventListener('click',()=>{
  localStorage.setItem('rentall_onboarding_done','1');
  closeOnboarding();
});
document.getElementById('finishOnboardingBtn')?.addEventListener('click',()=>{
  const prefs=onboardingPrefs();
  localStorage.setItem('rentall_onboarding_done','1');

  const lang=document.getElementById('lang');
  if(lang && prefs.language){
    lang.value=prefs.language;
    window.RentAllI18n?.apply?.(prefs.language);
  }

  if(prefs.intent==='trip'){
    document.querySelector('[data-search-mode="trip"]')?.click();
  }else{
    document.querySelector('[data-search-mode="local"]')?.click();
  }

  closeOnboarding();
  showToast('RentAll is ready','success',1800);
});

window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  deferredInstallPrompt=event;
  const btn=document.getElementById('installAppBtn');
  if(btn) btn.hidden=false;
});

document.getElementById('installAppBtn')?.addEventListener('click',async()=>{
  if(!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt=null;
  document.getElementById('installAppBtn').hidden=true;
});

window.addEventListener('appinstalled',()=>{
  showToast('RentAll installed','success',1800);
});

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('/service-worker.js?v=178').catch(err=>{
      console.warn('Service worker registration failed',err);
    });
  });
}

window.addEventListener('DOMContentLoaded',()=>{
  if(!localStorage.getItem('rentall_onboarding_done')){
    setTimeout(openOnboarding,450);
  }
});


// --- V42: persistent saved searches ---
function currentSearchSnapshot(){
  return {
    city:document.getElementById('citySelect')?.value||'',
    radius:document.getElementById('radiusFilter')?.value||'0',
    sort:document.getElementById('listingSort')?.value||'relevance',
    mode:document.querySelector('.search-mode-tab.active')?.dataset.searchMode||'local',
    category:document.querySelector('.quick-category.active')?.dataset.quickCategory||''
  };
}
function applySearchSnapshot(q={}){
  if(q.city && document.getElementById('citySelect')) document.getElementById('citySelect').value=q.city;
  if(q.radius!=null && document.getElementById('radiusFilter')) document.getElementById('radiusFilter').value=String(q.radius);
  if(q.sort && document.getElementById('listingSort')) document.getElementById('listingSort').value=q.sort;
  document.querySelectorAll('.quick-category').forEach(b=>b.classList.toggle('active',b.dataset.quickCategory===q.category));
  document.querySelector(`[data-search-mode="${q.mode||'local'}"]`)?.click();
  setGeoFromSelectedCity();
  const items=q.category
    ? loadUniversalListings().filter(l=>l.category===q.category)
    : loadUniversalListings();
  renderGeoAwareListings(items);
}
async function loadSavedSearches(){
  const target=document.getElementById('savedSearchList');
  if(!target) return;
  if(!currentServerUser){
    target.innerHTML=`<div class="saved-search-item">${escapeHtml(uiText('Sign in to sync saved searches.'))}</div>`;
    return;
  }
  try{
    const data=await apiJson('/api/customer/saved-searches');
    const items=data.savedSearches||[];
    target.innerHTML=items.map(s=>`
      <div class="saved-search-item">
        <div><b>${escapeHtml(s.name)}</b><small>${escapeHtml([s.query?.city,s.query?.category].filter(Boolean).join(' · ')||uiText('Custom search'))}</small></div>
        <div class="saved-search-actions">
          <button class="secondary load-saved-search" data-id="${escapeHtml(s.savedSearchId)}">${escapeHtml(uiText('Open'))}</button>
          <button class="secondary delete-saved-search" data-id="${escapeHtml(s.savedSearchId)}">${escapeHtml(uiText('Delete'))}</button>
        </div>
      </div>`).join('')||`<div class="saved-search-item">${escapeHtml(uiText('No saved searches yet.'))}</div>`;
    target.querySelectorAll('.load-saved-search').forEach(btn=>btn.addEventListener('click',()=>{
      const s=items.find(x=>x.savedSearchId===btn.dataset.id);
      if(s) applySearchSnapshot(s.query);
    }));
    target.querySelectorAll('.delete-saved-search').forEach(btn=>btn.addEventListener('click',async()=>{
      await apiJson(`/api/customer/saved-searches/${encodeURIComponent(btn.dataset.id)}`,{method:'DELETE'});
      showToast(uiText('Saved search deleted'),'success',1200);
      loadSavedSearches();
    }));
  }catch(err){target.innerHTML=`<div class="saved-search-item">${escapeHtml(err.message)}</div>`}
}
document.getElementById('saveCurrentSearchBtn')?.addEventListener('click',async()=>{
  if(!currentServerUser){
    showToast(uiText('Sign in to save searches'),'error',1800);
    document.getElementById('supplierAuthBtn')?.click();
    return;
  }
  const q=currentSearchSnapshot();
  const defaultName=[q.city,q.category].filter(Boolean).join(' · ')||uiText('Saved search');
  const name=prompt(uiText('Name this search:'),defaultName);
  if(!name) return;
  try{
    await apiJson('/api/customer/saved-searches',{method:'POST',body:JSON.stringify({name,query:q})});
    showToast(uiText('Search saved'),'success',1500);
  }catch(err){showToast(err.message,'error')}
});
document.getElementById('openSavedSearchesBtn')?.addEventListener('click',()=>{
  const drawer=document.getElementById('savedSearchDrawer');
  drawer.hidden=false; loadSavedSearches();
});
document.getElementById('closeSavedSearchesBtn')?.addEventListener('click',()=>{
  document.getElementById('savedSearchDrawer').hidden=true;
});

const v42RenderGeo=renderGeoAwareListings;
renderGeoAwareListings=function(items=loadUniversalListings()){
  const filtered=getGeoFilteredSortedListings(items);
  const count=document.getElementById('resultCount');
  if(count){
    count.setAttribute('role','status');
    count.setAttribute('aria-live','polite');
    count.textContent=`${filtered.length} ${uiText(filtered.length===1?'rental found':'rentals found')}`;
  }

  // Preserve the caller's narrowed dataset (for example a quick-category search).
  // The older geo wrapper recomputed from its argument, so passing the original
  // collection here could silently re-introduce items that the caller filtered out.
  return v42RenderGeo(filtered);
};

// --- V46: unified account + guest booking portal ---
async function loadUnifiedCustomerBookings(){
  const list=document.getElementById('customerBookingsList');
  if(!list) return;
  list.innerHTML='<div class="customer-booking-card">Loading…</div>';

  const records=new Map();
  if(currentServerUser){
    try{
      const data=await apiJson('/api/customer/bookings');
      for(const booking of (data.bookings||[])) records.set(booking.bookingId,{booking,timeline:[]});
    }catch{}
  }

  for(const [bookingId,token] of Object.entries(bookingAccessMap())){
    try{
      const data=await apiJson(`/api/customer/bookings/${encodeURIComponent(bookingId)}?accessToken=${encodeURIComponent(token)}`);
      if(data.booking) records.set(bookingId,{booking:data.booking,timeline:data.timeline||[],guestAccess:data.guestAccess||null});
    }catch{}
  }

  const allRows=[...records.values()].sort((a,b)=>String(b.booking.createdAt||'').localeCompare(String(a.booking.createdAt||'')));const rows=window.customerBookingFilter==='all'?allRows:allRows.filter(x=>window.customerBookingBucket(x.booking)===window.customerBookingFilter);const count=document.getElementById('v127BookingCount');if(count)count.textContent=`${rows.length} of ${allRows.length}`;
  if(!rows.length){
    list.innerHTML=`<div class="customer-booking-card"><h3>No bookings yet</h3><p class="muted">${currentServerUser?'Bookings made with this account will appear here.':'Sign in for cross-device booking history, or open a guest booking from its secure link.'}</p></div>`;
    return;
  }

  list.innerHTML=rows.map(({booking:b,timeline,guestAccess})=>{
    const canCancel=['pending','confirmed'].includes(b.status);
    const canReview=['returned','completed'].includes(b.status);
    const canDispute=['active','returned','completed','cancelled','declined'].includes(b.status);
    return `<div class="customer-booking-card" data-booking-id="${escapeHtml(b.bookingId)}" data-listing-id="${escapeHtml(b.listingId||'')}">
      <div class="customer-booking-head"><div><small>${escapeHtml(b.bookingId)}</small><h3>${escapeHtml(b.title||b.listingTitle||'Rental item')} × ${Number(b.quantity||1)}</h3></div><span class="status ${escapeHtml(b.status||'pending')}">${escapeHtml(b.status||'pending')}</span></div>
      <div class="customer-booking-grid">
        <div><span>Rental dates</span><b>${escapeHtml(b.startDate||'—')} → ${escapeHtml(b.endDate||'—')}</b></div>
        <div><span>Delivery</span><b>${escapeHtml(b.accommodationName||b.deliveryCity||'—')}</b></div>
        <div><span>Total</span><b>${b.orderValue!=null?money(b.orderValue):'—'}</b></div>
        <div><span>Payment</span><b>${escapeHtml(b.paymentStatus||'—')}</b></div>
      </div>
      ${timeline.length?`<div class="booking-timeline">${timeline.map(t=>`<div class="booking-timeline-item"><b>${escapeHtml(t.title)}</b><span>${escapeHtml(t.message)} · ${escapeHtml(new Date(t.createdAt).toLocaleString())}</span></div>`).join('')}</div>`:''}
      <div class="customer-booking-actions">
        ${canCancel?`<button class="secondary v46-cancel-booking" data-id="${escapeHtml(b.bookingId)}">Cancel booking</button>`:''}
        ${canReview?`<button class="primary v46-review-booking" data-id="${escapeHtml(b.bookingId)}">Leave review</button>`:''}
        <button class="secondary v172-view-agreement" data-id="${escapeHtml(b.bookingId)}">View agreement</button>
        ${currentServerUser?`<button class="secondary v172-booking-message" data-id="${escapeHtml(b.bookingId)}" data-listing-id="${escapeHtml(b.listingId||'')}">Messages</button>`:''}
        ${canDispute?`<button class="secondary v89-open-dispute" data-id="${escapeHtml(b.bookingId)}">Report a problem</button>`:''}
        ${currentServerUser && !guestAccess?.revoked?`<button class="secondary v88-revoke-guest" data-id="${escapeHtml(b.bookingId)}">Revoke guest link</button>`:''}
        ${currentServerUser && guestAccess?.revoked?`<span class="muted">Guest link revoked</span>`:''}
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('.v46-cancel-booking').forEach(btn=>btn.addEventListener('click',async()=>{
    const id=btn.dataset.id;
    const reason=prompt('Cancellation reason (optional):','')||null;
    try{
      await apiJson(`/api/rentals/bookings/${encodeURIComponent(id)}/cancel`,{method:'POST',body:JSON.stringify({reason,accessToken:bookingAccessToken(id)})});
      showToast('Booking cancelled','success',1600);
      await loadUnifiedCustomerBookings();
      await refreshCardAvailability();
    }catch(err){showToast(err.message,'error',2200)}
  }));
  list.querySelectorAll('.v89-open-dispute').forEach(btn=>btn.addEventListener('click',async()=>{
    const bookingId=btn.dataset.id;
    const reason=prompt('What went wrong?','Item damaged / missing / payment / service issue');
    if(!reason?.trim()) return;
    const details=prompt('Add details (optional):','')||null;
    btn.disabled=true;
    try{
      await apiJson('/api/rentals/disputes',{
        method:'POST',
        body:JSON.stringify({bookingId,openedBy:'customer',reason:reason.trim(),details,accessToken:bookingAccessToken(bookingId)})
      });
      showToast('Problem reported. RentAll support can now review the case.','success',2200);
      btn.textContent='Problem reported';
      btn.disabled=true;
    }catch(err){
      const message=String(err.message||'Unable to report problem');
      if(/already open|DISPUTE_ALREADY_OPEN/i.test(message)){
        showToast('A dispute is already open for this booking.','error',2200);
        btn.textContent='Problem already reported';
        btn.disabled=true;
      }else{
        showToast(message,'error',2400);
        btn.disabled=false;
      }
    }
  }));
    list.querySelectorAll('.v88-revoke-guest').forEach(btn=>btn.addEventListener('click',async()=>{
    if(!confirm('Revoke the secure guest link for this booking? Anyone using the old link will lose access.')) return;
    btn.disabled=true;
    try{
      await apiJson(`/api/customer/bookings/${encodeURIComponent(btn.dataset.id)}/revoke-guest-link`,{method:'POST'});
      delete bookingAccessMap()[btn.dataset.id];
      const map=bookingAccessMap(); delete map[btn.dataset.id]; saveBookingAccessMap(map);
      showToast('Guest link revoked','success',1600);
      await loadUnifiedCustomerBookings();
    }catch(err){showToast(err.message||'Unable to revoke guest link','error',2200)}
    finally{btn.disabled=false}
  }));
    list.querySelectorAll('.v46-review-booking').forEach(btn=>btn.addEventListener('click',()=>{
    const form=document.getElementById('reviewForm');
    form?.reset();
    document.getElementById('reviewBookingId').value=btn.dataset.id;
    const modal=document.getElementById('reviewModal');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    setTimeout(()=>document.getElementById('reviewRating')?.focus(),0);
  }));
}

window.loadUnifiedCustomerBookings=loadUnifiedCustomerBookings;
loadCustomerBookings=loadUnifiedCustomerBookings;
loadCustomerBookingsSecure=loadUnifiedCustomerBookings;
document.getElementById('loadCustomerBookingsBtn')?.addEventListener('click',loadUnifiedCustomerBookings);
document.getElementById('refreshCustomerBookingsBtn')?.addEventListener('click',loadUnifiedCustomerBookings);

// --- V52: authentication ergonomics ---
for(const id of ['authEmail','loginEmail','registerEmail']){
  const el=document.getElementById(id);
  if(el){ el.autocomplete='email'; el.inputMode='email'; el.autocapitalize='none'; el.spellcheck=false; }
}
for(const id of ['loginPassword','authPassword']){
  const el=document.getElementById(id);
  if(el) el.autocomplete='current-password';
}
const registerPasswordV52=document.getElementById('registerPassword');
if(registerPasswordV52) registerPasswordV52.autocomplete='new-password';


// --- V56 customer experience shell: clearer discovery, mobile filter summary, trust copy ---
(function rentallV56CustomerUX(){
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>[...r.querySelectorAll(s)];

  function enhanceSearch(){
    const search=qs('#searchInput, input[type="search"], input[name="q"]');
    if(search){
      search.setAttribute('aria-label', search.getAttribute('aria-label') || 'Search rentals');
      search.setAttribute('autocomplete','off');
      search.setAttribute('enterkeyhint','search');
      if(!search.placeholder) search.placeholder='What do you need to rent?';
    }
    qsa('input[type="date"]').forEach(el=>{
      const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10);
      if(!el.min) el.min=tomorrow;
    });
  }

  function updateCustomerPromise(){
    const bar=qs('.v56-customer-promise');
    if(!bar) return;
    bar.innerHTML=`<span>✓ ${escapeHtml(uiText('Clear total price'))}</span><span>✓ ${escapeHtml(uiText('Secure booking record'))}</span><span>✓ ${escapeHtml(uiText('Pickup or delivery details before payment'))}</span>`;
  }

  function addCustomerPromise(){
    if(qs('.v56-customer-promise')){updateCustomerPromise();return;}
    const target=qs('main') || document.body;
    const bar=document.createElement('div');
    bar.className='v56-customer-promise';
    bar.setAttribute('role','note');
    target.prepend(bar);
    updateCustomerPromise();
  }

  function enhanceCards(){
    qsa('.listing-card,.card,[data-listing-id]').forEach(card=>{
      if(card.dataset.v56Enhanced) return;
      card.dataset.v56Enhanced='1';
      card.setAttribute('tabindex', card.getAttribute('tabindex') || '0');
      card.setAttribute('role', card.getAttribute('role') || 'group');
      const price=card.querySelector('.price,[data-price]');
      if(price && !/day|hour|week/i.test(price.textContent)) {
        price.setAttribute('aria-label','Rental price');
      }
    });
  }

  function mobileFilterSummary(){
    if(qs('.v56-mobile-summary')) return;
    const filters=qs('.filters,.search-filters,#filters');
    if(!filters) return;
    const summary=document.createElement('button');
    summary.type='button';
    summary.className='v56-mobile-summary';
    summary.textContent='Filters · location · dates · quantity';
    summary.setAttribute('aria-expanded','false');
    summary.onclick=()=>{
      const open=filters.classList.toggle('v56-mobile-open');
      summary.setAttribute('aria-expanded',String(open));
      summary.textContent=open?'Close filters':'Filters · location · dates · quantity';
    };
    filters.parentNode.insertBefore(summary,filters);
  }

  function observeResults(){
    const root=qs('#results,.results,.listings-grid') || document.body;
    new MutationObserver(()=>enhanceCards()).observe(root,{childList:true,subtree:true});
  }

  function init(){
    enhanceSearch(); addCustomerPromise(); enhanceCards(); mobileFilterSummary(); observeResults();
    document.addEventListener('rentall:language-changed',updateCustomerPromise);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();


// --- V81: canonical startup deep-link router ---
async function handleCustomerDeepLinkV81(){
  const qs=new URLSearchParams(window.location.search);
  const bookingId=String(qs.get('booking')||'').trim();
  const access=String(qs.get('access')||'').trim();
  const view=String(qs.get('view')||'').trim();
  const listingId=String(qs.get('listing')||'').trim();

  if(listingId){
    for(let attempt=0;attempt<12;attempt++){
      const listing=loadUniversalListings().find(l=>String(l.id)===listingId);
      if(listing){
        await openListingDetail(listingId);
        const clean=new URL(window.location.href);clean.searchParams.delete('listing');
        history.replaceState({},document.title,clean.pathname+clean.search+clean.hash);
        return;
      }
      await new Promise(resolve=>setTimeout(resolve,150));
    }
  }

  if(bookingId && access){
    // Persist the guest credential only in the existing per-booking access store.
    saveBookingAccess(bookingId,access);
    try{
      await apiJson(`/api/customer/bookings/${encodeURIComponent(bookingId)}?accessToken=${encodeURIComponent(access)}`);
      await loadUnifiedCustomerBookings();
      document.getElementById('myBookingsBtn')?.click();
      showToast('Secure booking opened','success',1600);
    }catch(err){
      showToast(err.message||'This secure booking link is invalid or has been revoked.','error',2600);
    }finally{
      // Remove the credential from the visible address bar/history after consumption.
      const clean=new URL(window.location.href);
      clean.searchParams.delete('access');
      clean.searchParams.delete('booking');
      history.replaceState({},document.title,clean.pathname+clean.search+clean.hash);
    }
    return;
  }

  if(view==='my-bookings'){
    await loadUnifiedCustomerBookings();
    document.getElementById('myBookingsBtn')?.click();
    const clean=new URL(window.location.href);
    clean.searchParams.delete('view');
    history.replaceState({},document.title,clean.pathname+clean.search+clean.hash);
    return;
  }

  if(view==='supplier-bookings'){
    await refreshServerUser();
    if(!currentSupplier?.()){
      showToast('Sign in as the supplier to open booking management.','error',2600);
      return;
    }
    await renderBookings();
    const bookingSection=document.getElementById('supplierBookingsSection')
      || document.getElementById('bookingFilter')?.closest('section')
      || document.getElementById('bookingFilter')?.parentElement;
    bookingSection?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
    document.getElementById('bookingFilter')?.focus({preventScroll:true});
    const clean=new URL(window.location.href);
    clean.searchParams.delete('view');
    history.replaceState({},document.title,clean.pathname+clean.search+clean.hash);
  }
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>handleCustomerDeepLinkV81().catch(()=>{}),{once:true});
}else{
  handleCustomerDeepLinkV81().catch(()=>{});
}

// V93 — live supplier command center
function updateSupplierCommandCenterV93(){
  const bookings=Array.isArray(liveSupplierBookings)?liveSupplierBookings:[];
  const pending=bookings.filter(b=>b.status==='pending');
  const confirmed=bookings.filter(b=>b.status==='confirmed');
  const active=bookings.filter(b=>b.status==='active');
  const returned=bookings.filter(b=>['returned','completed'].includes(b.status));
  const revenue=bookings.filter(b=>['confirmed','active','returned','completed'].includes(b.status))
    .reduce((sum,b)=>sum+Math.max(0,Number(b.orderValue||0)),0);
  const totalQty=bookings.reduce((sum,b)=>sum+Math.max(0,Number(b.quantity||0)),0);
  const busyQty=bookings.filter(b=>['confirmed','active'].includes(b.status))
    .reduce((sum,b)=>sum+Math.max(0,Number(b.quantity||0)),0);
  const util=totalQty?Math.round((busyQty/totalQty)*100):0;
  const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value};
  set('kpiRevenue',money(revenue)); set('kpiBookings',String(confirmed.length+active.length));
  set('kpiPending',String(pending.length)); set('kpiUtil',`${util}%`);
  set('v93PendingCount',String(pending.length));set('v93UpcomingCount',String(confirmed.length));
  set('v93ActiveCount',String(active.length));set('v93ReturnedCount',String(returned.length));
  set('kpiPendingNote',pending.length?`${pending.length} request${pending.length===1?'':'s'} need a decision`:'Nothing waiting');
  set('kpiBookingsNote',`${confirmed.length} confirmed · ${active.length} active`);
  set('kpiRevenueNote',`${bookings.length} live booking${bookings.length===1?'':'s'} tracked`);  window.dispatchEvent(new CustomEvent('rentall:supplier-bookings',{detail:{bookings:bookings.map(b=>({bookingId:b.bookingId,title:b.title,status:b.status,startDate:b.startDate,orderValue:Number(b.orderValue||0),platformFeeAmount:Number(b.platformFeeAmount||0),supplierAmount:Number(b.supplierAmount||0),paymentStatus:b.paymentStatus}))}}));
}
const v93RenderBookings=renderBookings;
renderBookings=async function(){
  await v93RenderBookings();
  updateSupplierCommandCenterV93();
};
document.querySelectorAll('[data-v93-filter]').forEach(card=>card.addEventListener('click',()=>{
  const filter=document.getElementById('bookingFilter');
  if(filter){filter.value=card.dataset.v93Filter;filter.dispatchEvent(new Event('change'))}
  document.getElementById('bookingTableBody')?.closest('.dashboard-panel')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
}));
document.getElementById('v93RefreshOps')?.addEventListener('click',()=>renderBookings());

// V94 — authoritative supplier inventory/pricing workspace
let v94SupplierListings=[];
async function loadSupplierInventoryV94(){
  const body=document.getElementById('v94InventoryBody'); if(!body) return;
  body.innerHTML='<tr><td colspan="7">Loading inventory…</td></tr>';
  try{
    const data=await apiJson('/api/supplier/listings');
    v94SupplierListings=Array.isArray(data.listings)?data.listings:[];
    const units=v94SupplierListings.reduce((n,l)=>n+Math.max(0,Number(l.quantity||0)),0);
    const capacity=v94SupplierListings.reduce((n,l)=>n+Math.max(0,Number(l.quantity||0))*Math.max(0,Number(l.priceDay||0)),0);
    const avg=v94SupplierListings.length?v94SupplierListings.reduce((n,l)=>n+Math.max(0,Number(l.priceDay||0)),0)/v94SupplierListings.length:0;
    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
    set('v94ListingCount',String(v94SupplierListings.length));set('v94UnitCount',String(units));set('v94AvgRate',money(avg));set('v94DailyCapacity',money(capacity));
    window.dispatchEvent(new CustomEvent('rentall:supplier-inventory',{detail:{listings:v94SupplierListings.map(l=>({id:l.id,title:l.title,status:l.status,active:l.active,quantity:Number(l.quantity||0),priceDay:Number(l.priceDay||0)}))}}));
    body.innerHTML=v94SupplierListings.map(l=>`<tr>
      <td><b>${escapeHtml(l.title||'Rental item')}</b><small>${escapeHtml(l.category||'')}</small></td>
      <td><b>${Math.max(0,Number(l.quantity||0))}</b> units</td>
      <td>${money(Number(l.priceDay||0))}</td><td>${Number(l.priceWeek||0)>0?money(Number(l.priceWeek)):'—'}</td>
      <td>${Number(l.deposit||0)>0?money(Number(l.deposit)):'None'}</td>
      <td>${escapeHtml([l.city,l.country].filter(Boolean).join(', ')||'—')}</td>
      <td><button class="secondary v94-calendar-jump" data-listing="${escapeHtml(l.id)}" type="button">Open calendar</button></td>
    </tr>`).join('')||'<tr><td colspan="7">No listings yet. Publish your first item to start renting.</td></tr>';
    document.querySelectorAll('.v94-calendar-jump').forEach(btn=>btn.addEventListener('click',()=>{
      const select=document.getElementById('supplierCalendarListing'); if(select){select.value=btn.dataset.listing;select.dispatchEvent(new Event('change'))}
      document.getElementById('supplierAvailabilitySection')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
    }));
  }catch(err){body.innerHTML=`<tr><td colspan="7">${escapeHtml(err.message||'Unable to load inventory')}</td></tr>`}
}
document.getElementById('v94RefreshInventory')?.addEventListener('click',loadSupplierInventoryV94);
const v94InitSupplierAvailability=initSupplierAvailability;
initSupplierAvailability=function(){v94InitSupplierAvailability();loadSupplierInventoryV94().catch(()=>{})};

// V95 — supplier earnings & payout forecast
const RENTALL_SUPPLIER_FEE_RATE_V95=0.15;
function supplierFinanceRowsV95(){
  const bookings=Array.isArray(liveSupplierBookings)?liveSupplierBookings:[];
  return bookings.filter(b=>['confirmed','active','returned','completed'].includes(b.status)).map(b=>{
    const gross=Math.max(0,Number(b.orderValue||0));
    const hasPaymentSplit=Number.isFinite(Number(b.platformFeeAmount)) && Number.isFinite(Number(b.supplierAmount)) &&
      (Number(b.platformFeeAmount)>0 || Number(b.supplierAmount)>0 || b.paymentStatus==='paid');
    const fee=hasPaymentSplit?Math.max(0,Number(b.platformFeeAmount||0)):gross*RENTALL_SUPPLIER_FEE_RATE_V95;
    const net=hasPaymentSplit?Math.max(0,Number(b.supplierAmount||0)):Math.max(0,gross-fee);
    return {booking:b,gross,fee,net,authoritative:hasPaymentSplit};
  });
}
function renderSupplierFinanceV95(){
  const body=document.getElementById('v95LedgerBody');if(!body)return;
  const rows=supplierFinanceRowsV95();
  const gross=rows.reduce((s,r)=>s+r.gross,0);
  const completed=rows.filter(r=>['returned','completed'].includes(r.booking.status)).reduce((s,r)=>s+r.gross,0);
  const progress=rows.filter(r=>['confirmed','active'].includes(r.booking.status)).reduce((s,r)=>s+r.gross,0);
  const fees=rows.reduce((s,r)=>s+r.fee,0),net=rows.reduce((s,r)=>s+r.net,0);
  const authoritativeCount=rows.filter(r=>r.authoritative).length;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
  set('v95Gross',money(gross));set('v95Completed',money(completed));set('v95InProgress',money(progress));set('v95Fees',money(fees));set('v95Net',money(net));
  set('v95FeeNote',authoritativeCount===rows.length && rows.length
    ?'Using recorded payment splits'
    :`${authoritativeCount}/${rows.length} from payment records · remaining rows forecast at ${(RENTALL_SUPPLIER_FEE_RATE_V95*100).toFixed(0)}%`);
  set('v95LedgerSummary',`${rows.length} booking${rows.length===1?'':'s'}`);
  body.innerHTML=rows.length?rows.slice().sort((x,y)=>String(y.booking.startDate||'').localeCompare(String(x.booking.startDate||''))).slice(0,8).map(r=>`<tr><td><b>${escapeHtml(r.booking.bookingId||'—')}</b><small>${escapeHtml(r.booking.title||'Rental item')}</small></td><td><span class="status ${escapeHtml(r.booking.status)}">${escapeHtml(r.booking.status)}</span></td><td>${escapeHtml(r.booking.startDate||'—')} → ${escapeHtml(r.booking.endDate||'—')}</td><td>${money(r.gross)}</td><td>${money(r.fee)}</td><td><b>${money(r.net)}</b><small>${r.authoritative?'Recorded split':'Forecast'}</small></td></tr>`).join(''):'<tr><td colspan="6">No earnings activity yet.</td></tr>';
}
document.getElementById('v95OpenPayouts')?.addEventListener('click',()=>document.getElementById('openPaymentsPanel')?.click());
const v95RenderBookings=renderBookings;
renderBookings=async function(){await v95RenderBookings();renderSupplierFinanceV95()};
setTimeout(renderSupplierFinanceV95,0);

function renderMapListingPreviewV101(listing){
 const rail=document.getElementById('v101MapRail');if(!rail||!listing)return;
 const distance=listing._distanceKm!=null?`${listing._distanceKm.toFixed(1)} km away`:'';
 rail.innerHTML=`<article class="v101-map-card"><div class="v101-map-card-visual">${listing.category==='Photo & video'?'📷':listing.category==='Tools & equipment'?'🛠️':listing.category==='Transport'?'🚲':'📦'}</div><div class="eyebrow">${escapeHtml(listing.category||'Rental')}</div><h3>${escapeHtml(listing.title)}</h3><p>${escapeHtml([listing.city,listing.country].filter(Boolean).join(', '))}${distance?` · ${escapeHtml(distance)}`:''}</p><div class="v101-map-price"><b>€${Number(listing.priceDay||0).toFixed(2)}</b><span>/ day</span></div><div class="v101-map-tags"><span>✓ Secure booking</span><span>${listing.deliveryEnabled?'Delivery available':'Pickup'}</span></div><button class="primary" type="button" id="v101MapOpenListing">View rental</button></article>`;
 rail.querySelector('#v101MapOpenListing')?.addEventListener('click',()=>openListingDetail(listing.id));
}


// --- V124: supplier dashboard command navigation ---
(function(){
  function targetFor(key){
    const el=document.getElementById(key);
    if(!el)return null;
    if(key==='v94InventoryBody'||key==='bookingTableBody') return el.closest('.dashboard-panel')||el;
    return el;
  }
  function init(){
    document.querySelectorAll('[data-v124-target]').forEach(btn=>btn.addEventListener('click',()=>{
      const target=targetFor(btn.dataset.v124Target);
      if(btn.dataset.v124Target==='supplierPaymentsPanel'){
        document.getElementById('supplierPaymentsBtn')?.click();
      }
      target?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
      document.querySelectorAll('[data-v124-target]').forEach(x=>x.classList.toggle('active',x===btn));
    }));
    const pending=document.getElementById('v93PendingCount');
    const bookingsBtn=document.querySelector('[data-v124-target="bookingTableBody"]');
    if(pending&&bookingsBtn){new MutationObserver(()=>bookingsBtn.classList.toggle('attention',Number(pending.textContent||0)>0)).observe(pending,{childList:true,characterData:true,subtree:true});}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();


// --- V176: public focus + compact supplier dashboard ---
(function rentAllV176SupplierUi(){
  const dashboard=document.getElementById('supplier-dashboard');
  const toggle=document.getElementById('supplierDashboardToggle');
  const switcher=document.getElementById('supplierViewSwitch');
  if(!dashboard || !toggle) return;

  function tr(key,fallback){
    try{return window.RentAllI18n?.keyTranslations?.[window.RentAllI18n.getLanguage()]?.[key] || fallback;}catch{return fallback;}
  }
  function setExpanded(expanded,{persist=true}={}){
    dashboard.classList.toggle('dashboard-expanded',expanded);
    toggle.setAttribute('aria-expanded',String(expanded));
    toggle.dataset.i18n=expanded?'supplier_panel_hide':'supplier_panel_show';
    toggle.textContent=expanded?tr('supplier_panel_hide','Hide dashboard'):tr('supplier_panel_show','Show dashboard');
    if(switcher) switcher.hidden=!expanded;
    if(persist){try{localStorage.setItem('rentall_supplier_dashboard_open',expanded?'1':'0')}catch{}}
  }
  function setView(view,{persist=true}={}){
    const next=view==='list'?'list':'grid';
    dashboard.classList.toggle('supplier-view-list',next==='list');
    dashboard.classList.toggle('supplier-view-grid',next==='grid');
    dashboard.querySelectorAll('[data-supplier-view]').forEach(btn=>{
      const active=btn.dataset.supplierView===next;
      btn.classList.toggle('active',active);
      btn.setAttribute('aria-pressed',String(active));
    });
    if(persist){try{localStorage.setItem('rentall_supplier_dashboard_view',next)}catch{}}
  }
  toggle.addEventListener('click',()=>setExpanded(!dashboard.classList.contains('dashboard-expanded')));
  switcher?.addEventListener('click',e=>{
    const btn=e.target.closest('[data-supplier-view]');
    if(btn) setView(btn.dataset.supplierView);
  });
  document.addEventListener('rentall:language-changed',()=>setExpanded(dashboard.classList.contains('dashboard-expanded'),{persist:false}));
  let savedOpen='0', savedView='grid';
  try{savedOpen=localStorage.getItem('rentall_supplier_dashboard_open')||'0';savedView=localStorage.getItem('rentall_supplier_dashboard_view')||'grid'}catch{}
  setView(savedView,{persist:false});
  setExpanded(savedOpen==='1',{persist:false});

  const previous=window.refreshAuthUI || refreshAuthUI;
  if(typeof previous==='function'){
    refreshAuthUI=function(){
      const result=previous.apply(this,arguments);
      const active=!!currentSupplier?.();
      document.body.classList.toggle('supplier-authenticated',active);
      if(!active) setExpanded(false,{persist:false});
      return result;
    };
    refreshAuthUI();
  }
})();
