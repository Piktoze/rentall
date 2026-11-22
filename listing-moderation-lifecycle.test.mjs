import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'rio-moderation-'));
Object.assign(process.env,{NODE_ENV:'test',DB_PATH:path.join(root,'synthetic.sqlite'),UPLOADS_DIR:path.join(root,'uploads'),DATABASE_URL:'',RENTINORBIT_DB_PATH:'',RAILWAY_VOLUME_MOUNT_PATH:'',PRIVATE_TEST_ENABLED:'false',PRIVATE_TEST_REQUIRED:'false',RENTALL_SEED_DEMO_USERS:'false'});
const {db,submitListingReview,decideListingReview,listPendingListingReviews,getPublicRentalListing,listPublicRentalListings,listOwnerRentalListings,closeDatabase}=await import('./db.js');
test('pending/rejected revisions never inherit previous public approval; corrected resubmission needs a fresh decision',()=>{
 try{
  const email='synthetic-owner@example.test',draft={id:'SYNTHETIC-MODERATION',title:'Synthetic item',country:'LT',city:'Klaipėda',quantity:1,priceDay:20,description:'Initial synthetic description',photos:['/uploads/synthetic-a.png','/uploads/synthetic-b.png']};
  const visible=()=>listPublicRentalListings().some(l=>l.id===draft.id);
  const decide=(status,reason)=>{const q=listPendingListingReviews().find(l=>l.listingId===draft.id);return decideListingReview({listingId:draft.id,revision:q.revision,status,reason,adminId:'synthetic-admin',validate:x=>x});};
  submitListingReview(draft,email);assert.equal(visible(),false);assert.equal(getPublicRentalListing(draft.id),null);
  decide('approved');assert.equal(visible(),true);
  submitListingReview({...draft,description:'Edit after prior approval'},email);assert.equal(visible(),false);assert.equal(getPublicRentalListing(draft.id),null);
  const prior=listPendingListingReviews().find(l=>l.listingId===draft.id).revision;
  decide('rejected','Describe condition');assert.equal(visible(),false);assert.equal(listOwnerRentalListings(email)[0].reviewReason,'Describe condition');
  submitListingReview({...draft,description:'Corrected condition'},email);assert.equal(visible(),false);assert.equal(listOwnerRentalListings(email)[0].reviewReason,null);
  assert.throws(()=>decideListingReview({listingId:draft.id,revision:prior,status:'approved',adminId:'synthetic-admin',validate:x=>x}),e=>e.status===409);
  decide('approved');assert.equal(visible(),true);assert.equal(getPublicRentalListing(draft.id).description,'Corrected condition');
  assert.equal(db.prepare('SELECT count(*) n FROM listing_review_history WHERE listing_id=?').get(draft.id).n,3);
 }finally{closeDatabase();fs.rmSync(root,{recursive:true,force:true});}
});
