// V109 — production-facing product polish
(function productPolishV109(){
 const auth=document.getElementById('authModal');
 if(auth) auth.setAttribute('data-product-state','production-facing');
 document.querySelectorAll('[data-mobile-section]').forEach(el=>el.setAttribute('aria-label',el.textContent.trim()));
 const checkout=document.getElementById('bookingModal');
 if(checkout) checkout.setAttribute('aria-label','Rental booking and secure checkout');
})();
