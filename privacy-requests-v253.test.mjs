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
 ['server mounts route',server.includes('registerPrivacyRequestRoutes(app, db, requireAuth);')],
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
assert.ok(ui.includes("api('/api/admin/privacy/requests'"),'admin review UI');
assert.ok(moduleSource.includes("req.appUser?.role==='admin'"),'admin check');
assert.ok(moduleSource.includes('privacy_subject_request_audit'),'audit log');
assert.ok(moduleSource.includes('REVIEW_CONFIRMATION_REQUIRED'),'explicit terminal confirmation');
execFileSync(process.execPath,['--check','modules/privacy-requests-ui-v254.js'],{stdio:'inherit'});
console.log('PASS GDPR rights UI and admin audit source checks');
console.log('PASS GDPR request source gate '+tests.length+'/'+tests.length);
