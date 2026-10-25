
// V125 customer payment truthfulness.
function customerPaymentStateCopy(booking){
 const state=String(booking?.paymentStatus||booking?.payment_status||'unpaid');
 if(state==='paid')return ['Payment confirmed','Your rental payment is confirmed.'];
 if(state==='partially_refunded')return ['Partially refunded','Part of this payment has been refunded.'];
 if(state==='refunded')return ['Payment refunded','This rental payment has been refunded.'];
 if(state==='processing')return ['Payment processing','Do not pay again while Stripe is processing this payment.'];
 return ['Payment not confirmed','No successful rental payment is recorded yet.'];
}
function customerDepositStateCopy(booking){
 const state=String(booking?.securityDepositStatus||booking?.depositStatus||booking?.deposit_status||'not_required');
 if(state==='authorized')return 'Deposit authorized — not charged unless a valid claim is made.';
 if(state==='captured')return 'Security deposit captured.';
 if(state==='released'||state==='canceled')return 'Deposit authorization released.';
 return 'No active security-deposit authorization.';
}

async function loadProductionReadiness(){try{const r=await fetch('/api/readiness',{credentials:'same-origin',cache:'no-store'});const d=await r.json();return {ready:Boolean(d.ready),environment:d.environment||'development',missing:Object.entries(d.checks||{}).filter(([,ok])=>!ok).map(([k])=>k)}}catch{return {ready:false,environment:'unknown',missing:['readinessEndpoint']}}}

window.customerBookingFilter='upcoming';
window.customerBookingBucket=b=>{const s=String(b?.status||'pending');return ['active','returned'].includes(s)?'active':['completed','cancelled','declined'].includes(s)?'past':'upcoming'};
window.customerBookingNextAction=b=>{const s=String(b?.status||'pending'),p=String(b?.paymentStatus||b?.payment_status||'unpaid');if(p==='processing')return'Payment is processing — do not pay again while Stripe is processing this payment.';if(p==='unpaid'||p==='requires_payment_method')return'Complete payment to secure this rental.';return s==='pending'?'Waiting for supplier confirmation.':s==='confirmed'?'Confirmed — check pickup or delivery details before the rental.':s==='active'?'Rental in progress — keep the item safe until return.':s==='returned'?'Item returned — waiting for completion.':s==='completed'?'Rental completed. You can leave a review.':s==='cancelled'?'Booking cancelled. Check payment status for any refund.':'Check this booking for the latest status.'};
window.customerBookingPaymentCopy=b=>{const s=String(b?.paymentStatus||b?.payment_status||'unpaid');return s==='paid'?'Paid':s==='processing'?'Processing — do not pay again':s==='partially_refunded'?'Partially refunded':s==='refunded'?'Refunded':'Not confirmed'};
window.customerBookingDepositCopy=b=>{const s=String(b?.securityDepositStatus||b?.depositStatus||b?.deposit_status||'not_required');return s==='authorized'?'Authorized, not charged':s==='captured'?'Captured':(s==='released'||s==='canceled')?'Released':'No active deposit'};
document.addEventListener('click',e=>{const b=e.target.closest('[data-customer-booking-filter]');if(!b)return;window.customerBookingFilter=b.dataset.customerBookingFilter||'upcoming';document.querySelectorAll('[data-customer-booking-filter]').forEach(x=>x.classList.toggle('active',x===b));window.loadUnifiedCustomerBookings?.()});
