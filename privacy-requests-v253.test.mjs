import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

execFileSync(process.execPath,['--check','modules/privacy-subject-requests-v253.js'],{stdio:'inherit'});
execFileSync(process.execPath,['--check','server.js'],{stdio:'inherit'});
const moduleSource=fs.readFileSync('modules/privacy-subject-requests-v253.js','utf8');
const server=fs.readFileSync('server.js','utf8');
const doc=fs.readFileSync('release/GDPR_SUBJECT_REQUESTS_V253_LT.md','utf8');
const tests=[
 ['authenticated GET',moduleSource.includes("app.get('/api/privacy/requests', requireAuth")],
 ['authenticated POST',moduleSource.includes("app.post('/api/privacy/requests', requireAuth")],
 ['user scoped list',moduleSource.includes('WHERE user_id = ? ORDER BY created_at DESC') && moduleSource.includes('req.appUser.userId')],
 ['server mounts route',server.includes('registerPrivacyRequestRoutes(app, db, requireAuth, enqueueTransactionalEmail);')],
 ['no automated erasure',!moduleSource.includes('DELETE FROM app_users')],
 ['no free text on GET',!moduleSource.includes('details AS') && !moduleSource.includes('SELECT *')],
 ['rate limit',moduleSource.includes('PRIVACY_REQUEST_LIMIT')],
 ['no store',moduleSource.includes("'Cache-Control','no-store'")],
 ['documented manual processing',doc.includes('nėra automatinio apdorojimo')]
];
for(const [name,ok] of tests){console.log((ok?'PASS ':'FAIL ')+name); assert.ok(ok,name)}
const ui=fs.readFileSync('modules/privacy-requests-ui-v254.js','utf8');
const html=fs.readFileSync('index.html','utf8');
assert.ok(html.includes('modules/privacy-requests-ui-v254.js?v=254'),'privacy UI loaded');
assert.ok(ui.includes("api('/api/privacy/requests'"),'user can view requests');
assert.ok(ui.includes("method:'POST',body:JSON.stringify({type:"),'user can submit requests');
assert.ok(ui.includes("api('/api/admin/privacy/requests?offset='"),'paginated admin review UI');
assert.ok(moduleSource.includes('LIMIT ? OFFSET ?'),'bounded admin pagination');
assert.ok(ui.includes('Rodyti daugiau prašymų'),'load more control');
assert.ok(moduleSource.includes("req.appUser?.role==='admin'"),'admin check');
assert.ok(moduleSource.includes('privacy_subject_request_audit'),'audit log');
assert.ok(moduleSource.includes('review_confirmed AS reviewConfirmed'),'closure confirmation visible in audit');
assert.ok(moduleSource.includes('response_sent AS responseSent'),'response confirmation visible in audit');
assert.ok(moduleSource.includes('identity_reviewed AS identityReviewed'),'identity review visible in audit');
assert.ok(moduleSource.includes('action_performed AS actionPerformed'),'performed action visible in audit');
assert.ok(ui.includes('patvirtinimai: peržiūra'),'admin timeline displays confirmations');
assert.ok(moduleSource.includes("app.get('/api/admin/privacy/requests/:requestId/audit',requireAuth,adminOnly"),'audit endpoint admin protected');
assert.ok(ui.includes('Peržiūrėti sprendimų istoriją'),'audit visible to admin');
assert.ok(ui.includes("get('privacy-requests')==='1'"),'privacy email deep link honored');
assert.ok(moduleSource.includes('REVIEW_CONFIRMATION_REQUIRED'),'explicit terminal confirmation');
for(const code of ['RESPONSE_NOT_CONFIRMED','IDENTITY_REVIEW_REQUIRED','ACTION_NOT_CONFIRMED'])
  assert.ok(moduleSource.includes(code),'closure requires '+code);
assert.ok(ui.includes('responseSent:responseSent.checked') && ui.includes('identityReviewed:identityReviewed.checked') && ui.includes('actionPerformed:actionPerformed.checked'),'UI submits explicit closure confirmations');
execFileSync(process.execPath,['--check','modules/privacy-requests-ui-v254.js'],{stdio:'inherit'});
assert.ok(moduleSource.includes("datetime(r.created_at, '+1 month') AS dueAt"),'admin deadline recorded');
assert.ok(moduleSource.includes('RESOLUTION_NOTE_REQUIRED'),'terminal status needs resolution note');
assert.ok(moduleSource.includes('resolution_note'),'decision rationale auditable');
assert.ok(ui.includes('TERMINAS PRAĖJĘS'),'overdue visible to admin');
assert.ok(ui.includes('resolutionNote:note.value'),'admin rationale submitted');
assert.ok(moduleSource.includes("app.get('/api/admin/privacy/health',requireAuth,adminOnly"),'admin-only queue health');
assert.ok(ui.includes("api('/api/admin/privacy/health')"),'admin UI reads operational readiness');
assert.ok(ui.includes('Neperžiūrėti:') && ui.includes('Pradelsti:'),'admin dashboard status counts');
assert.ok(moduleSource.includes('PRIVACY_REQUESTS_NOTIFY_EMAIL'),'operator address configurable');
assert.ok(moduleSource.includes('validOperatorEmail(operatorAddress)'),'operator email validates syntax');
assert.ok(moduleSource.includes('privacy_request_notification_queue_rejected'),'failed enqueue is logged');
assert.ok(moduleSource.includes("FROM email_outbox WHERE template_key='privacy_request_notify'"),'admin health monitors only GDPR email queue');
assert.ok(moduleSource.includes('process.env.RESEND_API_KEY'),'email readiness requires API credential');
assert.ok(ui.includes('neišsiųstų BDAR laiškų klaidų'),'admin sees failed privacy alerts');
assert.ok(moduleSource.includes("templateKey:'privacy_request_notify'"),'operational email queued');
assert.ok(server.includes("registerPrivacyRequestRoutes(app, db, requireAuth, enqueueTransactionalEmail)"),'email queue injected');
assert.ok(server.includes("if(key==='privacy_request_notify')"),'email renderer available');
const gdprEmailTemplate=server.split("if(key==='privacy_request_notify'){")[1]?.split("if(key==='supplier_booking_received')")[0]||'';
assert.ok(gdprEmailTemplate.includes("new URL('/?privacy-requests=1',appUrl)"),'notification contains configured secure admin deep link');
assert.ok(gdprEmailTemplate.includes('escapeEmailHtml(new URL('),'admin link is HTML escaped');
assert.ok(!gdprEmailTemplate.includes('payload.details') && !gdprEmailTemplate.includes('payload.accountEmail'),'notification excludes free text and requester email');
assert.ok(!moduleSource.includes('payload:{requestId,type,details}'),'no private request details in operator email');
console.log('PASS GDPR rights UI and admin audit source checks');
console.log('PASS GDPR request source gate '+tests.length+'/'+tests.length);
