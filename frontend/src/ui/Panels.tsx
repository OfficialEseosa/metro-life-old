import { useStore } from '../store'
import { AuthPanel } from './panels/AuthPanel'
import { GovPanel } from './panels/GovPanel'
import { SeaPanel } from './panels/SeaPanel'
import { HomesPanel } from './panels/HomesPanel'
import { AdsPanel } from './panels/AdsPanel'
import { LocationPanel } from './panels/LocationPanel'

export function Panels() {
  const panel = useStore((s) => s.panel)
  switch (panel) {
    case 'signup':
    case 'login':
      // keyed so switching between the two resets the form and re-focuses the first field
      return <AuthPanel key={panel} mode={panel} />
    case 'gov':
      return <GovPanel />
    case 'sea':
      return <SeaPanel />
    case 'homes':
      return <HomesPanel />
    case 'ads':
      return <AdsPanel />
    case 'location':
      return <LocationPanel />
    default:
      return null
  }
}
