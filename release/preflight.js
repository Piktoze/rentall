import fs from'fs';import path from'path';
const production=process.env.NODE_ENV==='production';
const checks=[
 ['source_server',fs.existsSync('server.js'),true],
 ['source_frontend',fs.existsSync('index.html')&&fs.existsSync('app.js'),true],
 ['env_template',fs.existsSync('.env.example'),true],
 ['browser_e2e',fs.existsSync('e2e/customer-journey.spec.js'),true],
 ['stripe_e2e',fs.existsSync('e2e/stripe-lifecycle.spec.js'),true],
 ['recovery_runbook',fs.existsSync('ops/RECOVERY.md'),true],
 ['stripe_secret',Boolean(process.env.STRIPE_SECRET_KEY),production],
 ['stripe_webhook',Boolean(process.env.STRIPE_WEBHOOK_SECRET),production],
 ['https_app_url',/^https:\/\//i.test(process.env.APP_URL||''),production],
 ['session_secret',String(process.env.SESSION_SECRET||'').length>=32,production],
 ['email_provider',Boolean(process.env.EMAIL_PROVIDER&&process.env.EMAIL_FROM&&process.env.EMAIL_WORKER_TOKEN),production],
 ['support_email',Boolean(process.env.SUPPORT_EMAIL),production]
].map(([id,ready,required])=>({id,ready,required}));
const blockers=checks.filter(x=>x.required&&!x.ready);
const report={ready:blockers.length===0,mode:production?'production':'development',checks,blockers:blockers.map(x=>x.id),generatedAt:new Date().toISOString()};
fs.mkdirSync('release',{recursive:true});fs.writeFileSync('release/preflight-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));if(blockers.length)process.exitCode=1;
