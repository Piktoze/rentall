import fs from 'node:fs';
import assert from 'node:assert/strict';
const ux=fs.readFileSync('modules/supplier-ux-v178.js','utf8');
const css=fs.readFileSync('light-premium-v161.css','utf8');
const html=fs.readFileSync('index.html','utf8');
assert.ok(!ux.includes("hub.id='supplierSimpleHub'"),'Do not create redundant supplier hub');
assert.ok(!ux.includes('data-v178-hub="back"'),'Remove dead supplier-center back action');
assert.ok(!ux.includes("showSupplierHome()"),'No return to redundant supplier center');
assert.ok(ux.includes('function createFeatureHeading()'),'Selected workspaces keep their own heading');
assert.ok(ux.includes("heading.id='supplierFeatureTitle'"),'Workspace heading created');
assert.ok(ux.includes("if(action==='listings'){showFeature"),'Listings are accessible through supplier menu');
assert.ok(ux.includes("if(action==='orders'){showFeature"),'Orders are accessible through supplier menu');
assert.ok(ux.includes("if(action==='calendar')"),'Calendar remains accessible');
assert.ok(ux.includes("if(action==='add'){ $('openListingFormBtn')?.click(); return; }"),
 'Supplier drawer can create a listing without hub');
assert.ok(ux.includes("createDrawer();createFeatureHeading();interceptAccountButton()"),
 'Supplier operations remain initialized without hub');
assert.ok(css.includes('body.supplier-authenticated:not(.supplier-v178-feature-mode) #supplier-dashboard{display:none!important}'),
 'Idle supplier dashboard must disappear instead of leaving an empty block');
assert.ok(css.includes('body.supplier-v178-feature-mode #supplier-dashboard{display:block!important}'),
 'Selected supplier workspace must remain accessible');
assert.ok(css.includes('#supplierFeatureTitle[hidden]{display:none!important}'),
 'Hidden heading must not take space');
assert.ok(html.includes('id="navListItemBtn"'),'Global listing button remains');
assert.ok(html.includes('id="supplierAuthBtn"'),'Supplier menu remains in header');
console.log('PASS supplier hub removed; header and menu remain single navigation source');
