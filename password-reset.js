// Tokens stay in the URL fragment (never in the HTTP URL or request logs).
const token=new URLSearchParams(location.hash.slice(1)).get('token');
history.replaceState(null,'',location.pathname);
const form=document.querySelector('form'),message=document.querySelector('[role="status"]');
document.querySelector('#resetEmail').closest('label').hidden=!!token;
document.querySelector('#resetPassword').closest('label').hidden=!token;
document.querySelector('#resetEmail').required=!token;
document.querySelector('#resetPassword').required=!!token;
form.addEventListener('submit',async event=>{
 event.preventDefault();const button=form.querySelector('button');button.disabled=true;
 try{
  const response=await fetch(token?'/api/auth/reset-password':'/api/auth/forgot-password',{
   method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',
   body:JSON.stringify(token?{token,password:document.querySelector('#resetPassword').value}:{email:document.querySelector('#resetEmail').value})});
  const result=await response.json();message.textContent=result.message||result.error||'Bandykite vėliau.';
  if(response.ok&&token){form.hidden=true;document.querySelector('#resetPassword').value='';}
 }catch{message.textContent='Ryšio klaida. Bandykite vėliau.';}finally{button.disabled=false;}
});
