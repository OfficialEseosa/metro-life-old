const fs=require('node:fs');
(async()=>{
 let cookie='';
 async function call(path,body){const r=await fetch('http://localhost:8080/api/'+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),Cookie:cookie},body:body?JSON.stringify(body):undefined});cookie=r.headers.get('set-cookie')?.split(';')[0]||cookie;const data=await r.json();if(!r.ok)throw Error(JSON.stringify(data));return data;}
 const guest=await call('auth/guest',{});await call('worlds',{name:'Audit fixes verification',mode:'solo'});await call('sim/setup',{city:'atl',neighborhood:'midtown',aspiration:'founder'});
 const shower=await call('act',{city:'atl',loc:'home',action:'shower'});
 if(!/^[A-Z][a-z]+ [A-Z][a-z]+/.test(guest.user.username)||!shower.result.text.includes('Freshened up')||shower.sim.needs.energy<99||shower.sim.needs.fun<96)throw Error('Audit fix assertion failed');
 for(const n of Object.values(shower.sim.needs))if(Math.abs(n*10-Math.round(n*10))>1e-8)throw Error('Unrounded need');
 fs.writeFileSync('evidence/m1/audit-fixes.json',JSON.stringify({username:guest.user.username,needs:shower.sim.needs,text:shower.result.text},null,2));console.log('PASS: friendly name, rounded needs, shower benefit and specific feedback over HTTP');
})().catch(e=>{console.error(e);process.exitCode=1});
