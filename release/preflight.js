import fs from 'node:fs';
import {productionConfigReport} from '../config.js';

const config=productionConfigReport();
const sourceChecks=[
  {id:'source_server',required:true,ready:fs.existsSync('server.js')},
  {id:'source_frontend',required:true,ready:fs.existsSync('index.html')&&fs.existsSync('app.js')},
  {id:'env_template',required:true,ready:fs.existsSync('.env.example')},
  {id:'railway_config',required:true,ready:fs.existsSync('railway.toml')},
  {id:'browser_e2e',required:true,ready:fs.existsSync('e2e/customer-journey.spec.js')},
  {id:'stripe_e2e',required:true,ready:fs.existsSync('e2e/stripe-lifecycle.spec.js')},
  {id:'recovery_runbook',required:true,ready:fs.existsSync('ops/RECOVERY.md')},
  {id:'production_runbook',required:true,ready:fs.existsSync('release/RAILWAY_DEPLOYMENT.md')}
];
const checks=[...sourceChecks,...config.checks.map(({id,required,ready})=>({id,required,ready}))];
const blockers=checks.filter(check=>check.required&&!check.ready).map(check=>check.id);
const report={ready:blockers.length===0,mode:config.production?'production':'development',checks,blockers,database:config.database,stripe:config.stripe,email:config.email,generatedAt:new Date().toISOString()};
fs.mkdirSync('release',{recursive:true});
fs.writeFileSync('release/preflight-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(blockers.length)process.exitCode=1;
