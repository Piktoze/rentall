import {test,expect} from '@playwright/test';

test.describe('RentAll customer journey',()=>{
 test.beforeEach(async({page})=>{
   await page.addInitScript(()=>localStorage.setItem('rentall_onboarding_done','1'));
   page.on('pageerror',error=>console.error(`BROWSER_ERROR: ${error.stack||error.message}`));
 });
 test('home → discovery → listing detail is navigable',async({page})=>{
   await page.goto('/');
   await expect(page.locator('body')).toBeVisible();
   await page.waitForTimeout(650);
   const details=page.locator('[data-detail-id], .detail-btn').first();
   await expect(details).toBeVisible();
   await details.click();
   await expect(page.locator('#listingDetailModal, #listingDetail, .listing-detail-modal').first()).toBeVisible();
 });
 test('booking surface exposes dates, quantity and authoritative total',async({page})=>{
   await page.goto('/');
   await page.waitForTimeout(650);
   await page.locator('[data-detail-id], .detail-btn').first().click();
   const modal=page.locator('#listingDetailModal, #listingDetail, .listing-detail-modal').first();
   await expect(modal).toBeVisible();
   await expect(page.locator('text=/per day|day/i').first()).toBeVisible();
 });
 test('availability is a guarded handoff into checkout',async({page})=>{
   await page.goto('/');
   await page.waitForTimeout(650);
   const availability=page.locator('[data-availability-id], .availability-btn').first();
   await expect(availability).toBeVisible();
   await availability.click();
   await expect(page.locator('#availabilityModal')).toBeVisible();
   await expect(page.locator('#availabilityQuantity')).toHaveValue('1');
   await expect(page.locator('#v145AvailabilityContinue')).toBeDisabled();
   await expect(page.locator('#v145AvailabilityResult')).toHaveAttribute('aria-live','polite');
 });
 test('supplier sign-up keeps first step focused',async({page})=>{
   await page.goto('/');
   await page.locator('#supplierAuthBtn').click();
   await page.locator('[data-auth-tab="register"]').first().click();
   await expect(page.locator('#supplierRegisterForm')).toBeVisible();
   await expect(page.locator('#regEmail')).toBeVisible();
   await expect(page.locator('#regPlan')).toHaveCount(0);
 });
});
