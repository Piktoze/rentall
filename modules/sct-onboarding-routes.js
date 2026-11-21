// The only accepted principal is the application's verified server session.
export function installSctOnboardingRoutes(app,{enabled,getService,requireRole,allowed=()=>true,rateLimit=(req,res,next)=>next()}){
 const route=(method,path,action)=>app[method](path,requireRole('supplier','admin'),rateLimit,async(req,res,next)=>{
  if(!enabled())return next();
  if(!allowed(req))return res.status(403).json({code:'ONBOARDING_PILOT_SUPPLIER_NOT_ALLOWLISTED'});
  res.set('Cache-Control','private, no-store');
  try{const service=await getService();res.json(await service[action](req.appUser,action==='create'?req.body||{}:undefined));}
  catch(error){const code=/^(SCT_|COMMERCIAL_)[A-Z0-9_]+$/.test(error.code||'')?error.code:'SCT_ONBOARDING_PROVIDER_UNAVAILABLE';res.status(409).json({code,error:'Stripe onboarding requires review or another attempt.'});}
 });
 route('post','/api/stripe/connect/create-account','create');
 route('get','/api/stripe/connect/status','status');
 route('post','/api/stripe/connect/hosted-onboarding-link','hostedLink');
 route('post','/api/stripe/connect/onboarding-link','session');
 route('post','/api/stripe/connect/login-link','dashboard');
}
