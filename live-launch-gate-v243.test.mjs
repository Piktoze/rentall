import assert from 'node:assert/strict';
import {assertProductionConfig,liveLaunchReadinessReport,productionConfigReport} from './config.js';

// No credential literals, provider calls, Railway volume access or real payments.
const fake=(prefix,mode,name)=>[prefix,mode,name].join('_');
const base={
 NODE_ENV:'production',RAILWAY_ENVIRONMENT_ID:'test-environment',
 APP_URL:'https://rentinorbit.example',PUBLIC_BASE_URL:'https://rentinorbit.example',
 SESSION_SECRET:'R4nD0m!aB3cD4eF5gH6iJ7kL8mN9pQ2rS',
 TRUST_PROXY_HOPS:'1',RENTINORBIT_DB_PATH:'/data/rentinorbit.sqlite',
 UPLOADS_DIR:'/data/uploads',RAILWAY_VOLUME_MOUNT_PATH:'/data',
 STRIPE_MODE:'live',STRIPE_SECRET_KEY:fake('rk','live','syntheticRestrictedKey123'),
 STRIPE_PUBLISHABLE_KEY:fake('pk','live','syntheticPublicKey123'),
 STRIPE_WEBHOOK_SECRET:fake('whsec','syntheticWebhookKey123','test'),
 STRIPE_CONNECT_WEBHOOK_SECRET:fake('whsec','syntheticConnectWebhook123','test'),
 STRIPE_CONNECT_V2_PROVISIONING:'true',
 EMAIL_PROVIDER:'resend',EMAIL_FROM:'bookings@rentinorbit.example',
 RESEND_API_KEY:'re_syntheticApiKey123',EMAIL_WORKER_ENABLED:'true',
 EMAIL_WORKER_TOKEN:'V4lid-Worker-Token-2026-RentInOrbit-ghijkl!',
 SUPPORT_EMAIL:'support@rentinorbit.example',
 MAPS_PROVIDER:'stub',SMS_PROVIDER:'disabled',PUSH_PROVIDER:'disabled',
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
const report=liveLaunchReadinessReport(base);
assert.equal(report.ready,true,'Synthetic complete LIVE configuration passes local checks');
assert.deepEqual(report.blocking,[]);
assert.ok(report.externalVerificationRequired.includes('platform_charges_enabled'));
const testMode={...base,STRIPE_MODE:'test',STRIPE_SECRET_KEY:fake('rk','test','syntheticRestrictedKey123'),
 STRIPE_PUBLISHABLE_KEY:fake('pk','test','syntheticPublicKey123')};
assert.equal(productionConfigReport(testMode).ready,true,
 'Legacy deployment gate intentionally supports test-mode configuration');
assert.equal(liveLaunchReadinessReport(testMode).ready,false,
 'A production deployment with test keys must never be marked LIVE launch-ready');
assert.doesNotThrow(()=>assertProductionConfig({...testMode,RENTINORBIT_STAGING:'true',LEGAL_TEXTS_REVIEWED:''}));
assert.doesNotThrow(()=>assertProductionConfig(base));
assert.throws(()=>assertProductionConfig({...base,LEGAL_TEXTS_REVIEWED:''}),
 {code:'LIVE_LAUNCH_CONFIG_INVALID'},'LIVE startup must enforce the existing launch prerequisites');
for(const [change,expected] of [
 [{RENTINORBIT_STAGING:'true'},'production_configuration'],
 [{STRIPE_SECRET_KEY:fake('rk','test','syntheticRestrictedKey123')},'stripe_live_secret'],
 [{STRIPE_PUBLISHABLE_KEY:fake('pk','test','syntheticPublicKey123')},'stripe_live_publishable'],
 [{STRIPE_WEBHOOK_SECRET:''},'stripe_webhook_signing'],
 [{STRIPE_CONNECT_WEBHOOK_SECRET:''},'stripe_connect_webhook_signing'],
 [{STRIPE_CONNECT_V2_PROVISIONING:'false'},'stripe_connect_v2']
]){
 assert.ok(liveLaunchReadinessReport({...base,...change}).blocking.includes(expected),
   'LIVE gate must block '+expected);
}
const safeReport=JSON.stringify(report);
assert.ok(!safeReport.includes('syntheticRestrictedKey123'),'Never expose secret values');
assert.ok(!safeReport.includes('syntheticWebhookKey123'),'Never expose webhook secrets');
console.log('PASS LIVE launch readiness gate: test keys rejected, live mode required, external checks remain explicit');
