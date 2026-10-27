const fs=require('fs');
const h=fs.readFileSync('index.html','utf8');
const a=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('light-premium-v161.css','utf8');
const i18n=fs.readFileSync('modules/i18n-v161.js','utf8');
function ok(v,m){if(!v){console.error('FAIL:',m);process.exit(1)}}
ok(!h.includes('10 Folding Chairs'),'fake hero listing preview must be removed');
ok(!h.includes('Cordless Drill</strong>'),'fake drill preview must be removed from hero');
ok(h.includes('supplier-dashboard-control'),'supplier compact control must exist');
ok(h.includes('supplierDashboardToggle'),'supplier dashboard toggle required');
ok(a.includes('rentinorbit_supplier_dashboard_open'),'supplier dashboard open state must be controlled');
ok(a.includes('supplier-authenticated'),'supplier authentication class required');
ok(css.includes('font-size:42px!important'),'desktop RentInOrbit brand must be materially larger');
ok(css.includes('width:66px!important'),'desktop R mark must be materially larger');
ok(css.includes('body:not(.supplier-authenticated) #supplier-dashboard{display:none!important}'),'supplier stats must never show to logged-out visitors');
ok(css.includes('#supplier-dashboard:not(.dashboard-expanded) .container>*:not(.supplier-dashboard-control){display:none!important}'),'supplier stats must be collapsed by default');
ok(css.includes('supplier-view-list'),'grid/list supplier view required');
for(const key of ['supplier_panel_show','supplier_panel_hide','supplier_view_grid','supplier_view_list']){
  for(const lang of ['lt','en','es','de','ru']) ok(i18n.includes('"'+key+'"'),`missing i18n key ${key}`);
}
ok(h.includes('?v=188'),'index must cache-bust current frontend assets');
console.log('PASS V176 public focus, brand scale and compact supplier dashboard');