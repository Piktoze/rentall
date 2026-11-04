const fs=require('fs');const assert=require('node:assert/strict');
const i=fs.readFileSync('modules/i18n-v161.js','utf8');const s=fs.readFileSync('modules/renter-booking-status-v190.js','utf8');
assert.ok(i.includes('recoveredStagingPhrases'),'legacy staging translations included in main engine');
assert.ok(i.includes('recoveredStagingDynamic'),'dynamic status templates consolidated');
assert.equal((i.match(/new MutationObserver\(/g)||[]).length,1,'only one i18n MutationObserver');
assert.ok(!s.includes('STAGING_I18N_DYNAMIC_V196'),'legacy parallel language observer removed');
for(const file of ['server.js','app.js']){
 const text=fs.readFileSync(file,'utf8');
 assert.ok(text.includes('STAGING_'),'staging feature patches merged into '+file);
}
console.log('PASS: V201 one translation observer, legacy phrases and staging feature patch preservation');
