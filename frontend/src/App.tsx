import { Component, lazy, Suspense, useEffect } from 'react'
import type { ReactNode } from 'react'
import Hud from './ui'
import { useStore } from './store'
const CityScene=lazy(()=>import('./scene'))
class CityBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false}
 static getDerivedStateFromError(){return{failed:true}}
 componentDidCatch(){useStore.setState({sceneFailed:true})}
 render(){return this.state.failed?<div className="scene-failure" role="alert"><strong>The city view could not open.</strong><p>Try reloading the page. Your saved life will still be here.</p><button onClick={()=>location.reload()}>Reload city</button></div>:this.props.children}
}
export default function App(){
 const load=useStore(s=>s.load)
 useEffect(()=>{window.dispatchEvent(new Event('metro-mounted'))},[])
 useEffect(()=>{void load()},[load])
 return <div style={{position:'fixed',inset:0,overflow:'hidden'}}><CityBoundary><Suspense fallback={<div className="scene-loading" role="status">Opening your city…</div>}><CityScene/></Suspense></CityBoundary><Hud/></div>
}
