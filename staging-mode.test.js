import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {productionConfigReport,productionStorageReport,assertProductionConfig} from './config.js';

const ok=(value,message)=>{if(!value)throw new Error(message)};
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'rentall-staging-'));
// Railway production-like env with every non-Stripe, non-email setting valid.
const base={NODE_ENV:'production',RAILWAY_PROJECT_ID:'p',APP_URL:'https://rentall.example',PUBLIC_BASE_URL:'https://rentall.example',SESSION_SECRET:'R4nD0m!aB3cD4eF5gH6iJ7kL8mN9pQ2rS',TRUST_PROXY_HOPS:'1',RENTALL_DB_PATH:path.join(temp,'rentall.sqlite'),UPLOADS_DIR:path.join(temp,'uploads'),RAILWAY_VOLUME_MOUNT_PATH:temp,MAPS_PROVIDER:'stub',SMS_PROVIDER:'disabled',PUSH_PROVIDER:'disabled'};
const staging={...base,RENTALL_STAGING:'true'};
const blockers=env=>productionConfigReport(env).blocking;

try{
  // staging without Stripe/email is valid and does not throw
  ok(productionConfigReport(staging).ready,'staging without Stripe/email is ready: '+blockers(staging));
  ok(assertProductionConfig(staging).staging===true,'staging flag reported');
  ok(productionStorageReport(staging).ready,'storage still ready');

  // without the flag (unset, false, or not exactly "true") Stripe/email stay mandatory
  for(const flag of [undefined,'false','','1','TRUE-ish']){
    const env=flag===undefined?base:{...base,RENTALL_STAGING:flag};
    const b=blockers(env);
    for(const id of ['stripe_secret','stripe_webhook','connect_v2','email_provider','email_api_key','support_email'])ok(b.includes(id),`${id} required when RENTALL_STAGING=${flag}`);
    let threw=false;try{assertProductionConfig(env)}catch(e){threw=e.code==='PRODUCTION_CONFIG_INVALID'}
    ok(threw,'startup blocked when RENTALL_STAGING='+flag);
  }

  // staging does NOT relax any other production safety check
  const cases={
    app_url_https:{APP_URL:'http://rentall.example',PUBLIC_BASE_URL:'http://rentall.example'},
    public_base_url:{PUBLIC_BASE_URL:'https://other.example'},
    session_secret:{SESSION_SECRET:'short'},
    trust_proxy:{TRUST_PROXY_HOPS:''},
    node_environment:{NODE_ENV:'development'},
    database_on_volume:{RENTALL_DB_PATH:'/tmp/elsewhere/rentall.sqlite'},
    uploads_on_volume:{UPLOADS_DIR:'/tmp/elsewhere/uploads'},
    database_volume_configured:{RAILWAY_VOLUME_MOUNT_PATH:''},
    sms_provider:{SMS_PROVIDER:'twilio'},
    push_provider:{PUSH_PROVIDER:'fcm'},
    maps_configuration:{MAPS_PROVIDER:'mapbox'}
  };
  for(const [id,override] of Object.entries(cases)){
    const b=blockers({...staging,...override});
    ok(b.includes(id),`staging still blocks ${id}: got ${b}`);
  }

  // staging may never run with a live Stripe key
  ok(blockers({...staging,STRIPE_MODE:'live',STRIPE_SECRET_KEY:'rk_live_abcdefghijklmnop'}).includes('staging_no_live_stripe'),'live Stripe key blocked in staging');
  ok(!blockers({...staging,STRIPE_MODE:'test',STRIPE_SECRET_KEY:'rk_test_abcdefghijklmnop'}).includes('staging_no_live_stripe'),'test Stripe key allowed in staging');

  // outside Railway / production, the flag changes nothing
  ok(productionConfigReport({RENTALL_STAGING:'true'}).ready,'local dev stays ready');
}finally{
  fs.rmSync(temp,{recursive:true,force:true});
}
console.log('PASS staging mode config');
