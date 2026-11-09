import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('index.html','utf8');
const client=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('styles.css','utf8');
const server=fs.readFileSync('server.js','utf8');
for(const id of ['rioTraderPanel','rioTraderStatus','rioTraderDeclaration','rioTraderKind',
 'rioTraderConfirm','rioTraderBusinessForm','rioTraderLegalName','rioTraderPhone',
 'rioTraderEmail','rioTraderRegister','rioTraderNumber','rioTraderAddress',
 'rioTraderCompliance','rioTraderSaveStatus','rioTraderSaveProfile','rioTraderReload']){
 assert.ok(html.includes('id="'+id+'"'),'Missing trader form control '+id);
 assert.ok(client.includes("'"+id+"'"),'Trader UI controller not bound to '+id);
}
assert.ok(html.includes('data-v124-target="rioTraderPanel"'),
 'Supplier dashboard must expose the verification form');
assert.ok(css.includes('#rioTraderPanel [hidden]{display:none!important}'),
 'Business profile must stay hidden for private/unauthed users');
for(const path of ['/api/auth/me','/api/supplier/trader-status','/api/supplier/trader-profile']){
 assert.ok(client.includes("'"+path+"'"),'Client does not request '+path);
 assert.ok(server.includes("'"+path+"'"),'Supplier endpoint is not implemented '+path);
}
assert.ok(client.includes("currentKind!=='trader'"),
 'Do not submit a business profile before the supplier saves commercial status');
assert.ok(client.includes('result.profile?.verified'),
 'Client must distinguish submitted profile from real verification');
assert.ok(!client.slice(client.indexOf('// V248 —'),client.indexOf('// V248 —')+6000).includes('localStorage.setItem'),
 'Legal identity details must never be stored by the new browser form');
console.log('PASS supplier trader UI: authenticated status, business draft, private hidden fields, no false verification');
