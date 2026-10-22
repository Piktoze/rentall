import fs from 'fs';
const app=[fs.readFileSync('./app.js','utf8'),...fs.readdirSync('./modules',{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith('.js')).map(x=>fs.readFileSync('./modules/'+x.name,'utf8'))].join('\n');
function assert(v,m){if(!v)throw new Error(m)}
assert(!app.includes('class="notification-item">${err.message}</div>'),'Unsafe notification error sink remains');
assert(!app.includes('class="webhook-error">${err.message}</div>'),'Unsafe webhook error sink remains');
assert(app.includes('${escapeHtml(accommodation)}, ${escapeHtml(city)}'),'Trip destination summary must escape user input');
assert(app.includes('<option value="${escapeHtml(l.id)}">${escapeHtml(l.title)}'),'Supplier listing option must escape stored listing data');
assert(app.includes("count.setAttribute('aria-live','polite')"),'Result count live-region semantics missing');
console.log('PASS: V51 residual DOM-XSS and live-result accessibility checks passed.');
