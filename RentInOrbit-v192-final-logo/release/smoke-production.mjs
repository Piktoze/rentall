const rawBase=process.argv[2]||process.env.RENTINORBIT_BASE_URL;
if(!rawBase)throw new Error('Public app URL required: npm run smoke:production -- https://your-app.example');

const parsed=new URL(rawBase);
const local=['localhost','127.0.0.1','::1'].includes(parsed.hostname);
if(parsed.protocol!=='https:'&&!local)throw new Error('Public production smoke checks require an HTTPS URL');
const base=parsed.origin;
const credentialPattern=/(?:[sr]k_(?:live|test)_[A-Za-z0-9_\-]{12,}|whsec_[A-Za-z0-9_\-]{12,}|re_[A-Za-z0-9_\-]{12,})/;
const secretEnvironmentNamePattern=/(?:STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|RESEND_API_KEY|SESSION_SECRET|EMAIL_WORKER_TOKEN)/;

async function request(pathname){
  const response=await fetch(base+pathname,{headers:{accept:pathname==='/'?'text/html':'application/json'},redirect:'follow',signal:AbortSignal.timeout(15000)});
  const text=await response.text();
  if(credentialPattern.test(text)||secretEnvironmentNamePattern.test(text))throw new Error(`Secret leakage detected at ${pathname}`);
  if(response.status!==200)throw new Error(`${pathname} returned ${response.status}`);
  return {response,text};
}

const homepage=await request('/');
if(!String(homepage.response.headers.get('content-type')||'').includes('text/html')||!/RentInOrbit/i.test(homepage.text))throw new Error('Homepage contract failed');

const health=await request('/healthz');
const healthBody=JSON.parse(health.text);
if(healthBody.ok!==true||healthBody.service!=='rentinorbit')throw new Error('Health contract failed');

const readiness=await request('/api/readiness');
const readinessBody=JSON.parse(readiness.text);
if(readinessBody.ready!==true||!readinessBody.database?.persistent||readinessBody.database?.migrationVersion<147)throw new Error('Readiness contract failed');

const ops=await request('/api/ops/status');
const opsBody=JSON.parse(ops.text);
if(opsBody.ok!==true)throw new Error('Operations status is not production-ready');

const capabilities=await request('/api/integrations/capabilities');
const capabilitiesBody=JSON.parse(capabilities.text);
if(!capabilitiesBody.maps||!capabilitiesBody.email||!capabilitiesBody.sms||!capabilitiesBody.push)throw new Error('Integration capability contract failed');

console.log(JSON.stringify({ok:true,base,checks:{homepage:200,health:200,readiness:200,operations:200,integrations:200},version:readinessBody.version,migrationVersion:readinessBody.database.migrationVersion},null,2));
