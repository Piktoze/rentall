import {test,expect} from '@playwright/test';
import {getPolicyPage,HELP_CENTER_COPY} from '../modules/help-center-content-v177.js';

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

  test('public static delivery excludes server code and deployment files',async({request})=>{
    for(const path of ['/db.js','/server.js','/package.json','/ops/start.js','/modules/accounting-sf-v286.js']){
      expect((await request.get(path)).status(),path).toBe(404);
    }
    for(const path of ['/','/app.js','/modules/customer-handoff-v145.js','/assets/brand/rentinorbit-logo-horizontal-dark-web.png']){
      expect((await request.get(path)).status(),path).toBe(200);
    }
  });

  test('unknown booking cannot be read without authorization',async({request})=>{
    const response=await request.get('/api/bookings/not-a-real-booking');
    expect([401,403,404]).toContain(response.status());
  });

  test('admin renders listing and dispute input as plain text',async({page})=>{
    const markup='<img src=x data-audit-injected>';
    await page.route('**/api/auth/me',route=>route.fulfill({json:{user:{
      userId:'synthetic-admin',email:'audit-admin@example.invalid',role:'admin'
    }}}));
    await page.route('**/api/admin/dashboard',route=>route.fulfill({json:{
      kpis:{listings:1,activeListings:1,bookings:1,openDisputes:1,gmv:100},
      listings:[{listingId:'synthetic-listing',title:markup,moderationStatus:'active'}],
      disputes:[{disputeId:'synthetic-dispute',bookingId:'synthetic-booking',reason:markup,details:markup,status:'open'}]
    }}));
    await page.goto('/');
    await expect(page.locator('body')).toHaveClass(/is-admin/);
    await expect(page.locator('#adminListingsBody b')).toHaveText(markup);
    await expect(page.locator('#adminDisputesBody b')).toHaveText(markup);
    await expect(page.locator('[data-audit-injected]')).toHaveCount(0);
  });
});

for(const language of ['lt','en','es','de','ru']){
  test(`mobile navigation and public pages support ${language}`,async({page})=>{
    await page.setViewportSize({width:390,height:844});
    await page.addInitScript(()=>localStorage.setItem('rentinorbit_onboarding_done','1'));
    await page.goto('/');
    await page.locator('#lang').selectOption(language);
    await expect(page.locator('html')).toHaveAttribute('lang',language);
    await expect(page.locator('a[data-legal-link="/terms"]').first()).toHaveAttribute('href',`/terms?lang=${language}`);
    await page.locator('#countrySelect').selectOption('LT');
    await page.locator('#citySelect').selectOption('Klaipėda');
    await page.locator('#keywordSearch').fill('drill');
    await page.locator('#searchForm button[type="submit"]').click();
    await page.locator('[data-detail-id="ci-drill-discovery"]').first().click({timeout:8000});
    await expect(page.locator('#listingDetailModal')).toBeVisible();
    await page.locator('#detailAvailabilityBtn').click({timeout:8000});
    await expect(page.locator('#availabilityModal')).toBeVisible();
    await page.locator('#closeAvailabilityModal').click();
    for(const name of ['terms','privacy','cookies','fees','help']){
      const response=await page.goto(`/${name}?lang=${language}`);
      expect(response.status()).toBe(200);
      await expect(page.locator('html')).toHaveAttribute('lang',language);
      const title=name==='help'?HELP_CENTER_COPY[language].pageTitle:getPolicyPage(language,name).title;
      await expect(page.locator('h1')).toHaveText(title);
    }
  });
}
