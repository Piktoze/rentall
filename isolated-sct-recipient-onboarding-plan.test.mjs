import assert from 'node:assert/strict';
import {test} from 'node:test';
import {planIsolatedSctRecipientOnboarding as plan}
  from './modules/isolated-sct-recipient-onboarding-plan.js';

const base={stripeMode:'test',country:'LT',entityType:'individual',
  contactEmail:'SYNTHETIC@example.invalid',displayName:' Synthetic LT Supplier ',
  termsAccepted:true,platformLiabilityApproved:true};

test('individual and company plans use Accounts v2 recipient, never merchant, without transfers',()=>{
  for(const entityType of ['individual','company']){
    const result=plan({...base,entityType});
    assert.equal(result.operation,'accounts_v2_recipient_plan_only');
    assert.equal(result.stripeMode,'test');
    assert.equal(result.accountCreatePayload.identity.entity_type,entityType);
    assert.equal(result.accountCreatePayload.identity.country,'LT');
    assert.equal(result.accountCreatePayload.contact_email,'synthetic@example.invalid');
    assert.equal(result.accountCreatePayload.display_name,'Synthetic LT Supplier');
    assert.equal(result.accountCreatePayload.dashboard,'express');
    assert.equal(result.accountCreatePayload.defaults.responsibilities.fees_collector,'application');
    assert.equal(result.accountCreatePayload.defaults.responsibilities.losses_collector,'application');
    assert.equal(result.accountCreatePayload.configuration.recipient.capabilities.stripe_balance.stripe_transfers.requested,true);
    assert.equal(result.accountCreatePayload.configuration.merchant,undefined);
    assert.equal(result.networkCallAuthorized,false);
    assert.equal(result.stripeAccountCreated,false);
    assert.equal(result.bankPayoutReady,false);
  }
});
test('LIVE mode, non-LT recipient or invalid entity is denied',()=>{
  for(const change of [
    {stripeMode:'live'},{stripeMode:undefined},{country:'GB'},
    {entityType:'sole_trader'},{entityType:'business'},{entityType:undefined},
  ])assert.ok(plan({...base,...change}).blocked);
});
test('supplier consent, platform risk acceptance and required details must be explicit',()=>{
  for(const change of [
    {termsAccepted:false},{platformLiabilityApproved:false},
    {termsAccepted:undefined},{platformLiabilityApproved:undefined},
    {contactEmail:'x'}, {contactEmail:'a@b\n.com'},
    {displayName:'\rtest'},{displayName:' '},
  ])assert.ok(plan({...base,...change}).blocked);
});
