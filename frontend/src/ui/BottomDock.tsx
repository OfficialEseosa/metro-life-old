import { useEffect, useState } from 'react'
import { BadgeCheck, Cookie, Navigation } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store'
import { Avatar } from './Avatar'
import { compact } from './format'
import { Btn, ICON, Icon } from './primitives'

const CONSENT_KEY = 'll_consent'

const SOCIALS = [
  { label: 'X', href: 'https://x.com/LagosLifeApp' },
  { label: 'TikTok', href: 'https://www.tiktok.com/@official.lagos.lif' },
  { label: 'Instagram', href: 'https://www.instagram.com/lagoslifeapp/' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/lagos-life-app' },
]

function readConsent(): string | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY)
    return v === 'all' || v === 'essential' ? v : null
  } catch {
    return null
  }
}

function CookieCard() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setOpen(readConsent() === null), 600)
    return () => clearTimeout(t)
  }, [])

  if (!open) return null

  const choose = (v: 'all' | 'essential') => {
    try {
      localStorage.setItem(CONSENT_KEY, v)
    } catch {
      /* storage blocked: the choice simply lasts for this visit */
    }
    setOpen(false)
  }

  return (
    <section className="ll-cookie ll-card" role="dialog" aria-label="Cookies">
      <div className="ll-cookie__row">
        <span className="ll-cookie__icon">
          <Icon icon={Cookie} size={ICON.lg} />
        </span>
        <p className="ll-cookie__text">
          We use a cookie to keep you signed in, and another to count visits. No ad trackers, ever.{' '}
          <a className="ll-link" href="https://lagoslife.app/privacy" target="_blank" rel="noopener noreferrer">
            Privacy
          </a>
        </p>
      </div>
      <div className="ll-cookie__actions">
        <Btn tone="secondary" size="sm" onClick={() => choose('essential')}>
          Essential only
        </Btn>
        <Btn size="sm" onClick={() => choose('all')}>
          Accept
        </Btn>
      </div>
    </section>
  )
}

function Faces() {
  // Four looks only; useShallow keeps the result stable so the card re-renders only when they change.
  const looks = useStore(
    useShallow((s) =>
      (s.homes?.homes ?? [])
        .filter((h) => h.look)
        .slice(0, 4)
        .map((h) => h.look),
    ),
  )
  if (!looks.length) return null
  return (
    <span className="ll-faces" aria-hidden="true">
      {looks.map((look, i) => (
        <Avatar key={i} look={look} size={26} />
      ))}
    </span>
  )
}

function GuestCard() {
  const online = useStore((s) => s.visit?.online ?? null)
  const openPanel = useStore((s) => s.openPanel)
  return (
    <section className="ll-cta ll-card" aria-label="Join Lagos Life">
      <div className="ll-cta__lead">
        <Faces />
        <p className="ll-cta__text">
          {online != null && online >= 3 ? (
            <>
              <b>
                <span className="ll-num">{compact(online)}</span> Lagosians
              </b>{' '}
              playing right now · free
            </>
          ) : (
            <>
              Join the <b>Lagosians</b> living their Lagos story · free
            </>
          )}
        </p>
      </div>
      <div className="ll-cta__buttons">
        <Btn size="lg" onClick={() => openPanel('signup')}>
          Sign up free
        </Btn>
        <Btn size="lg" tone="secondary" onClick={() => openPanel('login')}>
          Log in
        </Btn>
      </div>
      <ul className="ll-socials" aria-label="Official accounts">
        <li className="ll-social ll-social--official">
          <Icon icon={BadgeCheck} size={ICON.sm} />
          Official
        </li>
        {SOCIALS.map((s) => (
          <li key={s.label}>
            <a className="ll-social" href={s.href} target="_blank" rel="noopener noreferrer">
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

function WelcomeCard() {
  const username = useStore((s) => s.user?.username ?? '')
  const look = useStore((s) => s.user?.look ?? null)
  const home = useStore((s) => s.user?.home ?? null)
  const estate = useStore((s) => (s.user?.home ? (s.world?.worldPos?.[`home_${s.user.home}`]?.label ?? null) : null))
  const setFocus = useStore((s) => s.setFocus)
  return (
    <section className="ll-welcome ll-card" aria-label="Your home">
      <Avatar look={look} size={36} />
      <div className="ll-welcome__text">
        <p className="ll-welcome__title">Welcome back, @{username}</p>
        <p className="ll-welcome__sub">Your home: {estate ?? home ?? '—'}</p>
      </div>
      <Btn size="sm" disabled={!home} onClick={() => home && setFocus(`home_${home}`)}>
        <Icon icon={Navigation} size={ICON.sm} />
        Go home
      </Btn>
    </section>
  )
}

export function BottomDock() {
  const loggedIn = useStore((s) => s.user !== null)
  return (
    <div className="ll-bottom">
      <CookieCard />
      {loggedIn ? <WelcomeCard /> : <GuestCard />}
    </div>
  )
}
