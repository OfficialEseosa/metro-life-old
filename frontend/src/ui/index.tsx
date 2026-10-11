import { useEffect } from 'react'
import { useStore } from '../store'
import './hud.css'
import { TopBar } from './TopBar'
import { BottomDock } from './BottomDock'
import { Panels } from './Panels'

/**
 * HTML overlay above the 3D scene. The root ignores pointer events so the map stays draggable;
 * only the cards opt back in.
 */
export default function Hud() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const s = useStore.getState()
      if (!s.panel) return
      e.preventDefault()
      if (s.panel === 'location') s.selectLocation(null)
      else if (s.panel === 'ads') s.selectSlot(null)
      else s.openPanel(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="ll-hud">
      <TopBar />
      <BottomDock />
      <Panels />
    </div>
  )
}
