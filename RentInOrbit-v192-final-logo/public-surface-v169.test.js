import fs from 'fs';
const h=fs.readFileSync('./index.html','utf8');
const launch=fs.readFileSync('./modules/launch-readiness.js','utf8');
const integration=fs.readFileSync('./modules/integration-readiness.js','utf8');
function ok(v,m){if(!v)throw new Error(m)}
ok(h.includes('id="v131RcStatus" hidden aria-hidden="true" data-internal-only="true"'),'release candidate hidden from public surface');
ok(h.includes('id="v136LaunchCenter" hidden aria-hidden="true" data-internal-only="true"'),'launch readiness hidden from public surface');
ok(h.includes('id="v130TripTools"') && h.includes('data-internal-only="true"'),'integration readiness hidden from public surface');
ok(!h.includes('per-booking access token'),'technical access-token wording removed');
ok(!h.includes('Server-confirmed status'),'server jargon removed');
ok(launch.includes("dataset.internalOnly==='true'"),'hidden launch widget skips public readiness calls');
ok(integration.includes("dataset.internalOnly==='true'"),'hidden integration widget skips public readiness calls');
console.log('PASS V169 public surface cleanup');
