import {createIsolatedStripeTestClient} from './modules/isolated-stripe-test-client.js';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import Database from 'better-sqlite3';
import {installIsolatedSctRecipientCreationJournal}
  from './modules/isolated-sct-recipient-creation-journal.js';
import {createIsolatedSctTestRecipient}
  from './modules/isolated-sct-test-recipient-creator.js';
import {inspectUncertainIsolatedSctRecipientCreation}
  from './modules/isolated-sct-recipient-uncertain-reconciliation.js';

const base={
  stripeMode:'test',stripeSecretKey:'sk_test_synthetic12345678',
  supplierId:'synthetic-supplier-review',country:'LT',entityType:'individual',
  contactEmail:'synthetic@example.invalid',displayName:'Synthetic supplier',
  termsAccepted:true,platformLiabilityApproved:true,
};
const account={
  id:'acct_synthetic777',livemode:false,contact_email:'synthetic@example.invalid',
  display_name:'Synthetic supplier',
  dashboard:'express',identity:{country:'LT',entity_type:'individual'},
  configuration:{recipient:{capabilities:{
    stripe_balance:{stripe_transfers:{requested:true,status:'pending'}},
  }}},
  defaults:{responsibilities:{fees_collector:'application',losses_collector:'application'}},
  requirements:{entries:[]},
};
async function fixture(){
  const db=new Database(':memory:');
  installIsolatedSctRecipientCreationJournal(db);
  let created=0,retrieved=0;
  const stripe=Object.assign(createIsolatedStripeTestClient(base.stripeSecretKey),{
    v2:{core:{accounts:{
    create:async()=>{created++;throw new Error('uncertain network response')},
    retrieve:async()=>{retrieved++;return account},
  }}}});
  const attempt=await createIsolatedSctTestRecipient({db,stripe,...base});
  assert.equal(attempt.blocked,'account_creation_requires_reconciliation');
  assert.equal(created,1);
  const inspect=(extra={})=>inspectUncertainIsolatedSctRecipientCreation({
    db,stripe,...base,candidateAccountId:account.id,...extra,
  });
  return {db,stripe,inspect,get retrieved(){return retrieved}};
}
test('matching uncertain recipient only returns manual review, never assigns account',async()=>{
  const x=await fixture();
  try{
    const report=await x.inspect();
    assert.equal(report.status,'manual_stripe_request_evidence_required');
    assert.equal(report.candidateMatchesRequestFields,true);
    assert.equal(report.automaticAccountAssignment,false);
    assert.equal(report.recipientTransfersReady,false);
    assert.equal(report.bankPayoutsReady,false);
    assert.equal(x.db.prepare('SELECT stripe_account_id FROM sct_test_recipient_creation_commands').get().stripe_account_id,null);
  }finally{x.db.close()}
});
test('changed original email, name or entity cannot inspect an uncertain command',async()=>{
  const x=await fixture();
  try{
    for(const extra of [
      {contactEmail:'another@example.invalid'},
      {displayName:'Other supplier'},
      {entityType:'company'},
    ])assert.equal((await x.inspect(extra)).blocked,'original_creation_proof_unavailable');
    assert.equal(x.retrieved,0);
  }finally{x.db.close()}
});
test('tampered or older null digest blocks recovery before Stripe API',async()=>{
  for(const digest of [null,'a'.repeat(64)]){
    const x=await fixture();
    try{
      x.db.prepare('UPDATE sct_test_recipient_creation_commands SET plan_digest=?')
        .run(digest);
      assert.equal((await x.inspect()).blocked,'original_creation_proof_unavailable');
      assert.equal(x.retrieved,0);
    }finally{x.db.close()}
  }
});
test('LIVE client and candidate with wrong identity never considered reconciled',async()=>{
  const x=await fixture();
  try{
    assert.equal((await x.inspect({stripeMode:'live'})).blocked,'test_only');
    assert.equal((await x.inspect({stripeSecretKey:'sk_live_fakekey1234'})).blocked,
      'verifiable_test_accounts_v2_client_required');
    for(const changes of [
      {id:'acct_other'},{livemode:true},
      {contact_email:'other@example.invalid'},
      {configuration:{merchant:{capabilities:{card_payments:{status:'active'}}}}},
      {defaults:{responsibilities:{fees_collector:'stripe',losses_collector:'stripe'}}},
    ]){
      const stripe=Object.assign(createIsolatedStripeTestClient(base.stripeSecretKey),{
    v2:{core:{accounts:{
        retrieve:async()=>({...account,...changes}),
      }}}});
      assert.equal((await x.inspect({stripe})).blocked,
        'candidate_account_does_not_match_original_request');
    }
  }finally{x.db.close()}
});
test('read-only reconciler never retries Stripe create after uncertainty',async()=>{
  const x=await fixture();
  try{
    const stripe=Object.assign(createIsolatedStripeTestClient(base.stripeSecretKey),{
    v2:{core:{accounts:{
      retrieve:async()=>account,
      create:async()=>{throw Error('must never be called')},
    }}}});
    const report=await x.inspect({stripe});
    assert.equal(report.status,'manual_stripe_request_evidence_required');
    assert.equal(x.db.prepare('SELECT status FROM sct_test_recipient_creation_commands').get().status,
      'reconcile_required');
  }finally{x.db.close()}
});
