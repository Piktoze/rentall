const fs=require('fs');
const css=fs.readFileSync('light-premium-v161.css','utf8');
function must(re,msg){if(!re.test(css)){console.error('FAIL:',msg);process.exit(1)}}
must(/\.topbar\{[\s\S]*?position:fixed!important;[\s\S]*?top:0!important;[\s\S]*?z-index:1000!important;/,'primary topbar must stay fixed above content');
must(/body\.theme-aurora\{[\s\S]*?padding-top:70px!important;/,'desktop content offset must protect fixed header');
must(/\.v120-journey\{[\s\S]*?position:relative!important;/,'journey bar must scroll normally');
must(/@media\(max-width:900px\)[\s\S]*?body\.theme-aurora\{padding-top:64px!important\}/,'mobile fixed-header offset required');
console.log('PASS V170 fixed primary header');
