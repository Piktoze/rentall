import {test,expect} from '@playwright/test';import fs from 'node:fs';import path from 'node:path';
let gate,adminCookies;
test.beforeAll(async({request})=>{
 const file=path.join(process.env.RIO_DOCUMENT_E2E_ROOT,'mail.json');fs.rmSync(file,{force:true});
 const challenge=await (await request.post('/__test-access/request',{data:{email:'gate@example.test'}})).json();await expect.poll(()=>fs.existsSync(file)).toBe(true);
 const code=JSON.parse(fs.readFileSync(file)).html.match(/<strong>(\d{8})<\/strong>/)[1];expect((await request.post('/__test-access/verify',{data:{challenge:challenge.challenge,code}})).ok()).toBeTruthy();
 gate=(await request.storageState()).cookies.find(c=>c.name==='__Host-rio_test');
 const registered=await request.post('/api/auth/register',{data:{email:'gate@example.test',password:'SyntheticModeration123!',role:'supplier',termsAccepted:true}});expect(registered.ok()).toBeTruthy();expect((await registered.json()).user.role).toBe('admin');adminCookies=(await request.storageState()).cookies;
});
for(const width of [1280,390])test(`uncovered moderation decisions, approved edit withdrawal, rejection and resubmit ${width}px`,async({browser})=>{
 const options={baseURL:'https://rentinorbit.test:34443',ignoreHTTPSErrors:true,extraHTTPHeaders:{Origin:'https://rentinorbit.test:34443'},viewport:{width,height:900}};
 const owner=await browser.newContext(options),admin=await browser.newContext(options),viewer=await browser.newContext(options);
 try{
  await owner.addCookies([gate]);await admin.addCookies(adminCookies);await viewer.addCookies([gate]);
  expect((await owner.request.post('/api/auth/register',{data:{email:`moderation-${width}@example.test`,password:'SyntheticModeration123!',role:'supplier',termsAccepted:true}})).ok()).toBeTruthy();
  const supplier=await owner.newPage(),reviewer=await admin.newPage(),search=await viewer.newPage();await supplier.goto('/');
  // Initial UI registration/photo submission already has 1280/390px coverage. Prepare its equivalent through real APIs here.
  const images=await supplier.evaluate(()=>['#123456','#654321'].map(color=>{const c=document.createElement('canvas');c.width=c.height=500;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,500,500);return c.toDataURL('image/png');}));
  const photos=[];for(const dataUrl of images){const uploaded=await owner.request.post('/api/uploads/image',{data:{dataUrl,fileName:'synthetic-moderation'}});expect(uploaded.ok()).toBeTruthy();photos.push((await uploaded.json()).url);}
  let listing={id:`SYNTHETIC-MOD-${width}`,title:`Synthetic Moderation ${width}`,description:'Synthetic isolated moderation fixture',country:'LT',city:'Klaipėda',category:'tools',quantity:1,priceDay:20,bookingMode:'request',photos,coverPhoto:photos[0]};
  expect((await owner.request.post('/api/supplier/listings',{data:{listing}})).ok()).toBeTruthy();
  const row=()=>supplier.locator(`[data-inventory-listing="${listing.id}"]`);
  let inventoryOpened=false;
  async function inventory(){if(!inventoryOpened){await supplier.goto('/');await supplier.locator(width<700?'[data-v120-mobile="account"]':'#supplierAuthBtn').click();await supplier.locator('#supplierActionDrawer [data-supplier-action="listings"]').click();inventoryOpened=true;}else{const refreshed=supplier.waitForResponse(r=>r.request().method()==='GET'&&new URL(r.url()).pathname==='/api/supplier/listings');await supplier.locator('#v94RefreshInventory').click();expect((await refreshed).ok()).toBeTruthy();}await expect(row()).toBeVisible();}
  async function assertSearch(visible,title=listing.title){
   const payload=await (await viewer.request.get('/api/listings')).json();expect(payload.listings.some(l=>l.id===listing.id)).toBe(visible);
   const catalog=search.waitForResponse(r=>r.request().method()==='GET'&&new URL(r.url()).pathname==='/api/listings');await search.goto('/');expect((await catalog).ok()).toBeTruthy();await search.locator('#countrySelect').selectOption('LT');await search.locator('#citySelect').selectOption('Klaipėda');await search.locator('#keywordSearch').fill(title);await search.locator('#searchForm button[type="submit"]').click();
   await expect(search.locator(`[data-availability-id="${listing.id}"]`)).toHaveCount(visible?1:0);
  }
  async function queue(){await reviewer.goto('/');const q=reviewer.locator(`[data-review-listing="${listing.id}"]`);await expect(q).toBeVisible();await q.locator('summary').click();const box=await q.getByRole('textbox',{name:'Atmetimo priežastis'}).boundingBox();expect(box.x+box.width).toBeLessThanOrEqual(width+1);return q;}
  async function decide(status,reason=''){
   const q=await queue();if(reason)await q.getByRole('textbox',{name:'Atmetimo priežastis'}).fill(reason);
   const response=reviewer.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith(`/api/admin/listings/${listing.id}/review`));
   await q.getByRole('button',{name:status==='approved'?'Patvirtinti':'Atmesti',exact:true}).click();expect((await response).ok()).toBeTruthy();await expect(reviewer.locator(`[data-review-listing="${listing.id}"]`)).toHaveCount(0);
  }
  async function edit(description){await inventory();await row().getByRole('button',{name:'Redaguoti ir pateikti peržiūrai'}).click();await expect(supplier.locator('#listingForm')).toBeVisible();expect(await supplier.locator('#listingPhotos').evaluate(el=>el.required)).toBe(false);
   await supplier.locator('#listingDescription').fill(description);const response=supplier.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/api/supplier/listings'));await supplier.locator('#listingForm button[type="submit"]').click();expect((await response).ok()).toBeTruthy();await expect(supplier.locator('#listingModal')).not.toHaveClass(/open/);}
  await inventory();await expect(row()).toContainText('Laukia patvirtinimo');await expect(row()).toContainText('Palauk administratoriaus sprendimo');await assertSearch(false);
  expect((await owner.request.get('/api/admin/listing-reviews')).status()).toBe(403);
  await decide('approved');await inventory();await expect(row()).toContainText('Patvirtintas');await assertSearch(true);
  await edit('Changed description needs a fresh decision');await assertSearch(false);
  const oldQueue=(await (await admin.request.get('/api/admin/listing-reviews')).json()).listings.find(l=>l.listingId===listing.id);
  const q=await queue();await q.getByRole('button',{name:'Atmesti',exact:true}).click();await expect(q).toContainText('Nurodykite priežastį.');
  const reason='Papildyk daikto būklės aprašymą ir pateik iš naujo.';await q.getByRole('textbox',{name:'Atmetimo priežastis'}).fill(reason);
  const rejected=reviewer.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith(`/api/admin/listings/${listing.id}/review`));await q.getByRole('button',{name:'Atmesti',exact:true}).click();expect((await rejected).ok()).toBeTruthy();
  await inventory();await expect(row()).toContainText('Atmestas');await expect(row()).toContainText(reason);await expect(row()).toContainText('Pataisyk nurodytus trūkumus');await test.info().attach(`rejected-listing-${width}`,{body:await row().screenshot(),contentType:'image/png'});await assertSearch(false);
  await edit('Good condition, dimensions and accessories corrected.');await inventory();await expect(row()).toContainText('Laukia patvirtinimo');await expect(row()).not.toContainText(reason);await assertSearch(false);
  expect((await admin.request.post(`/api/admin/listings/${listing.id}/review`,{data:{revision:oldQueue.revision,status:'approved'}})).status()).toBe(409);
  await decide('approved');await inventory();await expect(row()).toContainText('Patvirtintas');await assertSearch(true);
  await test.info().attach(`supplier-moderation-${width}`,{body:await row().screenshot(),contentType:'image/png'});
 }finally{await Promise.allSettled([owner.close(),admin.close(),viewer.close()]);}
});
