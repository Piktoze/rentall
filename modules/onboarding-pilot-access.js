import crypto from 'node:crypto';
export function onboardingPilotAccess(env=process.env){
 if(env.CONNECT_ONBOARDING_ONLY_ENABLED!=='true')return (req,res,next)=>next();
 const hash=String(env.CONNECT_ONBOARDING_ACCESS_SHA256||'');
 if(!/^[a-f0-9]{64}$/.test(hash))throw Error('ONBOARDING_PILOT_PRIVATE_ACCESS_REQUIRED');
 const expected=Buffer.from(hash,'hex');
 return (req,res,next)=>{
  if(req.path==='/healthz')return next();
  const header=String(req.headers.authorization||'');let candidate='';
  if(header.startsWith('Basic ')&&header.length<1500){const decoded=Buffer.from(header.slice(6),'base64').toString('utf8');if(decoded.startsWith('rentinorbit:'))candidate=decoded.slice(12);}
  if(candidate&&crypto.timingSafeEqual(crypto.createHash('sha256').update(candidate).digest(),expected))return next();
  res.set('Cache-Control','private, no-store');res.set('WWW-Authenticate','Basic realm="RentInOrbit private onboarding", charset="UTF-8"');res.status(401).send('Privati RentInOrbit prijungimo peržiūra. Reikalinga suteikta prieiga.');
 };
}
export function onboardingPilotSupplierAllowed(req,env=process.env){
 if(env.CONNECT_ONBOARDING_ONLY_ENABLED!=='true')return true;
 const allowed=String(env.CONNECT_ONBOARDING_ALLOWED_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 return allowed.length>0&&allowed.length<=5&&allowed.includes(String(req.appUser?.email||'').toLowerCase());
}
