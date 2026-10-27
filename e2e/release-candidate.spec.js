import {test,expect} from '@playwright/test';
test.describe('RentInOrbit 1.0 RC',()=>{
 test('mobile discovery is usable',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.locator('body')).toContainText(/Rent|rent/i);await expect(page.locator('input').first()).toBeVisible();});
 test('readiness never exposes Stripe secrets',async({request})=>{const r=await request.get('/api/readiness');expect([200,503]).toContain(r.status());const t=await r.text();expect(t).not.toMatch(/sk_(live|test)_/);expect(t).not.toMatch(/whsec_/);});
 test('unknown booking is protected',async({request})=>{const r=await request.get('/api/bookings/not-a-real-booking');expect([401,403,404]).toContain(r.status());});
});
