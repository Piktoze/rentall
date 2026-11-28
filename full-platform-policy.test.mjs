import test from 'node:test';import assert from 'node:assert/strict';
import {fullPlatformPolicy} from './modules/full-platform-policy.js';import {getPolicyPage} from './modules/help-center-content-v177.js';
test('full LT platform discloses actual roles and does not invent VAT or TEST backups',()=>{
 const env={LEGAL_OPERATOR_NAME:'TEST operator',LEGAL_IV_CERTIFICATE:'synthetic',LEGAL_OPERATOR_ADDRESS:'Synthetic address',PRIVATE_TEST_ENABLED:'true',DB_BACKUP_ENABLED:'true',BACKUP_SCHEDULER_ENABLED:'true'};
 const terms=fullPlatformPolicy(getPolicyPage('lt','terms'),{key:'terms',env});
 assert.match(JSON.stringify(terms),/14 dienų/);assert.match(JSON.stringify(terms),/85 %/);assert.match(JSON.stringify(terms),/tik savo komisiniui/);
 const privacy=fullPlatformPolicy(getPolicyPage('lt','privacy'),{key:'privacy',env});
 assert.match(JSON.stringify(privacy),/kopijos išjungtos/);assert.match(JSON.stringify(privacy),/12 mėnesių/);assert.doesNotMatch(JSON.stringify(privacy),/kopijavimas įjungtas/);
 const fees=fullPlatformPolicy(getPolicyPage('lt','fees'),{key:'fees',env});assert.match(JSON.stringify(fees),/PVM statusas.*nepatvirtinti/);
 assert.doesNotMatch(JSON.stringify(privacy),/neprivalo priimti|garantuotai ištrinami po/);
});

test('LT and EN commercial drafts disclose matching critical obligations without changing base pages',()=>{
 const env={LEGAL_OPERATOR_NAME:'Synthetic operator',LEGAL_IV_CERTIFICATE:'TEST-123',LEGAL_OPERATOR_ADDRESS:'Synthetic address',PRIVATE_TEST_ENABLED:'true'};
 const checks={
 lt:{terms:[/15 %/,/85 %/,/neteikia daikto draudimo/,/grąžinama visa nuomos suma/,/atšaukimo bauda netaikoma/,/ginklus/,/14 dienų/],privacy:[/10 metų/,/12 mėnesių/,/Zoho DPA/,/kontrolinę sumą/],fees:[/15 €/,/85 €/]},
 en:{terms:[/15%/,/85%/,/no item insurance/,/full paid rental amount is refunded/,/without a separate platform cancellation penalty/,/Weapons/,/14 days/],privacy:[/ten-year/,/12 months/,/Zoho DPA/,/hashes/],fees:[/EUR 15/,/EUR 85/,/Stripe processing, Connect and payout costs/]}
 };
 for(const [lang,pages] of Object.entries(checks)){
  for(const [key,patterns] of Object.entries(pages)){
   const base=getPolicyPage(lang,key),before=JSON.stringify(base);
   const rendered=JSON.stringify(fullPlatformPolicy(base,{lang,key,env}));
   for(const pattern of patterns)assert.match(rendered,pattern,lang+' '+key);
   assert.match(rendered,/Synthetic operator/);
   assert.match(rendered,/TEST-123/);
   assert.equal(JSON.stringify(base),before,'Base document must remain unchanged');
  }
 }
});
