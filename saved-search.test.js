import fs from 'fs';
const db=fs.readFileSync('./db.js','utf8');
const server=fs.readFileSync('./server.js','utf8');
const app=[fs.readFileSync('./app.js','utf8'),...fs.readdirSync('./modules',{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith('.js')).map(x=>fs.readFileSync('./modules/'+x.name,'utf8'))].join('\n');
const sw=fs.readFileSync('./service-worker.js','utf8');
function assert(v,m){if(!v)throw new Error(m)}
assert(db.includes('rental_saved_searches'),'Saved searches DB missing');
assert(server.includes('/api/customer/saved-searches'),'Saved searches API missing');
assert(app.includes('currentSearchSnapshot'),'Saved search frontend missing');
assert(sw.includes("url.pathname.startsWith('/api/')"),'Service worker must bypass API cache');
assert(sw.includes("url.pathname.startsWith('/uploads/')"),'Service worker must bypass uploaded/private media cache');
console.log('PASS: V42 saved-search and PWA privacy checks passed.');
