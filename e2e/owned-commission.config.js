import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'owned-commission.spec.js',timeout:30000,retries:0,workers:1,
 use:{baseURL:'https://rentinorbit.test:34443',ignoreHTTPSErrors:true,extraHTTPHeaders:{Origin:'https://rentinorbit.test:34443'},acceptDownloads:true,serviceWorkers:'block',trace:'retain-on-failure',screenshot:'only-on-failure'},
 webServer:{command:'node owned-commission-fixture.mjs',url:'https://rentinorbit.test:34443/healthz',ignoreHTTPSErrors:true,reuseExistingServer:false,timeout:30000},
 reporter:[['list'],['html',{outputFolder:'report-owned-commission',open:'never'}]]});
