import {privateTestSettings} from './private-test-mode.js';

// Owner-only bridge to the existing synthetic TEST account. Never accepts terms,
// creates an account, changes identity/bank data or moves money.
export function installPrivateTestRecipientOnboarding(app,{env=process.env,getStripe}={}){
 if(env.PRIVATE_TEST_ENABLED!=='true')return;
 app.post('/__test-access/stripe-recipient',async(req,res)=>{
  res.set('Cache-Control','private, no-store').set('Referrer-Policy','no-referrer');
  const settings=privateTestSettings(env);
  if(!settings.valid)return res.status(503).json({code:'PRIVATE_TEST_CONFIGURATION_REQUIRED'});
  if(req.get('origin')!==new URL(env.APP_URL).origin)return res.status(403).json({code:'ORIGIN_REQUIRED'});
  if(req.privateTestIdentity?.email!==settings.owner)return res.status(403).json({code:'PRIVATE_TEST_OWNER_REQUIRED'});
  const id=String(env.PRIVATE_TEST_RECIPIENT_ID||'');
  if(!/^acct_[A-Za-z0-9]+$/.test(id))return res.status(503).json({code:'TEST_RECIPIENT_NOT_CONFIGURED'});
  try{
   const stripe=getStripe();
   const account=await stripe.v2.core.accounts.retrieve(id,{include:['configuration.recipient','requirements','defaults']});
   if(account.id!==id||account.livemode!==false||!/^synthetic-sct-[a-f0-9]{32}@example\.test$/.test(account.contact_email||'')||
    !/^RentInOrbit synthetic TEST /.test(account.display_name||''))return res.status(409).json({code:'SYNTHETIC_TEST_RECIPIENT_REQUIRED'});
   const link=await stripe.v2.core.accountLinks.create({account:id,use_case:{type:'account_onboarding',account_onboarding:{
    configurations:['recipient'],collection_options:{fields:'currently_due'},refresh_url:env.APP_URL+'/__test-access',return_url:env.APP_URL+'/'}}});
   const url=new URL(link.url);
   if(link.livemode!==false||link.account!==id||url.protocol!=='https:'||url.hostname!=='connect.stripe.com'||url.username||url.password)
    throw new Error('UNTRUSTED_TEST_ONBOARDING_LINK');
   return res.redirect(303,url.toString());
  }catch{
   // Provider errors can contain private links or credentials; do not return/log them.
   return res.status(503).json({code:'TEST_ONBOARDING_UNAVAILABLE',error:'Nepavyko atidaryti Stripe TEST formos. Pabandykite vėliau.'});
  }
 });
}
