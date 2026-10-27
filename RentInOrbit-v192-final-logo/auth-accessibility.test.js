import fs from 'fs';
const server=fs.readFileSync('./server.js','utf8'),app=[fs.readFileSync('./app.js','utf8'),...fs.readdirSync('./modules',{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith('.js')).map(x=>fs.readFileSync('./modules/'+x.name,'utf8'))].join('\n'),styles=fs.readFileSync('./styles.css','utf8');
function assert(v,m){if(!v)throw new Error(m)}
assert(server.includes("keyPrefix:'auth-login'"),'Login brute-force limit missing');
assert(server.includes("keyPrefix:'auth-register'"),'Registration abuse limit missing');
assert(app.includes("autocomplete='current-password'"),'Login autocomplete missing');
assert(app.includes("autocomplete='new-password'"),'Register autocomplete missing');
assert(styles.includes('min-height:44px'),'Touch targets missing');
assert(styles.includes(':focus-visible'),'Keyboard focus missing');
console.log('PASS: V52 auth-abuse and mobile accessibility checks passed.');
