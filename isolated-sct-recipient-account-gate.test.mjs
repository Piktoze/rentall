import assert from 'node:assert/strict';
import {test} from 'node:test';
import {inspectIsolatedSctRecipientAccount as inspect}
  from './modules/isolated-sct-recipient-account-gate.js';

const individual={
  id:'acct_fixture',identity:{country:'LT',entity_type:'individual'},
  dashboard:'express',configuration:{recipient:{capabilities:{
    stripe_balance:{stripe_transfers:{status:'active'}},
  }}},
  defaults:{responsibilities:{
    fees_collector:'application',losses_collector:'application',
  }},
  requirements:{currently_due:[],past_due:[]},
};
const opts={expectedAccountId:'acct_fixture',expectedEntityType:'individual'};
test('LT individual recipient may pass transfer capability inspection, NOT bank payout or ownership',()=>{
  const x=inspect(individual,opts);
  assert.equal(x.status,'test_recipient_transfer_capability_verified');
  assert.equal(x.transferCapability,'active');
  assert.equal(x.bankPayoutReadiness,'not_verified');
  assert.equal(x.accountOwnership,'not_verified');
  assert.equal(x.testTransferExecuted,false);
});
test('LT company uses distinct verified legal-entity type',()=>{
  const x=inspect({...individual,identity:{country:'LT',entity_type:'company'}},{
    ...opts,expectedEntityType:'company',
  });
  assert.equal(x.entityType,'company');
  assert.equal(inspect(individual,{...opts,expectedEntityType:'company'}).blocked,
    'recipient_country_or_entity_mismatch');
});
test('merchant-only direct-charge account is not an SCT recipient',()=>{
  const direct={...individual,configuration:{merchant:{
    capabilities:{card_payments:{status:'active'}},
  }}};
  assert.equal(inspect(direct,opts).blocked,'recipient_only_account_required');
});
test('full dashboard, wrong fee payer or Stripe-owned negative balance block SCT',()=>{
  for(const account of [
    {...individual,dashboard:'full'},
    {...individual,defaults:{responsibilities:{
      fees_collector:'stripe',losses_collector:'application',
    }}},
    {...individual,defaults:{responsibilities:{
      fees_collector:'application',losses_collector:'stripe',
    }}},
  ])assert.equal(inspect(account,opts).blocked,'sct_dashboard_or_liability_mismatch');
});
test('pending transfer capability, missing requirements or old account ID block',()=>{
  const cases=[
    [{...individual,configuration:{recipient:{capabilities:{
      stripe_balance:{stripe_transfers:{status:'pending'}},
    }}}},'recipient_stripe_transfers_not_active'],
    [{...individual,requirements:null},'recipient_requirements_unresolved'],
    [{...individual,requirements:{}},'recipient_requirements_unresolved'],
    [{...individual,requirements:{entries:[{type:'identity'}]}},
      'recipient_requirements_unresolved'],
    [{...individual,requirements:{currently_due:['identity'],past_due:[]}},
      'recipient_requirements_unresolved'],
    [{...individual,requirements:{currently_due:[],past_due:['external_account']}},
      'recipient_requirements_unresolved'],
    [{...individual,id:'acct_other'},'connected_account_identity_mismatch'],
    [{...individual,identity:{country:'GB',entity_type:'individual'}},
      'recipient_country_or_entity_mismatch'],
  ];
  for(const [account,expected] of cases)assert.equal(inspect(account,opts).blocked,expected);
});

test('Accounts v2 empty requirements entries can establish capability-only readiness',()=>{
  const x=inspect({...individual,requirements:{entries:[]} },opts);
  assert.equal(x.status,'test_recipient_transfer_capability_verified');
  assert.equal(x.bankPayoutReadiness,'not_verified');
});
