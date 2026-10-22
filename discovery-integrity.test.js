import fs from 'fs';
const app=[fs.readFileSync('./app.js','utf8'),...fs.readdirSync('./modules',{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith('.js')).map(x=>fs.readFileSync('./modules/'+x.name,'utf8'))].join('\n');
const server=fs.readFileSync('./server.js','utf8');
const styles=fs.readFileSync('./styles.css','utf8');
function assert(v,m){if(!v)throw new Error(m)}
assert(app.includes('return v42RenderGeo(filtered);'),'Final render wrapper must preserve narrowed category/search dataset');
assert(!app.includes('return v42RenderGeo(items);'),'Old category-breaking final render call remains');
assert(server.includes("keyPrefix:'public-listings'"),'Public listing discovery rate limit missing');
assert(styles.includes('@media (prefers-reduced-motion: reduce)'),'Reduced-motion accessibility support missing');
console.log('PASS: V50 discovery-filter integrity and motion accessibility checks passed.');
