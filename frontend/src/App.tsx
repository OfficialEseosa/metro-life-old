import { useEffect } from 'react'
import CityScene from './scene'
import Hud from './ui'
import { useStore } from './store'

export default function App() {
  const load = useStore((s) => s.load)
  useEffect(() => {
    load()
  }, [load])

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
      <CityScene />
      <Hud />
    </div>
  )
}
