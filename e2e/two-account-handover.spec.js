import {test,expect} from '@playwright/test';
test.describe.configure({retries:0}); // Mutating journey: never replay half-completed fixtures.
// Real isolated server + two cookie jars. No provider mocks at browser routing,
// no Stripe API calls. The seed documents the paid precondition explicitly.
for(const width of [1280,390])test(`two independent accounts ${width}px: contracts, pickup and return`,async({browser})=>{
 const supplierContext=await browser.newContext({viewport:{width,height:900}});
 const renterContext=await browser.newContext({viewport:{width,height:900}});
 const supplier=await supplierContext.newPage(),renter=await renterContext.newPage();
 const id=`CI-UI-${width}`,endpoint=`/api/rentals/bookings/${id}`;
 async function login(page,role){
  await page.goto('/');await page.locator(width<700?'[data-v120-mobile="account"]':'#supplierAuthBtn').click();
  await page.locator('#loginEmail').fill(`journey-${role}-${width}@example.test`);
  await page.locator('#loginPassword').fill('SyntheticJourney123!');
  await page.locator('#supplierLoginForm button[type="submit"]').click();
  await expect.poll(async()=>{const r=await page.request.get('/api/auth/me');return (await r.json()).user?.email}).toBe(`journey-${role}-${width}@example.test`);
 }
 try{
  await login(renter,'renter');await login(supplier,'supplier');
  await renter.goto(`/?view=my-bookings&booking=${id}`);
  const card=renter.locator(`.customer-booking-card[data-booking-id="${id}"]`);
  await expect(card).toBeVisible();
  await expect(card.locator('.rio-renter-code')).toHaveCount(0);
  expect((await renter.request.post(endpoint+'/return-confirm',{data:{returnCondition:'good'}})).status()).toBe(403);
  renter.once('dialog',d=>d.accept());await card.locator('[data-rio-trust-renter="accept"]').click();
  await expect(card.locator('[data-rio-trust-renter="pickup"]')).toBeVisible();
  await card.locator('[data-rio-trust-renter="pickup"]').click();
  await expect(card.locator('.rio-renter-code-value')).toHaveText(/^\d{6}$/);
  const pin=await card.locator('.rio-renter-code-value').innerText();
  await supplier.goto(`/?view=supplier-bookings&booking=${id}`);
  await expect(supplier.locator('.rio-supplier-agreement')).toBeEnabled();
  await expect(supplier.locator('.rio-supplier-transfer')).toBeDisabled();
  expect((await supplier.request.post(endpoint+'/transfer-code',{data:{purpose:'pickup'}})).status()).toBe(403);
  supplier.once('dialog',d=>d.accept());await supplier.locator('.rio-supplier-agreement').click();
  await expect(supplier.locator('.rio-supplier-transfer')).toBeEnabled();
  supplier.once('dialog',d=>d.accept(pin));await supplier.locator('.rio-supplier-transfer').click();
  await expect(supplier.locator('.rio-supplier-transfer')).toHaveAttribute('data-purpose','return');
  expect((await supplier.request.post(endpoint+'/transfer-confirm',{data:{purpose:'pickup',code:pin}})).ok()).toBeFalsy();
  supplier.on('dialog',d=>d.type()==='prompt'?d.accept('good'):d.accept());
  await supplier.locator('.rio-supplier-transfer').click();
  await expect.poll(async()=>{const r=await supplier.request.get('/api/rentals/bookings');return (await r.json()).bookings?.find(x=>x.bookingId===id)?.status}).toBe('returned');
  await renter.goto(`/?view=my-bookings&booking=${id}`);
  await expect(card).toHaveAttribute('data-booking-status','returned');
  await expect(card.locator('[data-rio-trust-renter="pickup"]')).toHaveCount(0);
  await expect(card.locator('.rio-renter-code')).toHaveCount(0);
  expect((await renter.request.get('/api/rentals/bookings')).status()).toBe(403);
 }finally{await supplierContext.close();await renterContext.close();}
});
