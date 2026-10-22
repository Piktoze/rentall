// V102 — customer notification center
async function loadCustomerNotificationsV102(){
 if(!currentServerUser)return [];
 try{const r=await apiJson('/api/customer/notifications');return Array.isArray(r.notifications)?r.notifications:[]}catch{return []}
}
async function renderCustomerNotificationsV102(open=false){
 const items=await loadCustomerNotificationsV102(), unread=items.filter(n=>!n.readAt);
 const badge=document.getElementById('v102NotificationBadge');if(badge){badge.textContent=String(unread.length);badge.hidden=!unread.length}
 const list=document.getElementById('v102NotificationList');if(list)list.innerHTML=items.length?items.map(n=>`<button type="button" class="v102-notification ${n.readAt?'':'unread'}" data-notification-id="${escapeHtml(n.notificationId)}" data-booking-id="${escapeHtml(n.bookingId||'')}"><span class="v102-dot"></span><span><b>${escapeHtml(n.title)}</b><small>${escapeHtml(n.message)}</small><time>${escapeHtml(n.createdAt?new Date(n.createdAt).toLocaleString():'')}</time></span></button>`).join(''):'<div class="v102-empty">You’re all caught up.</div>';
 if(open){const panel=document.getElementById('v102NotificationPanel');if(panel){panel.hidden=false;panel.setAttribute('aria-hidden','false')}}
 list?.querySelectorAll('.v102-notification').forEach(btn=>btn.addEventListener('click',async()=>{try{await apiJson(`/api/customer/notifications/${encodeURIComponent(btn.dataset.notificationId)}/read`,{method:'POST'});}catch{}btn.classList.remove('unread');if(btn.dataset.bookingId){await loadUnifiedCustomerBookings?.();document.getElementById('myBookingsBtn')?.click()}renderCustomerNotificationsV102(false)}));
}
document.getElementById('v102NotificationBtn')?.addEventListener('click',()=>renderCustomerNotificationsV102(true));
document.getElementById('v102CloseNotifications')?.addEventListener('click',()=>{const p=document.getElementById('v102NotificationPanel');if(p){p.hidden=true;p.setAttribute('aria-hidden','true')}});
setTimeout(()=>renderCustomerNotificationsV102(false),500);
