import fs from 'fs';
import assert from 'assert';

const server=fs.readFileSync(new URL('./server.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('./light-premium-v161.css',import.meta.url),'utf8');
const content=fs.readFileSync(new URL('./modules/help-center-content-v177.js',import.meta.url),'utf8');

assert(server.includes("app.get('/help'"),'Help route missing');
assert(server.includes("['/terms','terms']"),'Terms route missing');
assert(server.includes("['/privacy','privacy']"),'Privacy route missing');
assert(server.includes("['/cookies','cookies']"),'Cookies route missing');
assert(server.includes("['/fees','fees']"),'Fees route missing');
assert(server.includes('legal-lang-switch'),'Language switch missing on help/legal pages');
assert(css.includes('.legal-page h1{color:#123f32!important'),'Legal/help title must be dark green');
for(const lang of ['lt','en','es','de','ru']) assert(content.includes(`${lang}: {`)||content.includes(`${lang}:{`),`Missing ${lang} help locale`);
for(const phrase of ['Pilotinė tiekėjų kainodara','Pilotiniu laikotarpiu nėra prijungimo ar mėnesinio mokesčio.','Platformos mokestis taikomas tik uždirbančiai rezervacijai','Tiekėjo inicijuoto atšaukimo atveju grąžinama visa nuomos kaina.']) assert(content.includes(phrase),`Missing pilot/refund copy: ${phrase}`);
for(const retired of ['Pro — 39 € / mėn.','Premium — 99 € / mėn.','18 % nuo užsakymo.']) assert(!content.includes(retired),`Retired pricing still present: ${retired}`);
assert(content.includes('Kodėl verta bendrauti RentInOrbit žinutėse?'),'Renter safety FAQ missing');
assert(content.includes('Kas gali nuomoti per RentInOrbit?'),'Supplier FAQ missing');
assert(content.includes('Kaip veikia RentInOrbit?'),'Renter FAQ missing');
console.log('help-center-v177.test.js PASS');
