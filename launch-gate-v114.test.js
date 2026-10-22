import fs from'fs';
const s=fs.readFileSync('./server.js','utf8'),c=fs.readFileSync('./config.js','utf8'),e=fs.readFileSync('./.env.example','utf8'),p=JSON.parse(fs.readFileSync('./package.json','utf8'));
function ok(v,m){if(!v)throw new Error(m)}
ok(p.version.startsWith('1.0.0-rc.'),'version');
ok(s.includes('function launchGate()'),'launch gate');
for(const x of ['stripe_secret','stripe_webhook','app_url_https','email_provider','email_worker_token','support_email','session_secret'])ok((s+c).includes(`id:'${x}'`),x);
ok(s.includes("app.get('/api/launch-readiness'"),'endpoint');
ok(s.includes('ready:gate.ready'),'health readiness');
ok(e.includes('SESSION_SECRET'),'env template');
ok(fs.existsSync('./e2e/STRIPE_TEST_MODE.md'),'stripe runbook');
console.log('PASS: V114 launch gate checks passed.');
