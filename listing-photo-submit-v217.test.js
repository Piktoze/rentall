import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync('app.js','utf8');
const begin=src.indexOf("document.getElementById('listingForm')?.addEventListener('submit',e=>{");
assert.ok(begin>=0,'Base listing submit handler must exist');
const end=src.indexOf("\n});",begin);
assert.ok(end>begin,'Base listing submit handler closes');
const body=src.slice(begin,end);
const guard=body.indexOf('pendingListingPhotoUrls.length<2');
const stop=body.indexOf('e.stopImmediatePropagation()');
const write=body.indexOf('items.unshift(listing)');
assert.ok(guard>=0&&stop>guard&&write>stop,'Photo guard must run before any local listing creation');
assert.ok(body.includes("photoInput?.dataset.uploading==='true'"),'Uploading state blocks submission');
assert.ok(body.includes("pendingListingPhotoUrls.length>5"),'More than five images blocked');
assert.ok(body.includes('return;\n  }\n  const s=currentSupplier()'),
 'Rejected photo set must return without creating a listing');
assert.ok(!src.includes('Capture before every existing listing submit handler'),
 'Obsolete late guard must be removed');
console.log('PASS photo validation precedes first listing mutation and all submit extensions');
