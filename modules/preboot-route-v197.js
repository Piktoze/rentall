// Prevent homepage flash while an incoming deep link is resolving.
// This is a presentation guard, not a substitute for canonical route handling.
try {
  const qs=new URLSearchParams(window.location.search);
  if(qs.has('booking') || qs.has('view') || qs.has('listing')){
    document.documentElement.classList.add('rentinorbit-route-loading');
    window.setTimeout(()=>document.documentElement.classList.remove('rentinorbit-route-loading'),8000);
  }
}catch{}
