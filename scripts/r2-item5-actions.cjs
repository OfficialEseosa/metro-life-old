// Execute the real interaction module with CPU navigation data and deterministic
// stores/API promises. This checks menu/queue contracts, not renderer/path quality.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict'),Module=require('module');
process.env.NODE_PATH=path.resolve('frontend/node_modules');Module._initPaths();
const ts=require('typescript');
for(const extension of ['.ts','.tsx'])require.extensions[extension]=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);
const navigation=require(path.resolve('frontend/src/navigation.ts'));
const clone=value=>JSON.parse(JSON.stringify(value));
const file=path.resolve('frontend/src/interactions.ts');
const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
function storeOf(initial){let value=initial;const listeners=new Set();const store=selector=>selector(value);store.getState=()=>value;store.setState=update=>{const before=value;value={...value,...(typeof update==='function'?update(value):update)};for(const listener of listeners)listener(value,before)};store.subscribe=listener=>{listeners.add(listener);return()=>listeners.delete(listener)};return store;}
function action(id,label,kind,extra={}){return{id,label,kind,icon:kind==='food'?'utensils':'briefcase',cost:0,pay:0,xp:15,durationMin:30,needs:{},skills:{},...extra};}
const meal=()=>action('meal','Buy a meal','food',{cost:12,needs:{hunger:35},skills:{cooking:20}});
const shift=track=>action(`shift-${track}`,'Work a shift','work',{requires:{job:track},pay:70});
const homes=[action('cook','Cook a fresh meal','food'),action('sleep','Get some sleep','rest'),action('shower','Take a shower','rest'),action('invite','Invite a friend over','social')];
const place=(id,actions)=>({id,name:id,category:'work',open:[0,24],actions});
// Career rows intentionally remain Atlanta prototypes, as in Content.java.
const world={careers:['tech','food'].map(track=>({track,levels:[{city:'atl',loc:track==='tech'?'techVillage':'ponce',level:1,title:track==='tech'?'Support Associate':'Kitchen Porter'}]})),cities:[
 {id:'atl',homeActions:homes,landmarks:[place('ponce',[meal(),shift('food')]),place('krog',[meal()]),place('techVillage',[shift('tech')])]},
 {id:'nyc',homeActions:homes,landmarks:[place('chinatown',[meal(),action('kitchen','Work a kitchen shift','work',{pay:22}),shift('food')]),place('dumbo',[shift('tech')])]},
 {id:'bay',homeActions:homes,landmarks:[place('techCampus',[shift('tech')])]},
]};
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject};}
async function drain(){for(let i=0;i<12;i++)await Promise.resolve();}
function harness(){
 let now=1_800_000_000_000,monotonic=10000,route=(_city,_room,_start,end)=>[{...end}];
 const calls=[],motion={x:0,z:0,position:null,useApproach:null,wake:()=>{},flush:async()=>{calls.push({kind:'flush'});const current=store.getState().sim;store.setState({sim:{...current,position:clone(motion.position),loc:motion.position.place}})}};
 const store=storeOf({world:clone(world),sim:null,players:[],panel:null,searchOpen:false,acting:false,clock:{day:100,hour:13,minute:0,at:now,msPerMinute:1000},mayor:null,lastResult:null});
 store.setState({setSim:sim=>store.setState({sim}),setLastResult:lastResult=>store.setState({lastResult}),openPanel:panel=>store.setState({panel}),selectLocation:()=>{}});
 const reply=(extra={})=>({sim:{...clone(store.getState().sim),...extra},clock:clone(store.getState().clock)});
 const api={
  act:async(...args)=>{calls.push({kind:'act',args});return{...reply({busyUntil:now+6000}),result:{text:'Accepted'}}},
  cancelAction:async()=>{calls.push({kind:'cancel'});return reply({busyUntil:null,activitySlot:null})},
  posture:async benchId=>{calls.push({kind:'posture',benchId});return reply({activitySlot:benchId?{id:benchId,bench:true}:null})},
  social:async(...args)=>{calls.push({kind:'social',args});return{...reply(),text:'Hello'}},
  applyJob:async jobId=>{calls.push({kind:'apply',jobId});return{...reply(),hired:true}},
  door:async(...args)=>{calls.push({kind:'door',args});return reply()},
 };
 const rulesFile=path.resolve('frontend/src/ui/action-rules.ts'),rulesModule={exports:{}};
 const rulesCode=ts.transpileModule(fs.readFileSync(rulesFile,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInThisContext(Module.wrap(rulesCode),{filename:rulesFile})(rulesModule.exports,name=>name==='../server-time'?{serverNow:()=>now}:name==='./helpers'?{money:n=>`$${n}`}:(()=>{throw Error('Unexpected rules dependency '+name)})(),rulesModule,rulesFile,path.dirname(rulesFile));
 const output={exports:{}},injected=name=>{
  if(name==='zustand')return{create:init=>storeOf(init())};
  if(name==='./api/client')return{api};
  if(name==='./navigation')return navigation;
  if(name==='./scene/navigation-route')return{navigationRoute:(...args)=>route(...args)};
  if(name==='./store')return{useStore:store};
  if(name==='./walking')return{motion};
  if(name==='./ui/action-rules')return rulesModule.exports;
  if(name==='./server-time')return{serverNow:()=>now};
  throw Error('Unexpected interactions dependency '+name);
 };
 vm.runInNewContext(Module.wrap(source),{performance:{now:()=>monotonic},console},{filename:file})(output.exports,injected,output,file,path.dirname(file));
 const interactions=output.exports;
 function room(city='atl',loc='home',type='home'){
  const id=store.getState().sim?.userId||'life-a',layout=navigation.roomLayout(city,type),at={x:layout.exit.x,z:layout.exit.z,face:0,place:loc,room:`${type}:${type==='home'?id:loc}`};motion.position=clone(at);
  store.setState({sim:{userId:id,worldId:'public',username:'Rowan',city,loc,position:clone(at),home:{city,neighborhood:city==='atl'?'midtown':city==='nyc'?'harlem':'mission'},introDone:true,firstDay:{complete:false},arrivalDay:99,createdAt:now-1440000,cash:1000,level:1,needs:{energy:85,hunger:85,fun:85,social:85},skills:Object.fromEntries(['fitness','cooking','music','tech','charisma','creativity','business'].map(skill=>[skill,{level:0}])),job:null,busyUntil:null,pendingBeat:null,activitySlot:null},panel:null,searchOpen:false,players:[],acting:false});
  return layout;
 }
 room();
 function target(id,stationId){const sim=store.getState().sim,layout=navigation.roomLayout(sim.city,navigation.roomType(sim.position.room)),furniture=layout.furniture.find(f=>f.id===id);assert(furniture,`Fixture furniture ${id} missing`);return{kind:'furniture',id,stationId,city:sim.city,room:sim.position.room,point:{x:furniture.x,z:furniture.z},screen:{x:640,y:400}};}
 function open(id,stationId){interactions.openObjectMenu(target(id,stationId));const menu=interactions.useInteractions.getState().menu;assert(menu,'Expected object menu');return menu.options;}
 function sim(patch){store.setState({sim:{...store.getState().sim,...patch}});}
 function atTask(){const task=interactions.useInteractions.getState().current;assert(task);motion.position={...motion.position,...task.point};sim({position:clone(motion.position)});}
 const tick=()=>interactions.interactionSteering(monotonic,false);
 const walk=label=>({kind:'walk',label,icon:'footprints',city:store.getState().sim.city,room:motion.position.room,point:{x:motion.position.x,z:motion.position.z}});
 return{store,api,calls,motion,interactions,room,target,open,sim,atTask,tick,walk,reply,setNow:value=>{now=value},get now(){return now},setRoute:fn=>{route=fn},advance:ms=>{monotonic+=ms;now+=ms}};
}

const checks=[];
async function check(name,test){try{await test();checks.push({name,result:'PASS'})}catch(error){checks.push({name,result:'FAIL',message:error.message,stack:error.stack});console.error('FAIL',name,error.message)}}
async function run(){
 for(const [furniture,station,id]of [['stove','stove','cook'],['bed','bed','sleep'],['shower','shower','shower'],['chair','couch','invite']])await check(`home ${furniture} has its real action and canonical approach`,()=>{
  const h=harness(),option=h.open(furniture,station).find(o=>o.id===id);assert(option);assert.equal(option.reason,'');assert.equal(option.task.slotId,furniture==='chair'?'chair':furniture);
  const canonical=navigation.roomLayout('atl','home').stations.find(s=>s.id===station);assert.deepEqual(clone(option.task.point),{x:canonical.x,z:canonical.z});
 });
 await check('clicked public table-2 submits its exact authored Eat slot',async()=>{
  const h=harness(),layout=h.room('atl','ponce','foodhall'),furniture=layout.furniture.find(f=>f.id==='table-2'),option=h.open('table-2','table').find(o=>o.id==='meal');assert(option);assert.equal(option.reason,'');assert(furniture.slots.some(s=>s.id===option.task.slotId&&s.pose==='Eat'));
  h.interactions.chooseObjectAction('meal');h.atTask();h.tick();await drain();const call=h.calls.find(c=>c.kind==='act');assert(call);assert.equal(call.args[3],option.task.slotId);assert(Math.hypot(option.task.point.x-furniture.slots[0].x,option.task.point.z-furniture.slots[0].z)<=1.35);
 });
 await check('Atlanta cafe counter offers food without inventing an explicit Eat slot or job',()=>{
  const h=harness(),layout=h.room('atl','krog','cafe'),options=h.open('reception','counter'),food=options.find(o=>o.id==='meal');assert(food,'Counter food action missing');assert.equal(food.reason,'');assert.equal(food.task.slotId,undefined);assert.equal(options.some(o=>o.task.kind==='apply'),false);
  const station=layout.stations.find(s=>s.id==='counter');assert.equal(food.task.point.x,station.x);assert.equal(food.task.point.z,station.z);
 });
 await check('NYC cafe counter exposes its service-desk work and application',()=>{
  const h=harness();h.room('nyc','chinatown','cafe');let options=h.open('reception','counter'),apply=options.find(o=>o.id==='apply-food');assert(apply,'Counter application missing');assert.equal(apply.task.jobId,'nyc-food-1');
  const work=options.find(o=>o.id==='kitchen');assert(work,'Counter work action missing');assert.equal(work.reason,'');assert.equal(work.task.slotId,'service');
  h.sim({job:{track:'food',city:'nyc',loc:'chinatown'}});options=h.open('reception','counter');const shift=options.find(o=>o.id==='shift-food');assert(shift);assert.equal(shift.reason,'');assert.equal(shift.task.slotId,'service');
 });
 for(const [city,loc]of [['nyc','dumbo'],['bay','techCampus']])await check(`${city} desk applies with a city-prefixed job id despite Atlanta prototypes`,async()=>{
  const h=harness();h.room(city,loc,'work');const option=h.open('desk-0','desk').find(o=>o.id==='apply-tech');assert(option);assert.equal(option.task.jobId,`${city}-tech-1`);assert.equal(option.reason,'');
  h.interactions.chooseObjectAction(option.id);h.atTask();h.tick();await drain();assert.equal(h.calls.find(c=>c.kind==='apply')?.jobId,`${city}-tech-1`);
 });
 await check('occupied clicked table has a visible disabled reason and cannot enqueue',()=>{
  const h=harness(),layout=h.room('atl','ponce','foodhall'),slot=layout.furniture.find(f=>f.id==='table-2').slots[0];h.store.setState({players:[{id:'other',online:true,npc:false,city:'atl',position:{...h.motion.position},activitySlot:slot}]});
  const option=h.open('table-2','table').find(o=>o.id==='meal');assert.match(option.reason,/occupied/i);h.interactions.chooseObjectAction('meal');assert.equal(h.interactions.useInteractions.getState().current,null);
 });
 await check('same-track shift at another workplace explains why it is disabled',()=>{
  const h=harness();h.room('nyc','dumbo','work');h.sim({job:{track:'tech',city:'atl',loc:'techVillage'}});assert.match(h.open('desk-0','desk').find(o=>o.id==='shift-tech').reason,/workplace.*elsewhere/i);
 });
 await check('gift gate uses elapsed life age rather than crossing a shared-clock midnight',()=>{
  const h=harness();h.room('atl','ponce','foodhall');h.store.setState({players:[{id:'neighbour',username:'Casey',online:true,npc:false,city:'atl',position:{...h.motion.position}}]});
  const person={kind:'person',id:'neighbour',city:'atl',room:h.motion.position.room,point:{x:0,z:0},screen:{x:640,y:400}};
  h.sim({createdAt:h.now-600000,arrivalDay:99});h.interactions.openObjectMenu(person);assert.match(h.interactions.useInteractions.getState().menu.options.find(o=>o.id==='gift').reason,/one game day/);
  h.sim({createdAt:h.now-1440000});h.interactions.openObjectMenu(person);assert.equal(h.interactions.useInteractions.getState().menu.options.find(o=>o.id==='gift').reason,'');
  h.sim({cash:24});h.interactions.openObjectMenu(person);assert.match(h.interactions.useInteractions.getState().menu.options.find(o=>o.id==='gift').reason,/25/);
 });
 await check('queue keeps FIFO through the empty-current gap and caps waiting at three',async()=>{
  const h=harness();for(const name of ['A','B','C'])h.interactions.enqueueAction(h.walk(name));h.tick();await drain();assert.equal(h.interactions.useInteractions.getState().current,null);
  h.interactions.enqueueAction(h.walk('D'));let q=h.interactions.useInteractions.getState();assert.deepEqual(Array.from(q.waiting,t=>t.label),['B','C','D']);assert.equal(q.current,null);
  h.interactions.enqueueAction(h.walk('overflow'));assert.equal(h.interactions.useInteractions.getState().waiting.length,3);assert.match(h.interactions.useInteractions.getState().error,/full/);h.tick();assert.equal(h.interactions.useInteractions.getState().current.label,'B');
 });
 await check('external cancellation deduplicates and preserves newly queued work while RPC is pending',async()=>{
  const h=harness(),pending=deferred();h.sim({busyUntil:h.now+6000});h.api.cancelAction=()=>{h.calls.push({kind:'cancel'});return pending.promise};h.interactions.enqueueAction(h.walk('B'));
  const first=h.interactions.cancelInteraction('external'),second=h.interactions.cancelInteraction('external');h.sim({busyUntil:null});h.interactions.enqueueAction(h.walk('C'));h.tick();assert.equal(h.interactions.useInteractions.getState().current,null);assert.equal(h.calls.filter(c=>c.kind==='cancel').length,1);
  pending.resolve(h.reply({busyUntil:null,activitySlot:null}));await Promise.all([first,second]);h.tick();const q=h.interactions.useInteractions.getState();assert.equal(q.current.label,'B');assert.deepEqual(Array.from(q.waiting,t=>t.label),['C']);
 });
 await check('cancel during a pending bench request releases the accepted posture',async()=>{
  const h=harness(),pending=deferred();h.api.posture=()=>{h.calls.push({kind:'posture'});return pending.promise};h.interactions.enqueueAction({...h.walk('Sit'),kind:'posture',benchId:'centennial:0'});h.tick();await drain();const id=h.interactions.useInteractions.getState().current.id;assert.equal(h.interactions.useInteractions.getState().phase,'starting');
  await h.interactions.cancelInteraction(id);pending.resolve(h.reply({activitySlot:{id:'centennial:0',bench:true}}));await drain();assert.equal(h.calls.filter(c=>c.kind==='cancel').length,1);assert.equal(h.store.getState().sim.activitySlot,null);assert.equal(h.interactions.useInteractions.getState().current,null);
 });
 await check('new browser life invalidates queued work and ignores a late action response',async()=>{
  const h=harness(),pending=deferred();h.api.act=(...args)=>{h.calls.push({kind:'act',args});return pending.promise};h.open('stove','stove');h.interactions.chooseObjectAction('cook');h.atTask();h.tick();await drain();assert.equal(h.calls.filter(c=>c.kind==='act').length,1);const old=h.reply({busyUntil:h.now+6000});old.result={text:'Old life payoff'};
  h.interactions.enqueueAction(h.walk('Old queued walk'));h.store.setState({sim:{...clone(h.store.getState().sim),userId:'life-b',position:{...h.motion.position,room:'home:life-b'},busyUntil:null},acting:false,lastResult:null});
  assert.equal(h.interactions.useInteractions.getState().current,null);assert.equal(h.interactions.useInteractions.getState().waiting.length,0);pending.resolve(old);await drain();assert.equal(h.store.getState().sim.userId,'life-b');assert.equal(h.store.getState().lastResult,null);assert.equal(h.store.getState().acting,false);
 });
 await check('automatic corner waits for one authoritative flush before steering down the next edge',async()=>{
  const h=harness(),start=clone(h.motion.position),corner={x:start.x+.5,z:start.z},end={x:corner.x,z:corner.z-1},pending=deferred();
  h.setRoute(()=>[corner,end]);h.motion.flush=()=>{h.calls.push({kind:'corner-flush'});return pending.promise};h.interactions.enqueueAction({...h.walk('Around corner'),point:end});
  const first=h.tick();assert(first.x>0);h.motion.position={...h.motion.position,...corner};const paused=h.tick();assert.equal(paused.x,0);assert.equal(paused.z,0,'Turned before the server acknowledged the corner');
  h.tick();assert.equal(h.calls.filter(c=>c.kind==='corner-flush').length,1);assert.equal(h.interactions.useInteractions.getState().current.label,'Around corner');
  pending.resolve();await drain();const next=h.tick();assert(next.z<0,'Did not resume the next edge after flushing the corner');assert.equal(next.x,0);
 });
 await check('late corner flush cannot advance or discard a new life route',async()=>{
  const h=harness(),start=clone(h.motion.position),corner={x:start.x+.5,z:start.z},end={x:corner.x,z:corner.z-1},pending=deferred();
  h.setRoute(()=>[corner,end]);h.motion.flush=()=>{h.calls.push({kind:'corner-flush'});return pending.promise};h.interactions.enqueueAction({...h.walk('Old corner'),point:end});h.tick();h.motion.position={...h.motion.position,...corner};h.tick();assert.equal(h.calls.filter(c=>c.kind==='corner-flush').length,1);
  h.store.setState({sim:{...clone(h.store.getState().sim),userId:'life-b',position:{...h.motion.position,room:'home:life-b'}},acting:false});h.motion.position={...h.motion.position,room:'home:life-b'};h.setRoute((_city,_room,_start,goal)=>[{...goal}]);
  h.interactions.enqueueAction({...h.walk('New route'),point:{x:corner.x-1,z:corner.z}});pending.resolve();await drain();const next=h.tick();assert.equal(h.interactions.useInteractions.getState().current.label,'New route');assert(next.x<0);assert.equal(next.z,0);
 });
 await check('manual movement cancels the current route and keeps keyboard axes untouched',()=>{
  const h=harness();h.interactions.enqueueAction(h.walk('A'));h.motion.x=1;h.motion.z=-1;h.interactions.interactionSteering(10000,true);assert.equal(h.interactions.useInteractions.getState().current,null);assert.equal(h.motion.x,1);assert.equal(h.motion.z,-1);
 });
 const failures=checks.filter(row=>row.result==='FAIL'),out=path.resolve(process.env.METRO_EVIDENCE||'evidence/round2/item5-actions-check.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({result:failures.length?'FAIL':'PASS',source:path.relative(process.cwd(),file),sourceSha256:require('crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex'),limits:'CPU contract fixture; navigationRoute is mocked, actual room layouts/canStand/actionReason are loaded. No GPU, browser, backend or build.',checks},null,2)+'\n');
 console.log(`${failures.length?'FAIL':'PASS'} ${checks.length-failures.length}/${checks.length} actual interaction-module checks`);if(failures.length)process.exitCode=1;
}
run().catch(error=>{console.error(error);process.exitCode=1});
