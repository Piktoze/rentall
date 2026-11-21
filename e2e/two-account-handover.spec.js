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

for(const width of [1280,390])test(`two accounts ${width}px: new checkout, supplier confirmation, unpaid cancellation`,async({browser})=>{
 const rc=await browser.newContext({viewport:{width,height:900}}),sc=await browser.newContext({viewport:{width,height:900}});
 const renter=await rc.newPage(),supplier=await sc.newPage();
 async function login(page,role){await page.goto('/');await page.locator(width<700?'[data-v120-mobile="account"]':'#supplierAuthBtn').click();
  await page.locator('#loginEmail').fill(`journey-${role}-${width}@example.test`);await page.locator('#loginPassword').fill('SyntheticJourney123!');await page.locator('#supplierLoginForm button[type="submit"]').click();
  await expect.poll(async()=>{const r=await page.request.get('/api/auth/me');return (await r.json()).user?.email}).toBe(`journey-${role}-${width}@example.test`);}
 try{
  await login(renter,'renter');await login(supplier,'supplier');await renter.goto('/');
  await renter.locator('#countrySelect').selectOption('LT');await renter.locator('#citySelect').selectOption('Klaipėda');
  await renter.locator('#keywordSearch').fill(`CI Checkout ${width}`);await renter.locator('#searchForm button[type="submit"]').click();
  await renter.locator(`[data-availability-id="ci-checkout-${width}"]`).click();await expect(renter.locator('#v145AvailabilityContinue')).toBeEnabled();
  await renter.locator('#v145AvailabilityContinue').click();
  const start=new Date(Date.now()+30*86400000).toISOString().slice(0,10),end=new Date(Date.now()+31*86400000).toISOString().slice(0,10);
  await renter.locator('#rentalStart').fill(start);await renter.locator('#rentalEnd').fill(end);await renter.locator('#rentalStartTime').fill('10:00');
  await renter.locator('.checkout-step[data-step="1"] .next-step').click();
  await expect(renter.locator('.checkout-step[data-step="2"]')).toHaveClass(/active/);
  await renter.locator('#accommodationType').selectOption('Pickup from owner');await renter.locator('#deliveryArea').fill('Klaipėda');
  await renter.locator('.checkout-step[data-step="2"] .next-step').click();
  if(await renter.locator('.checkout-step[data-step="3"]').isVisible()){
   await renter.locator('#firstName').fill('Synthetic');await renter.locator('#lastName').fill('Renter');await renter.locator('#email').fill(`journey-renter-${width}@example.test`);await renter.locator('#phone').fill('+37060000000');
   await renter.locator('.checkout-step[data-step="3"] .next-step').click();
  }
  await expect(renter.locator('.checkout-step[data-step="4"]')).toHaveClass(/active/);
  await renter.locator('#termsCheck').check();await renter.locator('#shareCheck').check();await renter.locator('.checkout-step[data-step="4"] .next-step').click();
  await expect(renter.locator('#rioCheckoutTraderAck')).toBeEnabled();await renter.locator('#rioCheckoutTraderAck').check();
  const response=renter.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/api/rentals/bookings'));
  await renter.locator('#payBtn').click();const created=await response;expect(created.ok()).toBeTruthy();const body=await created.json();const id=body.booking.bookingId;
  expect(body.booking.status).toBe('pending');expect(body.booking.paymentStatus).toBe('unpaid');expect(body.booking.orderValue).toBe(100);
  await supplier.goto(`/?view=supplier-bookings&booking=${id}`);await supplier.locator('#supplierOrderActions .backend-status-action[data-status="confirmed"]').click();
  await renter.goto(`/?view=my-bookings&booking=${id}`);const card=renter.locator(`.customer-booking-card[data-booking-id="${id}"]`);
  await expect(card).toHaveAttribute('data-booking-status','confirmed');await expect(card.locator('.v231-pay-booking')).toBeVisible();
  await expect(card.locator('.rio-renter-code')).toHaveCount(0);
  await card.locator('.rio-extra-booking-actions summary').click();renter.once('dialog',d=>d.accept('Synthetic unpaid cancellation'));
  await card.locator('.v46-cancel-booking').click();
  await expect.poll(async()=>{const r=await renter.request.get('/api/customer/bookings');return (await r.json()).bookings?.find(x=>x.bookingId===id)?.status}).toBe('cancelled');
  const final=(await (await renter.request.get('/api/customer/bookings')).json()).bookings.find(x=>x.bookingId===id);
  expect(Number(final.refundAmount||0)).toBe(0);expect(final.stripePaymentIntentId||null).toBeNull();
 }finally{await rc.close();await sc.close();}
});
