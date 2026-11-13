import fs from 'fs';
import path from 'path';

const dbFile=path.resolve('./rentinorbit-auth-test.sqlite');
process.env.DB_PATH=dbFile;
for(const s of ['', '-shm', '-wal']){try{fs.unlinkSync(dbFile+s)}catch{}}

const {
  db,createAppUser,authenticateAppUser,createAppSession,seedDefaultUsers,
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

  const demoAdmin='admin@rentinorbit.test';
  const demoSupplier='demo@rentinorbit.test';
  process.env.RAILWAY_ENVIRONMENT_ID='synthetic-staging';
  process.env.RENTINORBIT_STAGING='true';
  seedDefaultUsers();
  assert(!db.prepare('SELECT email FROM app_users WHERE email=?').get(demoAdmin),'Deployed staging must not seed a demo administrator');
  delete process.env.RAILWAY_ENVIRONMENT_ID;
  seedDefaultUsers();
  const adminSession=createAppSession(authenticateAppUser(demoAdmin,'admin123').userId);
  const supplierSession=createAppSession(authenticateAppUser(demoSupplier,'demo123').userId);
  process.env.RAILWAY_ENVIRONMENT_ID='synthetic-staging';
  assert(!authenticateAppUser(demoAdmin,'admin123'),'Deployed staging must reject old demo admin credentials');
  assert(!getAppUserBySessionToken(adminSession.token),'Deployed staging must reject old demo admin sessions');
  assert(getAppUserBySessionToken(supplierSession.token)?.role==='supplier','Staging supplier fixture must still work');
  delete process.env.RENTINORBIT_STAGING;
  assert(!authenticateAppUser(demoSupplier,'demo123'),'Production must reject demo supplier credentials');
  assert(!getAppUserBySessionToken(supplierSession.token),'Production must reject demo supplier sessions');

  console.log('PASS: backend auth, sessions and persistent listings work.');
} finally {
  db.close();
  for(const s of ['', '-shm', '-wal']){try{fs.unlinkSync(dbFile+s)}catch{}}
}
