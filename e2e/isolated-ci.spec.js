import {test,expect} from '@playwright/test';

// Uses only the CI runner's temporary SQLite database and local HTTP server.
// No Stripe key, staging server or external account is required.
test.describe('Isolated CI real-browser safety gate',()=>{
  test('opens actual home page without uncaught browser errors',async({page})=>{
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).toContainText(/RentInOrbit|nuom/i);
    expect(errors).toEqual([]);
  });

  test('local runtime is healthy and does not expose live Stripe secrets',async({request})=>{
    const health=await request.get('/healthz');
    expect(health.status()).toBe(200);
    expect((await health.json()).ok).toBe(true);
    const readiness=await request.get('/api/readiness');
    expect([200,503]).toContain(readiness.status());
    const response=await readiness.text();
    expect(response).not.toMatch(/(?:sk|rk)_live_[a-zA-Z0-9]+/);
    expect(response).not.toMatch(/whsec_[a-zA-Z0-9]+/);
  });

  test('synthetic CI listing is visible through the actual public API',async({request})=>{
    const response=await request.get('/api/listings');
    expect(response.status()).toBe(200);
    const payload=await response.json();
    expect(Array.isArray(payload.listings)).toBe(true);
    const listing=payload.listings.find(item=>item.id==='ci-drill-discovery');
    expect(listing,'The isolated CI fixture must be public before browser discovery tests').toBeTruthy();
    expect(listing.title).toBe('CI Drill Test Rental');
    expect(Number(listing.priceDay)).toBe(100);
    expect(Number(listing.quantity)).toBe(2);
    expect(listing.lifecycleStatus).toBe('active');
  });

  test('unknown booking cannot be read without authorization',async({request})=>{
    const response=await request.get('/api/bookings/not-a-real-booking');
    expect([401,403,404]).toContain(response.status());
  });
});
