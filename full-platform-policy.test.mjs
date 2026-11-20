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
