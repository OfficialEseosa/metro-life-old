import { useState } from 'react'
import { Cloud, CloudRain, Crown, Eye, House, Landmark, LogOut, Megaphone, Sparkles, Sun, Wallet, Waves, Wind, type LucideIcon } from 'lucide-react'
import { api } from '../api/client'
import { useStore } from '../store'
import { compact, naira, num } from './format'
import { POLICY_BY_ID } from './policies'
import { Btn, ICON, Icon } from './primitives'

const WEATHER: Record<string, { Icon: LucideIcon; label: string }> = {
  sunny: { Icon: Sun, label: 'Sunny' },
  rainy: { Icon: CloudRain, label: 'Rainy' },
  cloudy: { Icon: Cloud, label: 'Cloudy' },
  harmattan: { Icon: Wind, label: 'Harmattan' },
}

function Account() {
  const user = useStore((s) => s.user)
  const openPanel = useStore((s) => s.openPanel)
  const setUser = useStore((s) => s.setUser)
  const [busy, setBusy] = useState(false)

  if (!user) {
    return (
      <div className="ll-bar__actions">
        <Btn size="sm" onClick={() => openPanel('signup')}>
          Sign up
        </Btn>
        <Btn size="sm" tone="secondary" onClick={() => openPanel('login')}>
          Log in
        </Btn>
      </div>
    )
  }

  const logout = async () => {
    setBusy(true)
    try {
      await api.logout()
    } catch {
      /* the session cookie may already be gone; signing out locally is still right */
    }
    setUser(null)
    setBusy(false)
  }

  return (
    <div className="ll-bar__actions">
      <span className="ll-bar__user" title={`@${user.username}`}>
        @{user.username}
      </span>
      <span className="ll-bar__stat" title="Cash">
        <Icon icon={Wallet} size={ICON.sm} />
        <span className="ll-num">{naira(user.cash)}</span>
      </span>
      <span className="ll-bar__stat ll-bar__stat--xp" title="XP">
        <Icon icon={Sparkles} size={ICON.sm} />
        <span className="ll-num">{num(user.xp)}</span>
        <span className="ll-bar__unit">XP</span>
      </span>
      <button type="button" className="ll-iconbtn" onClick={logout} disabled={busy} aria-label="Log out" title="Log out">
        <Icon icon={LogOut} size={ICON.md} />
      </button>
    </div>
  )
}

function Counters() {
  const online = useStore((s) => s.visit?.online ?? null)
  const visits = useStore((s) => s.visit?.visits ?? null)
  return (
    <div className="ll-bar__counters">
      <span className="ll-counter ll-counter--live">
        <span className="ll-dot" aria-hidden="true" />
        <span className="ll-num">{compact(online)}</span> online
      </span>
      <span className="ll-counter">
        <Icon icon={Eye} size={ICON.sm} />
        <span className="ll-num">{compact(visits)}</span> visits
      </span>
    </div>
  )
}

function Chips() {
  const govName = useStore((s) => s.gov?.governor?.username ?? null)
  const homesTotal = useStore((s) => (s.homes ? (s.homes.total ?? s.homes.homes.length) : null))
  const openPanel = useStore((s) => s.openPanel)
  const setFocus = useStore((s) => s.setFocus)

  return (
    <nav className="ll-chips" aria-label="City">
      <button type="button" className="ll-chip" onClick={() => openPanel('gov')}>
        <Icon icon={Landmark} size={ICON.sm} />
        <span className="ll-chip__text">{govName ? `Gov @${govName}` : 'Governor'}</span>
      </button>
      <button
        type="button"
        className="ll-chip"
        onClick={() => {
          openPanel('sea')
          setFocus('sea')
        }}
      >
        <Icon icon={Waves} size={ICON.sm} />
        <span className="ll-chip__text">Sea Plots</span>
      </button>
      <button
        type="button"
        className="ll-chip"
        onClick={() => {
          openPanel('homes')
          setFocus('homes')
        }}
      >
        <Icon icon={House} size={ICON.sm} />
        <span className="ll-chip__text">
          <span className="ll-num">{homesTotal == null ? '—' : num(homesTotal)}</span> homes
        </span>
      </button>
    </nav>
  )
}

function PolicyBanner() {
  const username = useStore((s) => s.gov?.governor?.username ?? null)
  const policy = useStore((s) => s.gov?.governor?.policy ?? null)
  const announcement = useStore((s) => s.gov?.governor?.announcement ?? null)
  const openPanel = useStore((s) => s.openPanel)

  const p = policy ? POLICY_BY_ID[policy] : undefined
  if (!announcement && !p) return null

  return (
    <button type="button" className="ll-banner" onClick={() => openPanel('gov')}>
      <span className="ll-banner__icon">
        <Icon icon={announcement ? Megaphone : p!.Icon} size={ICON.sm} />
      </span>
      {announcement ? (
        <span className="ll-banner__text">
          <b>Gov @{username}</b> {announcement}
        </span>
      ) : (
        <span className="ll-banner__text">
          <b>{p!.label}</b> is law this week
          <span className="ll-banner__effect"> · {p!.effect}</span>
        </span>
      )}
    </button>
  )
}

function DailyStrip() {
  const daily = useStore((s) => s.daily)
  const w = WEATHER[daily?.weather ?? ''] ?? null
  return (
    <aside className="ll-daily" aria-label="Today in Lagos">
      <div className="ll-daily__head">
        <span className="ll-daily__weather" title={w?.label}>
          <Icon icon={w?.Icon ?? Sun} size={ICON.md} />
        </span>
        <span className="ll-micro">{daily?.weekday ?? 'Today'}</span>
        {w && <span className="ll-daily__cond">{w.label}</span>}
      </div>
      <p className="ll-daily__headline">{daily?.headline ?? '—'}</p>
      {daily?.tip && <p className="ll-daily__tip">{daily.tip}</p>}
    </aside>
  )
}

export function TopBar() {
  return (
    <div className="ll-top">
      <header className="ll-bar ll-card">
        <div className="ll-brand">
          <span className="ll-brand__mark">
            <Icon icon={Crown} size={ICON.md} />
          </span>
          <span className="ll-brand__name">Lagos Life</span>
        </div>
        <Counters />
        <Account />
      </header>
      <Chips />
      <PolicyBanner />
      <DailyStrip />
    </div>
  )
}
