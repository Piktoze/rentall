import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync('./app.js','utf8');
const css=fs.readFileSync('./styles.css','utf8');
const from=app.indexOf('  const historicalTermsLt=new Map(');
const to=app.indexOf('  function agreementCancellationLabel(',from);
assert.ok(from>=0&&to>from,'Historic agreement clause translations are present');
const fn=vm.runInNewContext(app.slice(from,to)+'\n agreementTermsForDisplay;',{
  window:{RentInOrbitI18n:{getLanguage:()=> 'lt'}},
  document:{documentElement:{lang:'lt'}}
});
const historic=[
 'Use the item only for its intended purpose.',
 'Return the item on time in the condition received, allowing for normal wear.',
 'Damage, loss, cancellation and deposit handling follow the listing and RentInOrbit terms.'
];
const converted=fn({terms:historic});
assert.equal(converted.length,3);
assert.ok(converted.every(text=>/[ąčęėįšųūž]/i.test(text)),'Historical English instructions must be readable in Lithuanian');
assert.equal(fn({terms:['Unrecognized contractual clause']} )[0],'Unrecognized contractual clause','Unknown legal terms must not be silently replaced');
const supplier=app.slice(app.indexOf("pane.className='supplier-order-card'"),app.indexOf("pane.querySelector('.rio-supplier-transfer')?.addEventListener('click'"));
assert.ok(supplier.includes('agreement?.supplierAcceptedAt'),'Supplier button state must use server signature timestamp');
assert.ok(supplier.includes('agreement?.customerAcceptedAt'),'Both-party status must come from server');
assert.ok(supplier.includes('agreementButton.hidden=supplierVerified'),'Only verified supplier acceptance can hide the reattestation control');
assert.ok(supplier.includes('if(ag.supplierAcceptedAt && agreementButton.hidden)'),'Verified acceptance prevents duplicate consent and legacy evidence gaps remain re-signable');
assert.ok(supplier.includes('await refreshSupplierAgreementState()'),'Successful POST must re-fetch server audit evidence before hiding the button');
assert.ok(supplier.includes("const terms=agreementTermsForDisplay(ag.snapshot)"),'Supplier confirmation must localize historic terms');
assert.ok(supplier.includes("'NUOMOTOJO SUTARTIES PATVIRTINIMAS\\n\\nDaiktas:"),'Supplier confirm must use real newline escapes');
assert.ok(!supplier.includes("'NUOMOTOJO SUTARTIES PATVIRTINIMAS\\\\n"),'Do not print literal backslash-n in confirmation');
assert.ok(app.includes('if(ag.customerAcceptedAt && data.acceptanceEvidence?.customer?.verified===true)'),'Only an audit-verified renter acceptance can prevent explicit re-consent');
assert.ok(css.includes('#supplierOrderActions .rio-supplier-agreement[hidden]{display:none!important}'),'CSS must honor hidden accepted button');
assert.ok(css.includes('#supplierOrderModal .rio-supplier-agreement-status'),'Acceptance status needs styled accessible display');
assert.ok(css.includes('.section.soft{background:#f2f6ff}'),'Legacy green neutral sections must be blue');
console.log('PASS agreement consent state, historical Lithuanian terms, newline escapes and blue-neutral surfaces');