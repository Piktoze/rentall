// V110 — supplier onboarding continuation
(function supplierOnboardingV110(){
 const form=document.getElementById('supplierRegisterForm');if(!form)return;
 form.addEventListener('submit',()=>{form.dataset.onboardingAttempt='1'});
 const msg=document.getElementById('registerMsg');
 if(msg&&window.MutationObserver)new MutationObserver(()=>{
   if(form.dataset.onboardingAttempt==='1' && /success|created|welcome|registered/i.test(msg.textContent||'')){
     form.dataset.onboardingAttempt='done';
     setTimeout(()=>document.getElementById('openListingFormBtn')?.click(),450);
   }
 }).observe(msg,{childList:true,subtree:true,characterData:true});
})();
