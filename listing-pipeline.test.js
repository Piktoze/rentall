import fs from 'fs';
const app=[fs.readFileSync('./app.js','utf8'),...fs.readdirSync('./modules',{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith('.js')).map(x=>fs.readFileSync('./modules/'+x.name,'utf8'))].join('\n');
const server=fs.readFileSync('./server.js','utf8');
function assert(v,m){if(!v)throw new Error(m)}
assert(!app.includes("const latest=listings[listings.length-1];"),'Newest listing regression remains');
assert(app.includes("const latest=listings[0];"),'Newest listing should be first because creation uses unshift');
assert(app.includes("const cancellationPolicy=document.getElementById('listingCancellationPolicy')"),'Cancellation policy must snapshot before reset');
assert(app.includes("const lat=Number(document.getElementById('listingLatitude')?.value);"),'Coordinates snapshot missing');
assert(app.includes("${escapeHtml(listing.title)}</h2>"),'Listing detail title must be escaped');
assert(server.includes('validateSupplierListingInput'),'Server listing validation missing');
console.log('PASS: V43 listing pipeline regression/security checks passed.');
