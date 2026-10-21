import fs from 'node:fs'
import path from 'node:path'
import Module,{createRequire} from 'node:module'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {performance} from 'node:perf_hooks'
const root=path.resolve(import.meta.dirname,'..'),require=createRequire(import.meta.url)
process.env.NODE_PATH=path.join(root,'frontend/node_modules');Module._initPaths()
const ts=require('typescript')
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}}).outputText,file)
const {navigationRoute}=require('../frontend/src/scene/navigation-route.ts'),{canStand,inBox,interiors,roomLayout}=require('../frontend/src/navigation.ts'),nav=require('../shared/navigation.json').cities,routes=require('../shared/resident-routes.json').cities
const report={at:new Date().toISOString(),navigationSHA256:createHash('sha256').update(fs.readFileSync(path.join(root,'shared/navigation.json'))).digest('hex'),budgets:{indoorStep:.25,outdoorStep:.6,indoorNodes:9000,outdoorNodes:50000,indoorMs:40,outdoorMs:220,totalMs:480,edgeSample:.125,cornerMargin:.001},bayBridge:nav.bay.bridges[1],validationStep:.075,routes:[],invalid:[],failures:[],summary:{}}
function check(city,room,start,end,name,required=true){const begun=performance.now(),result=navigationRoute(city,room,start,end),ms=performance.now()-begun;let samples=0,length=0,previous=start
 for(const point of result){assert(Number.isFinite(point.x)&&Number.isFinite(point.z));const d=Math.hypot(point.x-previous.x,point.z-previous.z),steps=Math.max(1,Math.ceil(d/.075));for(let i=0;i<=steps;i++){samples++;assert(canStand(city,previous.x+(point.x-previous.x)*i/steps,previous.z+(point.z-previous.z)*i/steps,room),`Blocked returned segment ${city}/${room}/${name} ${JSON.stringify({previous,point,sample:{x:previous.x+(point.x-previous.x)*i/steps,z:previous.z+(point.z-previous.z)*i/steps},boxes:(room?roomLayout(city,room.split(':')[0]).boxes:nav[city].boxes).filter(b=>inBox(previous.x+(point.x-previous.x)*i/steps,previous.z+(point.z-previous.z)*i/steps,b))})} at sample ${i}/${steps}`)}length+=d;previous=point}
 if(result.length)assert(Math.hypot(previous.x-end.x,previous.z-end.z)<1e-6,'Goal moved or snapped')
 const row={city,room,name,required,ms:+ms.toFixed(3),waypoints:result.length,length:+length.toFixed(3),samples,start,end};report.routes.push(row);if(required&&!result.length&&canStand(city,start.x,start.z,room)&&canStand(city,end.x,end.z,room))report.failures.push(row);if(!canStand(city,start.x,start.z,room)||!canStand(city,end.x,end.z,room)){row.required=false;row.invalidEndpoint=true;assert.equal(result.length,0,'Invalid endpoint was accepted')}
}
for(const city of ['atl','nyc','bay']){
 const n=nav[city],home=Object.values(n.homes)[0],doors=Object.entries(n.doors)
 // Islands with no walkable bridge are intentionally unreachable on foot.
 const islands=city==='nyc'?new Set(['liberty']):city==='bay'?new Set(['alcatraz']):new Set()
 for(const [id,door]of doors)check(city,null,home,door,`home-to-${id}`,!islands.has(id))
 for(const [id,door]of doors){const targets=doors.filter(([other])=>other!==id&&!islands.has(other)&&!islands.has(id)).sort(([,a],[,b])=>Math.hypot(a.x-door.x,a.z-door.z)-Math.hypot(b.x-door.x,b.z-door.z));for(const [target,to]of [...targets.slice(0,2),...targets.slice(-1)])check(city,null,door,to,`${id}-to-${target}`)}
 // Surveyed resident routes establish positive connectivity even across each city's bridges.
 for(const route of routes[city].routes.filter((_,i)=>i%6===0)){const a=route.points[0],b=route.points.at(-1);check(city,null,{x:a[0],z:a[1]},{x:b[0],z:b[1]},`survey-${route.from}-to-${route.to}`)}
 for(const type of Object.keys(interiors)){const layout=roomLayout(city,type),room=`${type}:path-check`;for(const station of layout.stations)check(city,room,layout.exit,station,`exit-to-${station.id}`);for(let i=1;i<layout.stations.length;i++)check(city,room,layout.stations[i-1],layout.stations[i],`${layout.stations[i-1].id}-to-${layout.stations[i].id}`)}
 const cases=[{room:null,start:home,end:{x:NaN,z:0},name:'nonfinite-goal'},{room:null,start:home,end:{x:100000,z:100000},name:'outside-world'},{room:'home:path-check',start:{x:0,z:2.3},end:{x:3.5,z:0},name:'wall-click'},{room:'unknown:path-check',start:{x:0,z:0},end:{x:1,z:0},name:'unknown-room'},{room:null,start:{x:NaN,z:0},end:home,name:'nonfinite-start'},{room:'home:path-check',start:roomLayout(city,'home').furniture.find(f=>f.kind==='bed'),end:{x:0,z:2.3},name:'blocked-start'}]
 for(const c of cases){const result=navigationRoute(city,c.room,c.start,c.end);assert.equal(result.length,0,c.name);report.invalid.push({city,name:c.name,pass:true})}
}
const times=report.routes.map(r=>r.ms).sort((a,b)=>a-b),percentile=p=>times[Math.min(times.length-1,Math.floor(times.length*p))]
report.summary={cases:report.routes.length,required:report.routes.filter(r=>r.required).length,found:report.routes.filter(r=>r.waypoints).length,failures:report.failures.length,validatedSamples:report.routes.reduce((n,r)=>n+r.samples,0),invalidCases:report.invalid.length,routeMs:{min:times[0],median:percentile(.5),p95:percentile(.95),max:times.at(-1)},totalRouteMs:+times.reduce((a,b)=>a+b,0).toFixed(3)}
fs.mkdirSync(path.join(root,'evidence/round2'),{recursive:true});fs.writeFileSync(path.join(root,'evidence/round2/item5-paths.json'),JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify(report.summary,null,2));if(report.failures.length){console.error('Required routes failed:',JSON.stringify(report.failures.map(r=>({city:r.city,name:r.name,ms:r.ms,start:r.start,end:r.end})),null,2));process.exitCode=1}
