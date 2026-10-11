const fs=require('fs'),sharp=require('C:/Users/rapha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const refs={
 'capitol-street':'https://dor.georgia.gov/sites/dor.georgia.gov/files/styles/4_3_720px_x_540px_/public/2019-08/Georgia_State_Capitol%2C_Atlanta%2C_West_view_20160716_1.jpg?h=7abf95bd&itok=KpdAm4_q',
 'capitol-aerial':'https://bunny-wp-pullzone-cjamrcljf0.b-cdn.net/wp-content/uploads/2021/02/georgia-state-capitol_003-444x400.jpg',
 'fox-dome':'https://www.gpb.org/sites/default/files/styles/three_two_702x468/public/2024-01/foxoniondome.png?h=ddb1ad0c&itok=65zuxHDz',
 'fox-street':'https://cache.marriott.com/content/dam/marriott-renditions/ATLLE/atlle-local-area-view-7355-hor-clsc.jpg?downsize=1336px%3A%2A&interpolation=progressive-bilinear&output-quality=70',
 'ponce-aerial':'https://images.squarespace-cdn.com/content/v1/5f9c80c54b29580773375eeb/1619655197288-7FMMAAMW75ATORI49R61/2015-PCM-Aerial-Looking-NE-20151031-MS.jpg',
 'ponce-roof':'https://www.jamestownlp.com/uploads/images/_2250x1266_crop_center_75_none/ponce-city-market-02-20240528.jpg',
 'high-street':'https://sah-archipedia.org/sites/default/files/pictures/full/GA-01-121-0092_001.jpg',
 'high-aerial':'https://www.metalera.com/getattachment/92c5ee96-f751-41e0-9f4e-8be3bb0f3f85/High_Museum_of_Art_800px.png',
 'high-meier':'https://architecture-history.org/architects/architects/MEIER/PIC/AM12.JPG',
 'aquarium-aerial':'https://heymondo.com/blog/wp-content/uploads/2024/05/The-Georgia-Aquarium-in-Atlanta-USA.jpg',
 'aquarium-street':'https://www.explore.com/img/gallery/this-southern-us-state-has-the-largest-aquarium-in-the-country/see-the-animals-of-the-georgia-aquarium-in-atlanta-1715085871.jpg'
};
(async()=>{const out='evidence/art-rebuild/references-atl';fs.mkdirSync(out,{recursive:true});const result=await Promise.allSettled(Object.entries(refs).map(async([id,url])=>{const r=await fetch(url,{signal:AbortSignal.timeout(35000)});if(!r.ok)throw Error(`${id}: ${r.status}`);const file=`${out}/${id}.jpg`;fs.writeFileSync(file,Buffer.from(await r.arrayBuffer()));return{id,url,file}}));fs.writeFileSync(`${out}/sources.json`,JSON.stringify(result,(_,v)=>v instanceof Error?String(v):v,2));const good=result.filter(r=>r.status==='fulfilled').map(r=>r.value);let layers=[];for(let i=0;i<good.length;i++){layers.push({input:await sharp(good[i].file).resize(400,260,{fit:'contain'}).toBuffer(),left:i%3*400,top:Math.floor(i/3)*285});layers.push({input:Buffer.from(`<svg width="400" height="25"><text x="8" y="18" font-size="16">${good[i].id}</text></svg>`),left:i%3*400,top:Math.floor(i/3)*285+260})}await sharp({create:{width:1200,height:Math.ceil(good.length/3)*285,channels:4,background:'#fff'}}).composite(layers).png().toFile(`${out}/contact.png`);console.log(result)})();
