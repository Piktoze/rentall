# Browser E2E

Install project dependencies, then Playwright and Chromium:

```bash
npm install
npm install -D @playwright/test
npx playwright install chromium
npm run test:e2e
```

The suite boots the real RentInOrbit server and drives Chromium through customer discovery/listing and supplier onboarding smoke journeys. Payment/deposit provider tests require Stripe test credentials and are intentionally separate from these browser smoke tests.
