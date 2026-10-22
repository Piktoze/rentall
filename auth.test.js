import fs from 'fs';
import path from 'path';

const dbFile=path.resolve('./rentall-auth-test.sqlite');
process.env.DB_PATH=dbFile;
for(const s of ['', '-shm', '-wal']){try{fs.unlinkSync(dbFile+s)}catch{}}

const {
  db,createAppUser,authenticateAppUser,createAppSession,
  getAppUserBySessionToken,deleteAppSession,
  saveFullRentalListing,listPublicRentalListings,listOwnerRentalListings
}=await import('./db.js');

function assert(v,msg){if(!v) throw new Error(msg);}

try{
  const user=createAppUser({
    email:'supplier@example.test',password:'Secret123!',
    role:'supplier',displayName:'Supplier',businessName:'Test Rentals'
  });
  assert(user.role==='supplier','Supplier role expected');
  assert(authenticateAppUser('supplier@example.test','Secret123!'),'Correct password must authenticate');
  assert(!authenticateAppUser('supplier@example.test','wrong'),'Wrong password must fail');

  const session=createAppSession(user.userId,{days:1});
  assert(getAppUserBySessionToken(session.token)?.email==='supplier@example.test','Session must resolve user');
  deleteAppSession(session.token);
  assert(!getAppUserBySessionToken(session.token),'Deleted session must be invalid');

  saveFullRentalListing({id:'L1',title:'10 chairs',quantity:10,cancellationPolicy:'moderate'},user.email);
  assert(listPublicRentalListings().length===1,'Public listing expected');
  assert(listOwnerRentalListings(user.email).length===1,'Owner listing expected');

  console.log('PASS: backend auth, sessions and persistent listings work.');
} finally {
  db.close();
  for(const s of ['', '-shm', '-wal']){try{fs.unlinkSync(dbFile+s)}catch{}}
}
