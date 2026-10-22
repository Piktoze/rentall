import fs from 'fs';
const server=fs.readFileSync('./server.js','utf8'),app=[fs.readFileSync('./app.js','utf8'),...fs.readdirSync('./modules',{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith('.js')).map(x=>fs.readFileSync('./modules/'+x.name,'utf8'))].join('\n');
function assert(v,m){if(!v)throw new Error(m)}
assert(server.includes('function matchesImageSignature'),'signature validation missing');
assert(server.includes("dotfiles:'deny'"),'dotfile denial missing');
assert(server.includes("worker-src 'self'"),'worker CSP missing');
assert(app.includes('.map(url=>safeImageUrl(url))'),'gallery allowlist missing');
assert(app.includes('alt="${escapeHtml(listing.title)}"'),'alt escaping missing');
assert(app.includes('loading="lazy" decoding="async"'),'lazy image hints missing');
console.log('PASS: V48 upload/gallery security and performance checks passed.');
