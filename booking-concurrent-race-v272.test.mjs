// Isolated multi-process inventory race test. Never connects to Railway / Stripe.
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
const worker=process.argv.includes('--worker');
if(worker){
  const {createRentalBookingAtomic,db}=await import('./db.js');
  let verdict='unexpected';
  try{
    createRentalBookingAtomic({bookingId:process.env.RACE_BOOKING_ID,listingId:'race-one-unit',
      startDate:'2027-06-01',endDate:'2027-06-04',quantity:1,status:'pending',
      customerEmail:'race-renter@example.invalid'});
    verdict='accepted';
  }catch(err){
    if(err.code==='INSUFFICIENT_AVAILABILITY')verdict='sold-out';
    else if(/SQLITE_BUSY|database is locked/i.test(String(err.code||'')+' '+String(err.message||'')))verdict='busy';
    else throw err;
  }finally{db.close()}
  console.log('RACE_RESULT:'+verdict);
}else{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rio-booking-race-'));
  const location=path.join(dir,'fixture.sqlite');
  const env={...process.env,DB_PATH:location,NODE_ENV:'test',RENTINORBIT_STAGING:'true'};
  for(const k of ['DATABASE_URL','RENTINORBIT_DB_PATH','PERSISTENT_DATA_DIR','RAILWAY_VOLUME_MOUNT_PATH','RAILWAY_ENVIRONMENT_ID','RAILWAY_PROJECT_ID','RAILWAY_SERVICE_ID','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','RESEND_API_KEY'])delete env[k];
  const original={...process.env};
  try{
    Object.keys(process.env).forEach(k=>delete process.env[k]);
    Object.assign(process.env,env);
    const {db,upsertRentalListing}=await import('./db.js');
    upsertRentalListing({listingId:'race-one-unit',ownerEmail:'race-supplier@example.invalid',title:'One-unit test fixture',totalQuantity:1});
    db.close();
    Object.keys(process.env).forEach(k=>delete process.env[k]);
    Object.assign(process.env,original);
    const jobs=Array.from({length:6},(_,i)=>new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,[process.argv[1],'--worker'],{
        cwd:process.cwd(),env:{...env,RACE_BOOKING_ID:'race-attempt-'+i},stdio:['ignore','pipe','pipe']});
      let output='',error='';
      child.stdout.on('data',data=>output+=String(data));
      child.stderr.on('data',data=>error+=String(data));
      child.once('error',reject);
      child.once('close',code=>{
        if(code!==0)return reject(new Error('Race worker '+i+' failed: '+error.slice(-700)));
        const match=output.match(/RACE_RESULT:(accepted|sold-out|busy)/);
        match?resolve(match[1]):reject(new Error('Worker produced no outcome '+output.slice(-300)));
      });
    }));
    const outcomes=await Promise.all(jobs);
    // At most one successful concurrent booking. Busy retries can be tested
    // separately; do not misrepresent a lock error as a confirmed denial.
    assert.ok(outcomes.filter(x=>x==='accepted').length<=1,'Oversold one-unit inventory');
    assert.ok(outcomes.includes('accepted'),'At least one concurrent booking should succeed');
    const Database=(await import('better-sqlite3')).default;
    const snapshot=new Database(location,{readonly:true,fileMustExist:true});
    try{
      const row=snapshot.prepare("SELECT COUNT(*) AS n,COALESCE(SUM(quantity),0) AS units FROM rental_bookings WHERE listing_id='race-one-unit' AND status NOT IN ('cancelled','returned','completed')").get();
      assert.equal(row.n,1,'Exactly one booking must be stored');
      assert.equal(row.units,1,'Stored quantity cannot exceed inventory');
    }finally{snapshot.close()}
    console.log('PASS isolated six-process reservation race: '+JSON.stringify(outcomes));
  }finally{
    Object.keys(process.env).forEach(k=>delete process.env[k]);
    Object.assign(process.env,original);
    fs.rmSync(dir,{recursive:true,force:true});
  }
}
