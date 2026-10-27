import fs from 'fs';
const db=fs.readFileSync('./db.js','utf8'),server=fs.readFileSync('./server.js','utf8'),env=fs.readFileSync('./.env.example','utf8');
function assert(v,m){if(!v)throw new Error(m)}
assert(db.includes('export function claimTransactionalEmails'),'Outbox claim helper missing');
assert(db.includes("WHERE id=? AND status='pending'"),'Atomic pending-to-sending guard missing');
assert(db.includes("status=terminal?'failed':'pending'"),'Retry/dead-letter behavior missing');
assert(server.includes('function requireEmailWorker'),'Worker authentication missing');
assert(server.includes("crypto.timingSafeEqual"),'Worker token comparison must be timing-safe');
assert(server.includes("app.post('/api/internal/email-outbox/claim', requireEmailWorker"),'Protected claim endpoint missing');
assert(server.includes("app.post('/api/internal/email-outbox/:id/sent', requireEmailWorker"),'Protected sent endpoint missing');
assert(server.includes("app.post('/api/internal/email-outbox/:id/failed', requireEmailWorker"),'Protected failure endpoint missing');
assert(env.includes('EMAIL_WORKER_TOKEN='),'Worker token config missing');
console.log('PASS: V55 transactional email worker/retry security checks passed.');
