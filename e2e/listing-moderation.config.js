import base from './owned-commission.config.js';
export default {...base,timeout:60000,testMatch:'listing-moderation.spec.js',reporter:[['list'],['html',{outputFolder:'report-listing-moderation',open:'never'}]]};
