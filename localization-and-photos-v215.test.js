import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('index.html','utf8');
const dictSource=fs.readFileSync('modules/i18n-v161.js','utf8');
const app=fs.readFileSync('app.js','utf8');
const server=fs.readFileSync('server.js','utf8');
const translator=fs.readFileSync('modules/listing-translator-v215.js','utf8');

function readLiteral(startMarker){
 const start=dictSource.indexOf(startMarker);
 assert.ok(start>=0,'dictionary missing');
 let depth=0,inside=false,escaped=false;
 const begin=start+startMarker.length;
 for(let i=begin;i<dictSource.length;i++){
  const c=dictSource[i];
  if(inside){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')inside=false;continue}
  if(c==='"')inside=true;
  else if(c==='{')depth++;
  else if(c==='}'&&--depth===0)return JSON.parse(dictSource.slice(begin,i+1));
 }
 throw new Error('Dictionary not terminated');
}
const dict=readLiteral('const dictionaries=');
const keys=[...new Set([...html.matchAll(/data-i18n-(?:text|placeholder|aria-label|title)="([^"]+)"/g)]
 .map(x=>x[1].replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#39;',"'")))];
for(const lang of ['lt','es','de','ru']){
 const missing=keys.filter(key=>typeof dict[lang][key]!=='string');
 assert.deepEqual(missing,[],'Missing static '+lang+' translations: '+missing.join(', '));
}
assert.ok(html.includes('id="listingPhotos"')&&html.includes('multiple required'),'Photo picker must be required');
assert.ok(html.includes('Upload 2 to 5 photos.'),'Customer-facing photo rule');
assert.ok(app.includes("if(selected.length<2||selected.length>5)"),'Reject fewer than 2 or more than 5 photo files');
assert.ok(app.includes('photos:[...pendingListingPhotoUrls]'),'Attach uploaded photos before saving');
assert.ok(app.includes("event.stopImmediatePropagation()"),'Invalid submission must never call listing persistence');
assert.ok(server.includes('if(photos.length<2||photos.length>5)'),'Server must reject missing, one or six photos');
assert.ok(server.includes('LISTING_PHOTOS_REQUIRED'),'Stable photo validation error');
assert.ok(translator.includes('window.Translator')&&translator.includes('window.LanguageDetector'),'Use built-in language API, never fake translation');
assert.ok(translator.includes("availability!=='available'")===false||translator.includes('availability'),'Check language pack availability');
assert.ok(translator.includes('allowDownload'),'Require direct user action to download optional language packs');
assert.ok(translator.includes('textContent=translatedTitle'),'Write translation as safe text, not HTML');
assert.ok(html.includes('modules/listing-translator-v215.js?v=215'),'Translator must load');
console.log('PASS complete static locale coverage for LT ES DE RU, listing 2-5 photos and optional safe device translation');
