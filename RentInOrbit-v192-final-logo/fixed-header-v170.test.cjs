const fs=require('fs');
const css=fs.readFileSync('light-premium-v161.css','utf8');
function must(v,msg){if(!v){console.error('FAIL:',msg);process.exit(1)}}
const v173=css.slice(css.indexOf('/* RentInOrbit V173 — contrast, sticky header and production-surface cleanup */'));
must(v173.includes('position:sticky!important'),'primary topbar must stay sticky above content');
must(v173.includes('top:0!important'),'sticky header must anchor at viewport top');
must(v173.includes('z-index:1000!important'),'primary header z-index required');
must(v173.includes('body.theme-aurora{padding-top:0!important}'),'sticky header must remain in normal document flow without fake top padding');
must(v173.includes('html{scroll-padding-top:88px!important}'),'anchor scrolling must account for sticky header');
must(v173.includes('.v120-journey{z-index:40!important}'),'journey toolbar must keep a stable layer below the primary header');
console.log('PASS V173 sticky primary header without content overlap');
