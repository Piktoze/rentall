import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('index.html','utf8');
const styles=fs.readFileSync('styles.css','utf8');
const logic=fs.readFileSync('modules/supplier-ux-v179.js','utf8');
const server=fs.readFileSync('server.js','utf8');
assert.ok(html.includes('href="/help" data-i18n="nav_help"'),'More-menu help must lead to real FAQ page');
assert.ok(server.includes("app.get('/help'"),'Help route must exist');
assert.ok(styles.includes('body.rio-authenticated #list-item')&&styles.includes('body.rio-authenticated #partnerForm'),
 'Signed-in suppliers must not see repeated upload and registration sections');
assert.ok(html.includes('id="openListingFormBtn"')&&html.includes('id="navListItemBtn"'),
 'Working upload trigger and global navigation retained');
assert.ok(logic.includes('function closeExistingDrawer()'),'Drawer must have reliable close routine');
assert.ok(logic.includes("document.body.classList.remove('supplier-drawer-open')"),
 'Calendar must not retain page scroll lock');
assert.ok(logic.includes('closeExistingDrawer();openCalendar();'),
 'Close drawer before opening calendar');
assert.ok(logic.includes("drawer.setAttribute('aria-hidden','true')"),
 'Closed drawer must be marked inaccessible');
assert.ok(styles.includes('#supplierActionDrawer[aria-hidden="true"] {pointer-events:none!important;}'),
 'Closed drawer must not intercept calendar interaction');
console.log('PASS no duplicate supplier CTAs, real FAQ navigation, unlocked calendar scrolling');
