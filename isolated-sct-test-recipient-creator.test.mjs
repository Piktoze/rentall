import {createIsolatedStripeTestClient} from './modules/isolated-stripe-test-client.js';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import Database from 'better-sqlite3';
import {installIsolatedSctRecipientCreationJournal}
  from './modules/isolated-sct-recipient-creation-journal.js';
import {createIsolatedSctTestRecipient as create}
  from './modules/isolated-sct-test-recipient-creator.js';

const base={
  stripeMode:'test',stripeSecretKey:'sk_test_synthetic12345678',
  supplierId:'synthetic-supplier-one',country:'LT',entityType:'individual',
  contactEmail:'synthetic@example.invalid',displayName:'Synthetic supplier',
  termsAccepted:true,platformLiabilityApproved:true,
};
const account={
  id:'acct_synthetic123',livemode:false,dashboard:'express',
  identity:{country:'LT',entity_type:'individual'},
  defaults:{responsibilities:{fees_collector:'application',losses_collector:'application'}},
  configuration:{recipient:{capabilities:{
    stripe_balance:{stripe_transfers:{requested:true,status:'pending'}},
  }}},
  requirements:{entries:[{type:'individual.verification'}]},
};
function setup({created=account,createError=false,retrieveError=false}={}){
  const db=new Database(':memory:');
  installIsolatedSctRecipientCreationJournal(db);
  let calls=0,reads=0,seenPayload,seenKey;
  const stripe=Object.assign(createIsolatedStripeTestClient(base.stripeSecretKey),{
    v2:{core:{accounts:{
      create:async(payload,{idempotencyKey})=>{
        calls++;seenPayload=payload;seenKey=idempotencyKey;
        if(createError)throw new Error('network timeout');
        return {id:'acct_synthetic123'};
      },
      retrieve:async()=>{
        reads++;
        if(retrieveError)throw new Error('readback timeout');
        return created;
      },
    }}},
  });
  const run=(extra={})=>create({db,stripe,...base,...extra});
  return {db,run,get calls(){return calls},get reads(){return reads},
    get payload(){return seenPayload},get key(){return seenKey}};
}
test('one TEST individual account is created, read back and retained as pending onboarding',async()=>{
  const x=setup();
  try{
    const result=await x.run();
    assert.deepEqual(result,{status:'created_pending_onboarding',
      accountId:'acct_synthetic123',recipientTransfersReady:false,bankPayoutsReady:false});
    assert.equal(x.calls,1);assert.equal(x.reads,1);
    assert.equal(x.key,'sct-test-recipient:synthetic-supplier-one:v1');
    assert.equal(x.payload.configuration.recipient.capabilities.stripe_balance.stripe_transfers.requested,true);
    assert.equal(x.payload.configuration.merchant,undefined);
    assert.equal(x.payload.defaults.responsibilities.losses_collector,'application');
    assert.equal(x.db.prepare('SELECT status FROM sct_test_recipient_creation_commands').get().status,
      'created_pending_onboarding');
    assert.equal((await x.run()).blocked,'recipient_command_requires_reconciliation');
    assert.equal(x.calls,1);
  }finally{x.db.close()}
});
test('verified company identity passes independently',async()=>{
  const x=setup({created:{...account,identity:{country:'LT',entity_type:'company'}}});
  try{
    const res=await x.run({entityType:'company',supplierId:'synthetic-supplier-company'});
    assert.equal(res.status,'created_pending_onboarding');
    assert.equal(x.calls,1);
  }finally{x.db.close()}
});
test('create timeout and readback timeout never cause second Stripe account creation',async()=>{
  for(const opts of [{createError:true},{retrieveError:true}]){
    const x=setup(opts);
    try{
      assert.equal((await x.run()).blocked,'account_creation_requires_reconciliation');
      assert.equal((await x.run()).blocked,'recipient_command_requires_reconciliation');
      assert.equal(x.calls,1);
      assert.equal(x.db.prepare('SELECT status FROM sct_test_recipient_creation_commands').get().status,
        'reconcile_required');
    }finally{x.db.close()}
  }
});
test('wrong account, LIVE response, missing recipient or wrong liability blocked',async()=>{
  for(const changed of [
    {id:'acct_other'}, {livemode:true},
    {configuration:{merchant:{capabilities:{card_payments:{status:'active'}}}}},
    {defaults:{responsibilities:{fees_collector:'stripe',losses_collector:'stripe'}}},
    {identity:{country:'DE',entity_type:'individual'}},
    {configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{requested:false}}}}}},
  ]){
    const x=setup({created:{...account,...changed}});
    try{
      assert.equal((await x.run()).blocked,'account_creation_provider_identity_requires_review');
      assert.equal((await x.run()).blocked,'recipient_command_requires_reconciliation');
      assert.equal(x.calls,1);
      assert.equal(x.db.prepare('SELECT stripe_account_id FROM sct_test_recipient_creation_commands').get().stripe_account_id,null);
    }finally{x.db.close()}
  }
});
test('LIVE or uninspectable Stripe key cannot touch journal or provider',async()=>{
  const x=setup();
  try{
    for(const change of [
      {stripeMode:'live'},
      {stripeSecretKey:'sk_live_synthetic123456'},
      {stripe:{v2:x.run.stripe?.v2}},
      {supplierId:'supplier-real'},
      {termsAccepted:false},
    ])assert.ok((await x.run(change)).blocked);
    assert.equal(x.calls,0);
    assert.equal(x.db.prepare('SELECT COUNT(*) n FROM sct_test_recipient_creation_commands').get().n,0);
  }finally{x.db.close()}
});
