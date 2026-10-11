const fs=require('fs'),sharp=require('C:/Users/rapha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const refs={
 'met-front':'https://cdn.sanity.io/images/cctd4ker/production/a70c08e24ff7cc7eebd2eecadd8fa86b4eac9ec5-1920x983.jpg',
 'grandCentral-street':'https://images.squarespace-cdn.com/content/v1/563a5fb2e4b0710808c31f27/1512590692048-T0A78HOSMZ3ONOIORW6I/%D1%86%D0%B5%D0%BD%D1%82%D1%80%D0%B0%D0%BB%D1%8C%D0%BD%D1%8B%D0%B9%2B%D0%B2%D0%BE%D0%BA%D0%B7%D0%B0%D0%BB.jpg?format=1500w',
 'paintedLadies-aerial':'https://s.hdnux.com/photos/01/66/35/56/31054762/3/ratio3x2_720.jpg',
 'oneWtc-street':'https://www.som.com/wp-content/uploads/2021/08/205221_000_N263_large-scaled.jpg',
 'oneWtc-plaza':'https://www.som.com/wp-content/uploads/fly-images/33854/205221_000_N210_large-scaled-1366x910-c.jpg',
 'brooklynBridge-aerial':'https://www.richardsilverphoto.com/cdn/shop/products/Brooklyn_Bridge_by_Helicopter.jpg?v=1771305165',
 'liberty-front':'https://www.nps.gov/stli/learn/images/Statue-of-Liberty1_1.jpg',
 'liberty-torch':'https://www.nps.gov/stli/learn/images/Statue-of-Liberty_6.jpg',
 'liberty-aerial':'https://meadowlandsmedia.com/wp-content/uploads/2023/09/Statue_of_Liberty_36491259596.jpg',
 'grandCentral-aerial':'https://cdn.prod.website-files.com/64619e077da47160c6ce7d11/648351b3a73b6c12ae755b8b_grand_central_lighting_featured.jpg',
 'grandCentral-front':'https://upload.wikimedia.org/wikipedia/commons/7/71/Image-Grand_central_Station_Outside_Night_2.jpg',
 'met-aerial':'https://cdn.sanity.io/images/cctd4ker/production/12501886e914eb64fdcf9d1bba0f12bcd6d14183-720x572.jpg',
 'met-plaza':'https://cdn.sanity.io/images/cctd4ker/production/9ea99ed87c43b8b36ec7bfe2d9aa556335466b70-760x542.jpg',
 'goldenGate-tower':'https://www.goldengate.org/assets/1/6/art-deco-design.jpg',
 'goldenGate-aerial':'https://prodmediawebuildvalue.alkemy.digital/wp-content/uploads/2025/09/GOLDENGATE_05.jpg',
 'goldenGate-wide':'https://www.goldengate.org/assets/1/6/page-top-bridge.jpg',
 'salesforce-aerial':'https://pcparch.com/media/pages/work/salesforce-tower/c500c8ebba-1737998015/salesforce-tower-sunrise-960x-q80.jpg',
 'salesforce-street':'https://pcparch.com/media/pages/work/salesforce-tower/7d9f045e61-1737998015/salesforce-tower-street-view-exterior-960x-q80.jpg',
 'ferryBuilding-water':'https://www.ferrybuildingmarketplace.com/wp-content/uploads/fb-about-main.jpg',
 'ferryBuilding-front':'https://www.ferrybuildingmarketplace.com/wp-content/uploads/Ferry-Building-IG-03.jpg',
 'alcatraz-aerial':'https://www.nps.gov/common/uploads/banner_image/pwr/homepage/9A38B580-BF6D-14C4-9F5C262C4836E906.jpg',
 'alcatraz-ground':'https://www.nps.gov/common/uploads/structured_data/2514A14F-D5E3-BB31-4A0C4175BF61216A.jpg?maxWidth=1200&maxHeight=800&quality=90',
 'sfCityHall-aerial':'https://www.terragalleria.com/images/us-ca/usca64631.jpeg',
 'sfCityHall-street':'https://media.api.sf.gov/original_images/pink_over_city_hall_sergio_ruiz_ZC6fLrx.jpg'
};
(async()=>{const out='evidence/art-rebuild/references-cities',results=[];for(const[id,url]of Object.entries(refs)){try{const r=await fetch(url,{signal:AbortSignal.timeout(25000)}),row={id,url,status:r.status};if(r.ok){row.file=`${out}/${id}.jpg`;await sharp(Buffer.from(await r.arrayBuffer())).resize(1600,1200,{fit:'inside',withoutEnlargement:true}).jpeg({quality:85}).toFile(row.file)}results.push(row)}catch(e){results.push({id,url,error:String(e)})}}fs.writeFileSync(`${out}/supplements.json`,JSON.stringify(results,null,2));for(const hero of [...new Set(Object.keys(refs).map(k=>k.split('-')[0]))]){const good=results.filter(r=>r.id.startsWith(hero+'-')&&r.file),layers=[];for(let i=0;i<good.length;i++){layers.push({input:await sharp(good[i].file).resize(400,280,{fit:'contain',background:'#eee'}).toBuffer(),left:i%2*400,top:Math.floor(i/2)*305});layers.push({input:Buffer.from(`<svg width="400" height="25"><text x="8" y="18" font-size="16">${good[i].id}</text></svg>`),left:i%2*400,top:Math.floor(i/2)*305+280})}if(layers.length)await sharp({create:{width:800,height:Math.ceil(good.length/2)*305,channels:4,background:'#fff'}}).composite(layers).png().toFile(`${out}/${hero}-supplement-contact.png`)}console.log(results.map(r=>[r.id,r.status||r.error]))})();
