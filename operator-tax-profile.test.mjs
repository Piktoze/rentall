import test from 'node:test';import assert from 'node:assert/strict';
import {operatorTaxProfile} from './modules/operator-tax-profile.js';
import {invoiceOperatorProfile} from './modules/accounting-sf-v286.js';
import {invoiceIssuerPlan} from './modules/invoice-issuer-plan.js';
import {fullPlatformPolicy} from './modules/full-platform-policy.js';import {getPolicyPage} from './modules/help-center-content-v177.js';
const env={LEGAL_OPERATOR_NAME:'Synthetic operator',LEGAL_IV_CERTIFICATE:'751612',LEGAL_ACTIVITY_CODE:'775200',LEGAL_ACTIVITY_CLASSIFICATION:'EVRK_2_1',LEGAL_OPERATOR_VAT_MODE:'not_vat_registered',LEGAL_OPERATOR_ADDRESS:'Synthetic address'};
test('declared non-VAT status and activity code remain distinct from IV certificate and foreign VAT duties',()=>{
 const p=invoiceOperatorProfile(env);assert.equal(p.individualActivityCertificate,'751612');assert.equal(p.activityCode,'775200');assert.equal(p.vatMode,'not_vat_registered');
 assert.equal(p.foreignServicesVatReviewRequired,true);assert.equal(operatorTaxProfile(env).accountingIssuanceAllowed,false);
 const text=JSON.stringify(fullPlatformPolicy(getPolicyPage('lt','fees'),{key:'fees',env}));assert.match(text,/775200/);assert.match(text,/ne PVM mokėtoja/);assert.match(text,/užsienio paslaugų/);assert.doesNotMatch(text,/PVM tarifas.*0 %/);
 const plan=invoiceIssuerPlan({booking:{bookingId:'synthetic',listingId:'item',orderValue:100,platformFeeAmount:15},listing:{listingId:'item',ownerEmail:'synthetic@example.test'},operatorVatMode:p.vatMode,foreignServicesVatReviewRequired:p.foreignServicesVatReviewRequired});
 assert.equal(plan.platform.amountCents,1500);assert.equal(plan.platform.issuanceAllowed,false);assert.ok(plan.platform.blockers.includes('FOREIGN_SERVICES_VAT_REVIEW_REQUIRED'));assert.ok(!plan.platform.blockers.includes('OPERATOR_TAX_STATUS_REQUIRED'));
});
test('missing or unsupported tax configuration never silently means non-VAT or SVS',()=>{
 assert.equal(operatorTaxProfile({}).vatMode,'pending_review');assert.equal(operatorTaxProfile({LEGAL_OPERATOR_VAT_MODE:'exempt_forever'}).vatMode,'pending_review');
 assert.equal(operatorTaxProfile({...env,LEGAL_OPERATOR_VAT_MODE:'lt_svs'}).foreignServicesVatReviewRequired,true);
});
