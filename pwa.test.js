import fs from 'fs';
const index=fs.readFileSync('./index.html','utf8');
const app=[fs.readFileSync('./app.js','utf8'),...fs.readdirSync('./modules',{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith('.js')).map(x=>fs.readFileSync('./modules/'+x.name,'utf8'))].join('\n');
const manifest=fs.readFileSync('./manifest.webmanifest','utf8');
function assert(v,msg){if(!v)throw new Error(msg)}
assert(index.includes('manifest.webmanifest'),'Manifest missing');
assert(index.includes('onboardingModal'),'Onboarding modal missing');
assert(index.includes('installAppBtn'),'Install app button missing');
assert(app.includes('beforeinstallprompt'),'PWA install prompt missing');
assert(app.includes('serviceWorker.register'),'Service worker registration missing');
assert(manifest.includes('RentInOrbit — Rent Anything, Anywhere'),'Manifest app name missing');
console.log('PASS: V41 PWA/onboarding static checks passed.');
