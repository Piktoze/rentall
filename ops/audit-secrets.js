import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const frontend=['index.html','app.js','service-worker.js','manifest.webmanifest',...fs.readdirSync(path.join(root,'modules')).filter(name=>name.endsWith('.js')).map(name=>`modules/${name}`)];
const forbiddenNames=['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','RESEND_API_KEY','SESSION_SECRET','EMAIL_WORKER_TOKEN'];
const findings=[];

for(const relative of frontend){
  const source=fs.readFileSync(path.join(root,relative),'utf8');
  for(const name of forbiddenNames)if(source.includes(name))findings.push(`${relative}: frontend references ${name}`);
  if(/[sr]k_(?:live|test)_[A-Za-z0-9_\-]{16,}/.test(source))findings.push(`${relative}: frontend contains Stripe private-key pattern`);
  if(/whsec_[A-Za-z0-9_\-]{12,}/.test(source))findings.push(`${relative}: frontend contains webhook-secret pattern`);
}

for(const relative of ['server.js','config.js','ops/start.js','release/smoke-production.mjs']){
  const source=fs.readFileSync(path.join(root,relative),'utf8');
  if(/[sr]k_live_[A-Za-z0-9_\-]{20,}/.test(source))findings.push(`${relative}: live Stripe private-key pattern`);
}

if(findings.length){
  console.error(JSON.stringify({ok:false,findings},null,2));
  process.exit(1);
}
console.log(JSON.stringify({ok:true,frontendFiles:frontend.length,serverFiles:4,forbiddenSecretNames:forbiddenNames.length}));
