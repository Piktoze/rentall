import fs from 'fs';
const server=fs.readFileSync('./server.js','utf8');
function assert(v,m){if(!v)throw new Error(m)}
assert(server.includes("app.get('/api/stripe/webhook-events', requireRole('admin')"),'Stripe webhook logs must be admin-only');
assert(server.includes("app.post('/api/stripe/connect/simulate-event', requireRole('admin')"),'Stripe simulator must be admin-only');
assert(server.includes("NODE_ENV==='production' && process.env.ENABLE_STRIPE_SIMULATOR!=='true'"),'Simulator must default off in production');
assert(server.includes("Cache-Control','no-store, private"),'Sensitive API no-store policy missing');
assert(server.includes("Math.min(200,Number(limit)||50)"),'Webhook log query must be bounded');
console.log('PASS: V47 payment operations privacy/security checks passed.');
