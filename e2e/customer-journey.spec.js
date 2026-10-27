import {test,expect} from '@playwright/test';

test.describe('RentInOrbit customer journey',()=>{
 test.beforeEach(async({page})=>{
   await page.addInitScript(()=>localStorage.setItem('rentinorbit_onboarding_done','1'));
   page.on('pageerror',error=>console.error(`BROWSER_ERROR: ${error.stack||error.message}`));
 });
 test('home → discovery → listing detail is navigable',async({page})=>{
   await page.goto('/');
   await expect(page.locator('body')).toBeVisible();
   const details=page.locator('[data-detail-id], .detail-btn').first();
   await expect(details).toBeVisible({timeout:10000});
   await details.click();
   await expect(page.locator('#listingDetailModal, #listingDetail, .listing-detail-modal').first()).toBeVisible();
 });
 test('booking surface exposes dates, quantity and authoritative total',async({page})=>{
   await page.goto('/');
   const details=page.locator('[data-detail-id], .detail-btn').first();
   await expect(details).toBeVisible({timeout:10000});
   await details.click();
   const modal=page.locator('#listingDetailModal, #listingDetail, .listing-detail-modal').first();
   await expect(modal).toBeVisible();
   await expect(page.locator('text=/per day|day/i').first()).toBeVisible();
 });
 test('availability is a guarded handoff into checkout',async({page})=>{
   await page.goto('/');
   const availability=page.locator('[data-availability-id], .availability-btn').first();
   await expect(availability).toBeVisible({timeout:10000});
   await availability.click();
   await expect(page.locator('#availabilityModal')).toBeVisible();
   await expect(page.locator('#availabilityQuantity')).toHaveValue('1');
   await expect(page.locator('#v145AvailabilityContinue')).toBeDisabled();
   await expect(page.locator('#v145AvailabilityResult')).toHaveAttribute('aria-live','polite');
 });
 test('discovery, checkout navigation and My Bookings respond',async({page})=>{
   await page.route('**/api/rentals/availability?**',route=>route.fulfill({
     status:200,
     contentType:'application/json',
     body:JSON.stringify({available:true,remainingQuantity:2,totalQuantity:3})
   }));
   await page.route('**/api/rentals/calendar?**',route=>route.fulfill({
     status:200,
     contentType:'application/json',
     body:JSON.stringify({days:[]})
   }));
   await page.goto('/');
   await page.locator('#keywordSearch').fill('drill');
   await page.locator('#searchForm button[type="submit"]').click();
   await expect(page.locator('[data-detail-id], .detail-btn').first()).toBeVisible();
   await page.locator('[data-availability-id], .availability-btn').first().click();
   await expect(page.locator('#v145AvailabilityContinue')).toBeEnabled();
   await page.locator('#v145AvailabilityContinue').click();
   await expect(page.locator('#checkoutModal')).toBeVisible();
   await page.locator('.checkout-step[data-step="1"] .next-step').click();
   await expect(page.locator('.checkout-step[data-step="2"]')).toHaveClass(/active/);
   await page.locator('#closeCheckout').click();
   await page.locator('#myBookingsBtn').click();
   await expect(page.locator('#customerBookingsList')).toBeVisible();
 });
 test('supplier sign-up keeps first step focused',async({page})=>{
   await page.goto('/');
   await page.locator('#supplierAuthBtn').click();
   await page.locator('[data-auth-tab="register"]').first().click();
   await expect(page.locator('#supplierRegisterForm')).toBeVisible();
   await expect(page.locator('#regEmail')).toBeVisible();
   await expect(page.locator('#regPlan')).toHaveCount(0);
 });
 test('supplier dashboard navigation responds after login',async({page,request})=>{
   const email=`supplier-${Date.now()}@rentinorbit.test`;
   const password='demo12345';
   const registration=await request.post('/api/auth/register',{
     data:{email,password,role:'supplier',displayName:'E2E Supplier',businessName:'E2E Rentals'}
   });
   expect(registration.ok()).toBeTruthy();
   await page.goto('/');
   await page.locator('#supplierAuthBtn').click();
   await page.locator('#loginEmail').fill(email);
   await page.locator('#loginPassword').fill(password);
   await page.locator('#supplierLoginForm button[type="submit"]').click();
   await expect(page.locator('#supplier-dashboard')).toHaveClass(/unlocked/);
   await page.locator('[data-v129-tab="calendar"]').click();
   await expect(page.locator('#v129CalendarPanel')).toHaveClass(/active/);
 });
});

test.describe('RentInOrbit first-run onboarding',()=>{
 test.use({viewport:{width:390,height:844}});
 test('welcome controls stay above persistent navigation',async({page})=>{
   const errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto('/');
   const modal=page.locator('#onboardingModal');
   await expect(modal).toHaveClass(/open/,{timeout:3000});
   await page.locator('[data-next-onboarding="2"]').click();
   await expect(page.locator('[data-onboarding-step="2"]')).toHaveClass(/active/);
   await page.locator('#skipOnboardingBtn').click();
   await expect(modal).not.toHaveClass(/open/);
   expect(errors).toEqual([]);
 });
});
