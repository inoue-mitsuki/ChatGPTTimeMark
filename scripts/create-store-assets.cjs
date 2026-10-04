const fs=require('node:fs');
const sharp=require(process.env.CHATGPT_TIMEMARK_SHARP || 'sharp');
(async()=>{
 fs.mkdirSync('icons',{recursive:true});fs.mkdirSync('Release/0.1.15',{recursive:true});
 for(const size of [16,48,128])await sharp('store-assets/icon.svg').resize(size,size).png().toFile('icons/icon'+size+'.png');
 fs.copyFileSync('icons/icon128.png','Release/0.1.15/icon.png');
 await sharp('store-assets/promo-small.svg').flatten({background:'#073b45'}).removeAlpha().png().toFile('Release/0.1.15/promo-small.png');
})().catch(error=>{console.error(error);process.exitCode=1});
