import { useEffect, useRef, useState } from 'react'
export const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n)
export function useTask(){const[working,setWorking]=useState(false),[error,setError]=useState('');const guard=useRef(false);async function run(task:()=>Promise<void>){if(guard.current)return;guard.current=true;setWorking(true);setError('');try{await task()}catch(e){setError(e instanceof Error?e.message:'Something went wrong. Try again.')}finally{guard.current=false;setWorking(false)}}return{working,error,run}}
export function useNow(){const[now,setNow]=useState(Date.now);useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[]);return now}
