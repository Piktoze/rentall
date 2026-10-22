import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'.',timeout:30000,retries:1,use:{baseURL:'http://127.0.0.1:3000',trace:'retain-on-failure',screenshot:'only-on-failure'},
 webServer:{command:'PORT=3000 node ../server.js',url:'http://127.0.0.1:3000',reuseExistingServer:true,timeout:30000},
 reporter:[['list'],['html',{outputFolder:'report',open:'never'}]]
});
