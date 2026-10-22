import fs from 'fs';
const db=fs.readFileSync('./db.js','utf8');
const server=fs.readFileSync('./server.js','utf8');
const env=fs.readFileSync('./.env.example','utf8');
const pkg=JSON.parse(fs.readFileSync('./package.json','utf8'));
function assert(v,m){if(!v)throw new Error(m)}
assert((Number(pkg.version.split('.')[0])>=1||Number(pkg.version.split('.')[1])>=53),'Package version must be V54 or newer');
assert(db.includes('CREATE TABLE IF NOT EXISTS email_outbox'),'Durable email outbox table missing');
assert(db.includes('export function enqueueTransactionalEmail'),'Email enqueue helper missing');
assert(server.includes("templateKey:'booking_received'"),'Booking confirmation email queue missing');
assert(server.includes("app.get('/api/admin/email-outbox', requireRole('admin')"),'Admin email outbox must be protected');
assert(server.includes("app.get('/api/runtime-config'"),'Safe runtime config endpoint missing');
assert(server.includes('transactionalEmailConfigured:Boolean(process.env.EMAIL_PROVIDER && process.env.EMAIL_FROM)'),'Runtime config must expose only boolean email readiness');
assert(env.includes('EMAIL_PROVIDER='),'Email provider production config missing');
assert(env.includes('EMAIL_FROM='),'Email sender production config missing');
console.log('PASS: V54 transactional-email outbox and production-readiness checks passed.');
