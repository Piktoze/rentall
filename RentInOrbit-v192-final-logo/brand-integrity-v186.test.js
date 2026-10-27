import fs from 'fs';
const publicFiles=['index.html','manifest.webmanifest','modules/help-center-content-v177.js','modules/i18n-v161.js'];
const publicText=publicFiles.map(f=>fs.readFileSync(f,'utf8')).join('\n');
const server=fs.readFileSync('server.js','utf8');
function ok(v,m){if(!v)throw new Error(m)}
const previousBrand=new RegExp('\\b'+['Rent','All'].join('')+'\\b(?![:_-])','i');
ok(!previousBrand.test(publicText),'old public brand remains in public surfaces');
const preBrand=new RegExp(['Holiday','Gear'].join(''),'i');
ok(!preBrand.test(publicText),'pre-RentInOrbit public brand remains in public surfaces');
const oldUpper=['RENT','ALL'].join('');
ok(!server.includes('<div class="eyebrow">'+oldUpper+'</div>'),'old public brand remains in server-rendered policy UI');
ok(server.includes("termsVersion:'rentinorbit-rental-v1'"),'new agreement version missing');
ok(server.includes("service:'rentinorbit-marketplace'"),'diagnostic service identity not rebranded');
ok(publicText.includes('RentInOrbit'),'new brand missing');
ok(fs.readFileSync('index.html','utf8').includes('https://rentinorbit.com/'),'canonical domain missing');
ok(fs.readFileSync('modules/help-center-content-v177.js','utf8').match(/RENTINORBIT/g)?.length>=5,'help center not rebranded in all locales');

const technicalFiles=['app.js','server.js','config.js','db.js','service-worker.js',...fs.readdirSync('modules').filter(x=>x.endsWith('.js')).map(x=>'modules/'+x)];
const technicalText=technicalFiles.map(f=>fs.readFileSync(f,'utf8')).join('\n');
const legacyTechnical=new RegExp(['rent','all'].join('')+'(?:_|:|\\.)','i');
ok(!legacyTechnical.test(technicalText),'legacy technical brand prefix remains in active runtime source');
console.log('PASS: V186 public brand integrity');
