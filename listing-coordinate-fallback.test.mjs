import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync('app.js','utf8'),start=source.indexOf('function listingCoordinates(listing){'),end=source.indexOf('\nfunction haversineKm',start);
const context=vm.createContext({CITY_COORDS:{'klaipėda':[55.7,21.1]},normalizeCityKey:v=>String(v||'').trim().toLowerCase()});
vm.runInContext(source.slice(start,end),context);const coords=value=>{const result=context.listingCoordinates(value);return result?Array.from(result):null;};
test('edited listings with missing/null/blank coordinates use city fallback; actual zero coordinates are preserved',()=>{
 for(const v of [undefined,null,'','   '])assert.deepEqual(coords({city:'Klaipėda',latitude:v,longitude:v}),[55.7,21.1]);
 assert.deepEqual(coords({city:'Klaipėda',latitude:0,longitude:0}),[0,0]);
 assert.deepEqual(coords({city:'Klaipėda',latitude:'0',longitude:'0'}),[0,0]);
 assert.deepEqual(coords({city:'Klaipėda',latitude:55.7,longitude:null}),[55.7,21.1]);
 assert.deepEqual(coords({city:'Klaipėda',latitude:91,longitude:20}),[55.7,21.1]);
 assert.equal(coords({city:'Unknown',latitude:null,longitude:null}),null);
});
