// V172 — marketplace trust layer: conversations, agreements, two-sided reputation and shareable listing URLs.
(function marketplaceTrustV172(){
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const call=async(url,options={})=>{
    if(typeof apiJson==='function') return apiJson(url,options);
    const response=await fetch(url,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.error||`Request failed (${response.status})`);
    return data;
  };
  const toast=(message,type='success')=>typeof showToast==='function'?showToast(message,type,2200):alert(message);
  const tr=key=>window.RentAllI18n?.t?.(key)||key;
  const slug=value=>String(value||'rental').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'rental';
  let activeConversationId=null;
  let activeConversation=null;
  let cachedUser=undefined;

  async function getUser(force=false){
    if(!force&&cachedUser!==undefined)return cachedUser;
    try{cachedUser=(await call('/api/auth/me')).user||null;}catch{cachedUser=null;}
    syncHeaderAccountState();
    return cachedUser;
  }
  function syncHeaderAccountState(){
    const button=$('messagesBtn');
    if(button)button.hidden=!cachedUser;
  }

  function ensureBodyPortal(id){const m=$(id);if(m&&m.parentElement!==document.body)document.body.appendChild(m);return m;}
  function openModal(id){const m=ensureBodyPortal(id);if(!m)return;m.classList.add('open');m.setAttribute('aria-hidden','false');document.body.classList.add('modal-open');}
  function closeModal(id){const m=$(id);if(!m)return;m.classList.remove('open');m.setAttribute('aria-hidden','true');if(!document.querySelector('.availability-modal.open,.account-modal.open,.auth-modal.open'))document.body.classList.remove('modal-open');}

  async function loadConversations(selectId=null){
    const list=$('conversationList');if(!list)return;
    const user=await getUser(true);
    if(!user){list.innerHTML=`<p class="muted">${esc(tr('Log in to use RentAll messages.'))}</p>`;return;}
    list.innerHTML='<p class="muted">Loading conversations…</p>';
    try{
      const data=await call('/api/conversations');
      const rows=data.conversations||[];
      list.innerHTML=rows.length?rows.map(c=>{
        const counterpart=String(user.email||'').toLowerCase()===String(c.customerEmail||'').toLowerCase()?c.supplierEmail:c.customerEmail;
        return `<button type="button" class="conversation-row ${String(c.conversationId)===String(selectId||activeConversationId)?'active':''}" data-conversation-id="${esc(c.conversationId)}"><b>${esc(c.listingTitle||tr('Rental'))}</b><span>${esc(counterpart||'RentAll user')}</span><small>${esc(c.lastMessage||tr('No messages yet'))}</small></button>`;
      }).join(''):`<p class="muted">${esc(tr('No conversations yet. Open a listing and choose “Message supplier”.'))}</p>`;
      list.querySelectorAll('[data-conversation-id]').forEach(btn=>btn.addEventListener('click',()=>openConversation(btn.dataset.conversationId)));
      const desired=selectId||activeConversationId;
      if(desired&&rows.some(c=>String(c.conversationId)===String(desired)))await openConversation(desired,false);
    }catch(err){list.innerHTML=`<p class="muted">${esc(err.message)}</p>`;}
  }

  async function openConversation(conversationId,reloadList=true){
    const messageList=$('messageList'),form=$('messageForm'),title=$('conversationTitle');
    if(!messageList||!form)return;
    try{
      const data=await call(`/api/conversations/${encodeURIComponent(conversationId)}/messages`);
      activeConversationId=conversationId;activeConversation=data.conversation;
      if(title)title.textContent=tr('Conversation');
      const user=await getUser();
      messageList.innerHTML=(data.messages||[]).length?(data.messages||[]).map(m=>{
        const mine=String(m.senderEmail||'').toLowerCase()===String(user?.email||'').toLowerCase();
        return `<div class="message-bubble ${mine?'mine':'theirs'}"><small>${mine?esc(tr('You')):esc(tr(m.senderRole==='supplier'?'Supplier':'Renter'))} · ${esc(new Date(m.createdAt).toLocaleString())}</small><p>${esc(m.body)}</p></div>`;
      }).join(''):`<p class="muted">${esc(tr('No messages yet. Ask about the item, pickup or booking details.'))}</p>`;
      form.hidden=false;
      messageList.scrollTop=messageList.scrollHeight;
      if(reloadList)loadConversations(conversationId).catch(()=>{});
    }catch(err){messageList.innerHTML=`<p class="muted">${esc(err.message)}</p>`;form.hidden=true;}
  }

  async function startConversation(listingId,bookingId=null){
    const user=await getUser(true);
    if(!user){
      toast('Log in or create a renter account to message a supplier.','error');
      $('supplierAuthBtn')?.click();
      return;
    }
    try{
      const data=await call('/api/conversations',{method:'POST',body:JSON.stringify({listingId,bookingId})});
      activeConversationId=data.conversation.conversationId;
      openModal('messagesModal');
      await loadConversations(activeConversationId);
      setTimeout(()=>$('messageBody')?.focus(),0);
    }catch(err){toast(err.message,'error');}
  }

  async function openMessages(){openModal('messagesModal');await loadConversations();}
  window.RentAllMessages={open:openMessages,close:()=>closeModal('messagesModal'),reload:loadConversations};
  $('messagesBtn')?.addEventListener('click',openMessages);
  $('closeMessagesModal')?.addEventListener('click',()=>closeModal('messagesModal'));
  $('messageForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const body=$('messageBody')?.value?.trim();if(!body||!activeConversationId)return;
    const button=e.submitter;if(button)button.disabled=true;
    try{
      await call(`/api/conversations/${encodeURIComponent(activeConversationId)}/messages`,{method:'POST',body:JSON.stringify({body})});
      $('messageBody').value='';
      await openConversation(activeConversationId);
    }catch(err){toast(err.message,'error');}
    finally{if(button)button.disabled=false;}
  });

  async function openAgreement(bookingId){
    try{
      const token=typeof bookingAccessToken==='function'?bookingAccessToken(bookingId):'';
      const qs=token?`?accessToken=${encodeURIComponent(token)}`:'';
      const data=await call(`/api/rentals/bookings/${encodeURIComponent(bookingId)}/agreement${qs}`);
      const a=data.agreement,s=a.snapshot||{};
      const content=$('agreementContent');
      content.innerHTML=`<div class="agreement-status-grid"><div><span>Agreement</span><b>${esc(a.agreementId)}</b></div><div><span>Version</span><b>${esc(a.termsVersion)}</b></div><div><span>Renter accepted</span><b>${a.customerAcceptedAt?'✓ '+esc(new Date(a.customerAcceptedAt).toLocaleString()):'Pending'}</b></div><div><span>Supplier accepted</span><b>${a.supplierAcceptedAt?'✓ '+esc(new Date(a.supplierAcceptedAt).toLocaleString()):'Pending confirmation'}</b></div></div><div class="review-card"><h3>${esc(s.listingTitle||'Rental item')}</h3><div class="review-row"><span>Rental dates</span><b>${esc(s.startDate||'—')} → ${esc(s.endDate||'—')}</b></div><div class="review-row"><span>Quantity</span><b>${esc(s.quantity||1)}</b></div><div class="review-row"><span>Rental</span><b>€${Number(s.rentalAmount||0).toFixed(2)}</b></div><div class="review-row"><span>Delivery</span><b>€${Number(s.deliveryFee||0).toFixed(2)}</b></div><div class="review-row total"><span>Total</span><b>€${Number(s.total||0).toFixed(2)}</b></div><div class="review-row"><span>Security deposit</span><b>€${Number(s.securityDeposit||0).toFixed(2)}</b></div><div class="review-row"><span>Cancellation</span><b>${esc(s.cancellationPolicy||'moderate')}</b></div></div><div class="agreement-terms"><h3>Rental commitments</h3><ol>${(s.terms||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ol></div><p class="muted">This agreement is a timestamped record of the booking terms accepted through RentAll.</p>`;
      openModal('agreementModal');
    }catch(err){toast(err.message,'error');}
  }
  $('closeAgreementModal')?.addEventListener('click',()=>closeModal('agreementModal'));

  // Customer booking actions are re-rendered dynamically, so use delegation.
  document.addEventListener('click',e=>{
    const agreement=e.target.closest('.v172-view-agreement');if(agreement){openAgreement(agreement.dataset.id);return;}
    const message=e.target.closest('.v172-booking-message');if(message){startConversation(message.dataset.listingId,message.dataset.id);return;}
    const renterReview=e.target.closest('.v172-rate-renter');if(renterReview){
      $('renterReviewBookingId').value=renterReview.dataset.id;$('renterReviewForm')?.reset();$('renterReviewBookingId').value=renterReview.dataset.id;openModal('renterReviewModal');
    }
  });

  $('closeRenterReviewModal')?.addEventListener('click',()=>closeModal('renterReviewModal'));
  $('renterReviewForm')?.addEventListener('submit',async e=>{
    e.preventDefault();const bookingId=$('renterReviewBookingId').value;
    try{
      await call(`/api/supplier/bookings/${encodeURIComponent(bookingId)}/customer-review`,{method:'POST',body:JSON.stringify({rating:Number($('renterReviewRating').value),comment:$('renterReviewComment').value.trim()})});
      closeModal('renterReviewModal');toast('Renter review published.');
      if(typeof openLiveSupplierOrder==='function')openLiveSupplierOrder(bookingId);
    }catch(err){toast(err.message,'error');}
  });

  // Enrich listing detail without changing booking/availability authority.
  if(typeof openListingDetail==='function'){
    const baseOpenListingDetail=openListingDetail;
    openListingDetail=async function(listingId){
      await baseOpenListingDetail(listingId);
      const root=$('listingDetailContent');if(!root||root.querySelector('.v172-marketplace-trust'))return;
      const listing=typeof loadUniversalListings==='function'?loadUniversalListings().find(l=>String(l.id)===String(listingId)):null;
      let reputation={reviewCount:0,averageRating:null};
      try{reputation=(await call(`/api/listings/${encodeURIComponent(listingId)}/reputation`)).supplier||reputation;}catch{}
      const panel=document.createElement('section');panel.className='v172-marketplace-trust';
      const rc=Number(reputation.reviewCount||0);
      const rating=reputation.averageRating?`★ ${Number(reputation.averageRating).toFixed(1)} · ${rc} ${tr(rc===1?'verified rental':'verified rentals')}`:tr('New supplier on RentAll');
      const url=`/listing/${encodeURIComponent(listingId)}/${slug(listing?.title)}`;
      panel.innerHTML=`<div><small>Supplier reputation</small><strong>${esc(rating)}</strong><span>Reviews come from completed rentals.</span></div><div class="v172-trust-actions"><button type="button" class="secondary" id="v172MessageSupplier">Message supplier</button><a class="secondary" href="${esc(url)}">Share listing</a></div>`;
      const main=root.querySelector('.v92-listing-main')||root;main.appendChild(panel);
      panel.querySelector('#v172MessageSupplier')?.addEventListener('click',()=>startConversation(listingId));
    };
  }

  // Enrich supplier booking modal with renter reputation, agreement and post-rental rating.
  if(typeof openLiveSupplierOrder==='function'){
    const baseOpenLiveSupplierOrder=openLiveSupplierOrder;
    openLiveSupplierOrder=async function(bookingId){
      baseOpenLiveSupplierOrder(bookingId);
      const booking=Array.isArray(liveSupplierBookings)?liveSupplierBookings.find(x=>String(x.bookingId)===String(bookingId)):null;
      const summary=$('supplierOrderSummary'),actions=$('supplierOrderActions');if(!booking||!summary||!actions)return;
      let rep={summary:{reviewCount:0,averageRating:null}},agreement=null;
      try{rep=await call(`/api/supplier/bookings/${encodeURIComponent(bookingId)}/customer-reputation`);}catch{}
      try{agreement=(await call(`/api/rentals/bookings/${encodeURIComponent(bookingId)}/agreement`)).agreement;}catch{}
      const count=Number(rep.customer?.summary?.reviewCount||0),avg=rep.customer?.summary?.averageRating;
      const card=document.createElement('div');card.className='supplier-order-card v172-renter-trust';
      card.innerHTML=`<h3>Renter trust</h3><div class="supplier-order-grid"><div><span>Renter rating</span><b>${avg?`★ ${Number(avg).toFixed(1)} · ${count} ${tr(count===1?'review':'reviews')}`:tr('New renter')}</b></div><div><span>Rental agreement</span><b>${agreement?.supplierAcceptedAt?'Accepted by both sides':agreement?.customerAcceptedAt?'Renter accepted · supplier pending':'Pending'}</b></div></div>`;
      summary.appendChild(card);
      const controls=document.createElement('div');controls.className='v172-supplier-trust-actions';
      controls.innerHTML=`<button class="secondary" type="button" data-v172-supplier-message>Messages</button><button class="secondary" type="button" data-v172-supplier-agreement>View agreement</button>${['returned','completed'].includes(booking.status)?'<button class="secondary v172-rate-renter" type="button" data-id="'+esc(bookingId)+'">Rate renter</button>':''}`;
      actions.appendChild(controls);
      controls.querySelector('[data-v172-supplier-message]')?.addEventListener('click',()=>startConversation(booking.listingId,bookingId));
      controls.querySelector('[data-v172-supplier-agreement]')?.addEventListener('click',()=>openAgreement(bookingId));
    };
  }

  // Keep legal links in the selected UI language.
  function updateLegalLinks(){
    const lang=window.RentAllI18n?.getLanguage?.()||'lt';
    document.querySelectorAll('[data-legal-link]').forEach(a=>a.href=`${a.dataset.legalLink}?lang=${encodeURIComponent(lang)}`);
  }
  document.addEventListener('rentall:language-changed',updateLegalLinks);
  updateLegalLinks();

  // Refresh account state after login/register/logout events and ordinary UI changes.
  getUser(true).catch(()=>{});
  const accountObserver=new MutationObserver(()=>getUser(true).catch(()=>{}));
  const authButton=$('supplierAuthBtn');if(authButton)accountObserver.observe(authButton,{childList:true,subtree:true,characterData:true});
})();
