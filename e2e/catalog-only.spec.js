import {test,expect} from '@playwright/test';

test('catalog-only API rejects writes and does not expose Stripe configuration',async({request})=>{
  const config=await (await request.get('/api/config')).json();
  expect(config).toMatchObject({catalogOnly:true,stripePublishableKey:'',stripeConfigured:false,
    demoPaymentsEnabled:false,paymentProvider:'none'});
  for(const path of [
    '/api/rentals/bookings','/api/rentals/bookings/RB-synthetic/cancel',
    '/api/rentals/bookings/RB-synthetic/transfer-confirm','/api/payments/create-intent',
    '/api/payments/deposit-intent','/api/payments/demo/confirm','/api/Stripe/webhook',
    '/api/stripe/connect/create-account','/api/admin/bookings/RB-synthetic/deposit/capture',
    '/api/auth/register',
  ]){
    const response=await request.post(path,{data:{}});
    expect(response.status(),path).toBe(403);
    expect(await response.json()).toMatchObject({code:'CATALOG_ONLY'});
  }
  for(const path of ['/api/stripe/connect/status','/api/customer/bookings',
    '/api/rentals/bookings/RB-synthetic/transaction-confirmation.pdf']){
    expect((await request.get(path)).status(),path).toBe(403);
  }
  const list=await (await request.get('/api/listings')).json();
  expect(list.listings.filter(({id})=>id==='ci-drill-discovery')).toHaveLength(1);
  for(const id of ['ci-catalog-pending','ci-catalog-rejected']){
    expect(list.listings.some(listing=>listing.id===id)).toBe(false);
    expect((await request.get('/listing/'+id)).status()).toBe(404);
    expect((await request.get('/api/listings/'+id+'/trader-disclosure')).status()).toBe(404);
  }
});

for(const width of [390,1280]){
  test(`catalog-only listing can be browsed without checkout at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:844});
    await page.goto('/');
    await expect(page.locator('#catalog-only-notice')).toContainText('Rezervacijos ir mokėjimai dar neaktyvūs');
    const listing=page.locator('[data-detail-id="ci-drill-discovery"]');
    await expect(listing).toHaveCount(1);
    await listing.click();
    await expect(page.locator('#listingDetailModal')).toBeVisible();
    await expect(page.locator('#listingDetailContent')).toContainText('CI Drill Test Rental');
    await expect(page.locator('#detailRentBtn')).toBeHidden();
    await expect(page.locator('#checkoutBtn')).toBeHidden();
    await expect(page.locator('#supplierAuthBtn')).toBeHidden();
    await expect(page.locator('[data-v120-mobile="bookings"]')).toBeHidden();
    await expect(page.locator('[data-v120-mobile="account"]')).toBeHidden();
    expect((await page.goto('/listing/ci-drill-discovery')).status()).toBe(200);
    await expect(page.locator('h1')).toHaveText('CI Drill Test Rental');
    await expect(page.getByText('Rezervacijos ir mokėjimai dar neaktyvūs.',{exact:false})).toBeVisible();
    expect((await page.goto('/listing/nonexistent-catalog-listing')).status()).toBe(404);
  });
}
