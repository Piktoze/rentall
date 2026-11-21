import {createSctSupplierOnboarding} from './sct-supplier-onboarding.js';
// No payment/transfer/refund methods and no financial worker are constructed here.
export async function createOnboardingOnly({db,stripe,env}){
 if(env.CONNECT_ONBOARDING_ONLY_ENABLED!=='true'||env.COMMERCIAL_SCT_RUNTIME_ENABLED==='true'||env.PRIVATE_TEST_ENABLED==='true'||env.RENTINORBIT_SCT_TEST_RUNTIME==='true')throw Error('CONNECT_ONBOARDING_ONLY_CONFIGURATION_INVALID');
 if(!/^acct_[A-Za-z0-9]+$/.test(env.COMMERCIAL_STRIPE_PLATFORM_ACCOUNT_ID||''))throw Error('CONNECT_PLATFORM_PIN_REQUIRED');
 if(db.prepare("SELECT 1 FROM sqlite_master WHERE name='rental_bookings'").get()&&db.prepare('SELECT 1 FROM rental_bookings LIMIT 1').get())throw Error('CONNECT_ONBOARDING_ONLY_NEW_STORE_REQUIRED');
 const runtime={registerRecipient:async()=>({onboardingOnly:true}),newBookingRecipient:()=>{throw Error('CONNECT_NO_FINANCIAL_BINDING');}};
 return createSctSupplierOnboarding({db,stripe,env:{...env,CONNECT_ONBOARDING_ONLY_ENABLED:'true'},runtime});
}
export function onboardingOnlyWriteGuard(enabled){return (req,res,next)=>{
 if(enabled&&['POST','PUT','PATCH','DELETE'].includes(req.method)&&!req.path.startsWith('/auth/')&&req.path!=='/stripe/webhook'&&!/^\/stripe\/connect\/(create-account|hosted-onboarding-link|onboarding-link|login-link)$/.test(req.path))return res.status(403).json({code:'ONBOARDING_ONLY_FINANCIAL_ACTIONS_DISABLED'});
 next();
};}
