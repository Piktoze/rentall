import assert from 'node:assert/strict';
import {legalLaunchReadinessReport} from './config.js';

// Validation only: synthetic, non-identifying company/contact data.
const empty=legalLaunchReadinessReport({});
assert.equal(empty.ready,false,'Missing operator identity cannot be launch ready');
for(const item of ['operator_identity','operator_legal_form','operator_service_address',
 'operator_contact','complaints_contact','privacy_controller_contact',
 'supplier_trader_status_disclosure','dsa_trader_traceability',
 'privacy_retention_schedule','consumer_dispute_information','legal_texts_reviewed'])
 assert.ok(empty.blocking.includes(item),'Missing legal blocker: '+item);
const complete={
 LEGAL_OPERATOR_NAME:'Synthetic Operator for Tests',
 LEGAL_OPERATOR_LEGAL_FORM:'synthetic-business-form',
 LEGAL_OPERATOR_ADDRESS:'Synthetic registered address, EU',
 LEGAL_SUPPORT_EMAIL:'support@example.invalid',
 LEGAL_COMPLAINTS_EMAIL:'complaints@example.invalid',
 LEGAL_PRIVACY_CONTACT:'privacy@example.invalid',
 LEGAL_TRADER_STATUS_DISCLOSURE_READY:'true',
 LEGAL_DSA_TRADER_VERIFICATION_READY:'true',
 LEGAL_PRIVACY_RETENTION_SCHEDULE_READY:'true',
 LEGAL_CONSUMER_ADR_INFO_READY:'true',
 LEGAL_TEXTS_REVIEWED:'true'
};
const valid=legalLaunchReadinessReport(complete);
assert.equal(valid.ready,true,'All declared prerequisites should pass configuration check');
assert.equal(valid.independentReviewRequired,true,
 'Configured declarations must never imply legal certification');
assert.equal(legalLaunchReadinessReport({...complete,LEGAL_DSA_TRADER_VERIFICATION_READY:'false'}).ready,false);
assert.equal(legalLaunchReadinessReport({...complete,LEGAL_PRIVACY_CONTACT:'not an email'}).ready,false);
assert.equal(legalLaunchReadinessReport({...complete,LEGAL_OPERATOR_NAME:''}).ready,false);
assert.ok(!JSON.stringify(valid).includes('Synthetic registered address'),
 'Audit report must expose only check statuses, never personal legal contact data');
console.log('PASS legal launch gate: operator, consumer, DSA, GDPR blockers and mandatory independent review');
