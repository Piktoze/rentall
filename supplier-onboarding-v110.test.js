import fs from'fs';
const h=fs.readFileSync('./index.html','utf8'),a=[fs.readFileSync('./app.js','utf8'),...fs.readdirSync('./modules',{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith('.js')).map(x=>fs.readFileSync('./modules/'+x.name,'utf8'))].join('\n'),p=JSON.parse(fs.readFileSync('./package.json','utf8'));
function ok(v,m){if(!v)throw new Error(m)}
ok(p.version.startsWith('1.0.0-rc.'),'version');
ok(h.includes('Create your RentAll account'),'account headline');
ok(h.includes('id="regRole"')&&h.includes('value="customer"')&&h.includes('value="supplier"'),'customer/supplier account choice');
ok(h.includes('1 · Account')&&h.includes('2 · Profile')&&h.includes('3 · Start using RentAll'),'account setup steps');
ok(!h.includes('id="regPlan"'),'plan deferred');
ok(!h.includes('id="regBusinessType"'),'category deferred');
ok(!h.includes('id="regAddress"'),'address deferred');
ok(h.includes('Create account'),'generic account cta');
ok(a.includes("?.value||'Free'"),'safe plan default');
ok(a.includes('supplierOnboardingV110'),'supplier continuation still present');
console.log('PASS: V110 account onboarding remains supplier-capable with customer registration added.');
