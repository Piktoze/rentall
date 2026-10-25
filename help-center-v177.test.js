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
for(const phrase of ['Tiekėjų planai (staging kainodara)','Free — 0 € / mėn. ir 18 % nuo užsakymo.','Pro — 39 € / mėn. ir 12 % nuo užsakymo.','Premium — 99 € / mėn. ir 8 % nuo užsakymo.']) assert(content.includes(phrase),`Missing fee copy: ${phrase}`);
assert(content.includes('Kodėl verta bendrauti RentAll žinutėse?'),'Renter safety FAQ missing');
assert(content.includes('Kas gali nuomoti per RentAll?'),'Supplier FAQ missing');
assert(content.includes('Kaip veikia RentAll?'),'Renter FAQ missing');
console.log('help-center-v177.test.js PASS');
