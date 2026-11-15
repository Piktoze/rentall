import {createIsolatedStripeTestClient} from './modules/isolated-stripe-test-client.js';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import Database from 'better-sqlite3';
import {installIsolatedSctRecipientCreationJournal,syntheticRecipientPlanDigest}
  from './modules/isolated-sct-recipient-creation-journal.js';
import {planIsolatedSctRecipientOnboarding}
  from './modules/isolated-sct-recipient-onboarding-plan.js';
import {
  createIsolatedSctTestOnboardingSession as makeSession,
  inspectIsolatedSctTestRecipientAfterOnboarding as inspect,
} from './modules/isolated-sct-test-recipient-onboarding-session.js';

const secret='sk_test_synthetic987654321';
const supplierId='synthetic-supplier-onboarding';
const accountId='acct_synthetic777';
const sessionToken='synthetic-session-token-very-long-fixed-for-tests';
const ownerUserId='synthetic-owner-one';
const account={
  id:accountId,livemode:false,dashboard:'express',
  identity:{country:'LT',entity_type:'individual'},
  defaults:{responsibilities:{fees_collector:'application',losses_collector:'application'}},
  configuration:{recipient:{capabilities:{stripe_balance:{
    stripe_transfers:{requested:true,status:'pending'},
  }}}},
  requirements:{entries:[{type:'identity_document'}]},
};
function fixture({accountResponse=account,sessionResponse={
  account:accountId,client_secret:'acs_test_synthetic_secret',
}}={}){
  const db=new Database(':memory:');
  installIsolatedSctRecipientCreationJournal(db);
  db.exec(`CREATE TABLE app_users(user_id TEXT PRIMARY KEY,role TEXT NOT NULL);
    CREATE TABLE app_sessions(session_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL);
    INSERT INTO app_users(user_id,role) VALUES('synthetic-owner-one','supplier');
  `);
  db.prepare('INSERT INTO app_sessions(session_hash,user_id,expires_at) VALUES(?,?,?)')
    .run(createHash('sha256').update(sessionToken).digest('hex'),ownerUserId,
      '2099-01-01T00:00:00Z');

  const plan=planIsolatedSctRecipientOnboarding({
    stripeMode:'test',country:'LT',entityType:'individual',
    contactEmail:'synthetic@example.invalid',displayName:'Synthetic supplier',
    termsAccepted:true,platformLiabilityApproved:true,
  });
  const digest=syntheticRecipientPlanDigest(plan.accountCreatePayload);
  db.prepare(`INSERT INTO sct_test_recipient_creation_commands
   (supplier_id,legal_entity_type,idempotency_key,status,stripe_account_id,plan_digest,owner_user_id)
   VALUES(?,?,'idem_fixture','created_pending_onboarding',?,?,?)`)
   .run(supplierId,'individual',accountId,digest,ownerUserId);
  let sessions=0,reads=0,payload;
  const stripe=Object.assign(createIsolatedStripeTestClient(secret),{
    v2:{core:{accounts:{
    retrieve:async()=>{reads++;return accountResponse},
  }}},accountSessions:{create:async p=>{
    sessions++;payload=p;return sessionResponse;
  }}});
  const base={db,stripe,stripeMode:'test',stripeSecretKey:secret,
    supplierId,entityType:'individual',accountId,sessionToken};
  return {db,stripe,base,get sessions(){return sessions},
    get reads(){return reads},get payload(){return payload}};
}
test('authorized synthetic LT recipient opens ONLY TEST onboarding session',async()=>{
  const x=fixture();
  try{
    const result=await makeSession({...x.base});
    assert.equal(result.status,'test_onboarding_session_created');
    assert.equal(result.clientSecret,'acs_test_synthetic_secret');
    assert.equal(result.recipientTransfersReady,false);
    assert.equal(result.bankPayoutsReady,false);
    assert.equal(x.reads,1);assert.equal(x.sessions,1);
    assert.deepEqual(x.payload,{
      account:accountId,
      components:{
        account_onboarding:{enabled:true},
        notification_banner:{enabled:true},
      },
    });
  }finally{x.db.close()}
});
test('different signed-in supplier cannot obtain onboarding session',async()=>{
  const x=fixture();
  try{
    const result=await makeSession({...x.base,
      sessionToken:'spoofed-session-token-very-long'});
    assert.equal(result.blocked,'verified_supplier_session_required');
    assert.equal(x.reads,0);assert.equal(x.sessions,0);
  }finally{x.db.close()}
});
test('LIVE context, wrong key and unbound or uncertain supplier block all session calls',async()=>{
  const x=fixture();
  try{
    for(const change of [
      {stripeMode:'live'},
      {stripeSecretKey:'sk_live_example123456'},
      {accountId:'acct_other'},
      {supplierId:'synthetic-supplier-other'},
    ]){
      const result=await makeSession({...x.base,
        ...change});
      assert.ok(result.blocked);
    }
    x.db.exec(`UPDATE sct_test_recipient_creation_commands SET status='reconcile_required'`);
    assert.equal((await makeSession({...x.base,
      })).blocked,
      'recipient_account_not_bound_to_supplier');
    assert.equal(x.reads,0);assert.equal(x.sessions,0);
  }finally{x.db.close()}
});
test('wrong Stripe account mode, entity, merchant model or liability blocks session',async()=>{
  for(const overrides of [
    {livemode:true},{id:'acct_other'},
    {identity:{country:'GB',entity_type:'individual'}},
    {configuration:{merchant:{capabilities:{card_payments:{status:'active'}}}}},
    {defaults:{responsibilities:{fees_collector:'stripe',losses_collector:'stripe'}}},
  ]){
    const x=fixture({accountResponse:{...account,...overrides}});
    try{
      assert.equal((await makeSession({...x.base,
        })).blocked,
        'recipient_onboarding_account_mismatch');
      assert.equal(x.sessions,0);
    }finally{x.db.close()}
  }
});
test('after onboarding capability must become active; bank payout remains unverified',async()=>{
  const x=fixture();
  try{
    assert.equal((await inspect(x.base)).blocked,'recipient_stripe_transfers_not_active');
  }finally{x.db.close()}
  const ready={...account,
    requirements:{entries:[]},
    configuration:{recipient:{capabilities:{stripe_balance:{
      stripe_transfers:{requested:true,status:'active'},
    }}}}};
  const y=fixture({accountResponse:ready});
  try{
    const result=await inspect(y.base);
    assert.equal(result.status,'test_recipient_transfer_capability_verified');
    assert.equal(result.bankPayoutReadiness,'not_verified');
    assert.equal(result.accountOwnership,'not_verified');
    assert.equal(y.sessions,0);
  }finally{y.db.close()}
});
test('invalid account session does not claim onboarding completed',async()=>{
  const x=fixture({sessionResponse:{account:accountId,client_secret:null}});
  try{
    const result=await makeSession({...x.base});
    assert.equal(result.blocked,'recipient_onboarding_session_invalid');
    assert.equal(x.db.prepare(`SELECT status FROM sct_test_recipient_creation_commands`).get().status,
      'created_pending_onboarding');
  }finally{x.db.close()}
});

test('caller-provided supplier ID alone cannot authorize onboarding or readiness',async()=>{
  const x=fixture();
  try{
    assert.equal((await makeSession({...x.base,sessionToken:undefined})).blocked,
      'authenticated_synthetic_supplier_required');
    assert.equal((await inspect({...x.base,sessionToken:'invalid-but-long-token-123456789'})).blocked,
      'verified_supplier_session_required');
    assert.equal(x.sessions,0);
  }finally{x.db.close()}
});
test('expired, customer-role, wrong-owner or unbound legacy account blocks session',async()=>{
  for(const change of ['expired','customer','wrong_owner','unbound']){
    const x=fixture();
    try{
      if(change==='expired')x.db.exec("UPDATE app_sessions SET expires_at='2001-01-01T00:00:00Z'");
      if(change==='customer')x.db.exec("UPDATE app_users SET role='customer'");
      if(change==='wrong_owner')x.db.exec("UPDATE sct_test_recipient_creation_commands SET owner_user_id='another-user'");
      if(change==='unbound')x.db.exec("UPDATE sct_test_recipient_creation_commands SET owner_user_id=NULL");
      assert.equal((await makeSession(x.base)).blocked,'verified_supplier_session_required');
      assert.equal(x.sessions,0);
      assert.equal(x.reads,0);
    }finally{x.db.close()}
  }
});
