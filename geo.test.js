import fs from 'fs';

const app=[fs.readFileSync('./app.js','utf8'),...fs.readdirSync('./modules',{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith('.js')).map(x=>fs.readFileSync('./modules/'+x.name,'utf8'))].join('\n');
const index=fs.readFileSync('./index.html','utf8');
const server=fs.readFileSync('./server.js','utf8');

function assert(v,msg){if(!v) throw new Error(msg);}

assert(index.includes('leaflet@1.9.4'),'Leaflet stable dependency missing');
assert(index.includes('id="resultsMap"'),'Results map container missing');
assert(index.includes('id="radiusFilter"'),'Radius filter missing');
assert(index.includes('id="listingLatitude"'),'Listing latitude missing');
assert(app.includes('function haversineKm'),'Distance calculation missing');
assert(app.includes('navigator.geolocation'),'Geolocation integration missing');
assert(app.includes('renderResultsMap'),'Map renderer missing');
assert(server.includes('https://unpkg.com'),'CSP must allow Leaflet CDN');
assert(server.includes('https://tile.openstreetmap.org'),'CSP must allow OSM tiles');

console.log('PASS: V37 geo search and map static checks passed.');
