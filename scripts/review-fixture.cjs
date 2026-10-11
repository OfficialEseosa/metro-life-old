const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const root=path.resolve(__dirname,'..'),data=path.join(root,'backend/data','review-live-'+Date.now()+'.json');
let backend,vite;const handles=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function launch(command,args,cwd,label){const fd=fs.openSync(path.join(root,'backend/data',label+'.log'),'a');handles.push(fd);return spawn(command,args,{cwd,windowsHide:true,stdio:['ignore',fd,fd]})}
async function ready(url){for(let i=0;i<100;i++){try{if((await fetch(url)).ok)return}catch{}await pause(200)}throw Error('Fixture server did not start: '+url)}
async function stop(child){if(!child||child.exitCode!==null)return;child.kill();await Promise.race([new Promise(r=>child.once('exit',r)),pause(10000)]);if(child.exitCode===null)throw Error('Fixture process did not stop')}
async function startBackend(){backend=launch('java',['-jar','target/backend-0.0.1-SNAPSHOT.jar','--server.port=8081','--metro.data='+data,'--metro.ws.origins=http://127.0.0.1:5174'],path.join(root,'backend'),'review-backend');await ready('http://localhost:8081/api/version')}
module.exports={
 async start(){fs.mkdirSync(path.dirname(data),{recursive:true});await startBackend();vite=launch(process.execPath,['node_modules/vite/bin/vite.js','--config','vite.review.config.ts','--host','127.0.0.1'],path.join(root,'frontend'),'review-vite');await ready('http://127.0.0.1:5174');return{url:'http://127.0.0.1:5174',data}},
 async establish(){await stop(backend);const snapshot=JSON.parse(fs.readFileSync(data,'utf8'));for(const sim of Object.values(snapshot.sims))sim.createdAt=Date.now()-1440001;fs.writeFileSync(data,JSON.stringify(snapshot));await startBackend()},
 async close(){await stop(vite);await stop(backend);for(const fd of handles)fs.closeSync(fd)}
};
