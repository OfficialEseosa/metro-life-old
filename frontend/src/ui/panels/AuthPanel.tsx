import { useState, type FormEvent } from 'react'
import { UserRound } from 'lucide-react'
import { api } from '../../api/client'
import type { Look } from '../../api/types'
import { useStore } from '../../store'
import { Avatar } from '../Avatar'
import { errorText } from '../format'
import { Btn, ErrorNote, Field, Sheet } from '../primitives'

const USERNAME_RE = /^[a-z0-9_]{3,20}$/i
const MIN_PASSWORD = 6

const SKINS = [
  { value: '#f1c9a5', name: 'Light' },
  { value: '#e0ac69', name: 'Golden' },
  { value: '#c68a62', name: 'Tan' },
  { value: '#8d5a3b', name: 'Brown' },
  { value: '#7a4a2c', name: 'Deep brown' },
  { value: '#5c3a21', name: 'Dark' },
]
const HAIRS = [
  { value: '#161616', name: 'Black' },
  { value: '#3b2a1e', name: 'Dark brown' },
  { value: '#6b3e1e', name: 'Brown' },
  { value: '#b5651d', name: 'Copper' },
  { value: '#d4a017', name: 'Gold' },
  { value: '#7b1e3a', name: 'Burgundy' },
]
const TOPS = [
  { value: '#f4f4f2', name: 'White' },
  { value: '#0f2557', name: 'Navy' },
  { value: '#12784a', name: 'Green' },
  { value: '#e9a23b', name: 'Amber' },
  { value: '#b93a4b', name: 'Red' },
  { value: '#0d0d0d', name: 'Black' },
]

const DEFAULT_LOOK: Look = {
  body: 'f',
  skin: '#8d5a3b',
  hair: 'curly',
  hairColor: '#161616',
  outfit: 'plain',
  top: '#12784a',
  bottom: '#2f4a7a',
  style: 'casual',
  shoes: 'whiteSneakers',
  shoeColor: '#f4f4f2',
}

function Swatches({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string
  name: string
  options: { value: string; name: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <fieldset className="ll-swatches">
      <legend className="ll-label">{legend}</legend>
      <div className="ll-swatches__row">
        {options.map((o) => (
          <label key={o.value} className="ll-swatch" title={o.name}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              aria-label={o.name}
            />
            <span className="ll-swatch__dot" style={{ background: o.value }} />
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function LookPicker({ look, onChange }: { look: Look; onChange: (l: Look) => void }) {
  return (
    <div className="ll-look">
      <div className="ll-look__preview">
        <Avatar look={look} size={72} />
      </div>
      <div className="ll-look__controls">
        <fieldset className="ll-swatches">
          <legend className="ll-label">Body</legend>
          <div className="ll-segment">
            {(['f', 'm'] as const).map((b) => (
              <label key={b} className="ll-segment__opt">
                <input
                  type="radio"
                  name="ll-body"
                  value={b}
                  checked={look.body === b}
                  onChange={() => onChange({ ...look, body: b, hair: b === 'f' ? 'curly' : 'lowcut' })}
                />
                <span>{b === 'f' ? 'Feminine' : 'Masculine'}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Swatches legend="Skin tone" name="ll-skin" options={SKINS} value={look.skin} onChange={(skin) => onChange({ ...look, skin })} />
        <Swatches
          legend="Hair colour"
          name="ll-hair"
          options={HAIRS}
          value={look.hairColor}
          onChange={(hairColor) => onChange({ ...look, hairColor })}
        />
        <Swatches legend="Top colour" name="ll-top" options={TOPS} value={look.top} onChange={(top) => onChange({ ...look, top })} />
      </div>
    </div>
  )
}

export function AuthPanel({ mode }: { mode: 'signup' | 'login' }) {
  const openPanel = useStore((s) => s.openPanel)
  const setUser = useStore((s) => s.setUser)
  const refresh = useStore((s) => s.refresh)
  const signup = mode === 'signup'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [look, setLook] = useState<Look>(DEFAULT_LOOK)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const name = username.trim()
  const nameError = !name
    ? 'Enter a username.'
    : signup && !USERNAME_RE.test(name)
      ? '3–20 characters: letters, numbers and underscores only.'
      : null
  const passError = !password
    ? 'Enter your password.'
    : signup && password.length < MIN_PASSWORD
      ? `Use at least ${MIN_PASSWORD} characters.`
      : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    setServerError(null)
    if (nameError || passError || busy) return
    setBusy(true)
    try {
      const { user } = signup ? await api.signup(name, password, look) : await api.login(name, password)
      setUser(user)
      openPanel(null)
      // per-user fields (myVote, canVote, isGovernor) and the new home change with the session
      void refresh('gov')
      if (signup) void refresh('homes')
    } catch (err) {
      setServerError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <Sheet
      variant="modal"
      icon={UserRound}
      title={signup ? 'Create your Lagosian' : 'Welcome back'}
      subtitle={signup ? 'Free. You get a home on the map straight away.' : 'Log in to pick up where you left off.'}
      onClose={() => openPanel(null)}
    >
      <form className="ll-form" onSubmit={submit} noValidate>
        <Field
          label="Username"
          hint={signup ? 'This is your @name around the city.' : undefined}
          error={touched ? nameError : null}
        >
          {(p) => (
            <input
              {...p}
              className="ll-input"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={20}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          )}
        </Field>
        <Field label="Password" error={touched ? passError : null}>
          {(p) => (
            <input
              {...p}
              className="ll-input"
              type="password"
              name="password"
              autoComplete={signup ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>

        {signup && <LookPicker look={look} onChange={setLook} />}

        <ErrorNote>{serverError}</ErrorNote>

        <Btn type="submit" size="lg" block disabled={busy}>
          {busy ? (signup ? 'Creating…' : 'Logging in…') : signup ? 'Create account' : 'Log in'}
        </Btn>
        <p className="ll-form__switch">
          {signup ? 'Already have an account?' : 'New to Lagos Life?'}{' '}
          <button type="button" className="ll-link" onClick={() => openPanel(signup ? 'login' : 'signup')}>
            {signup ? 'Log in' : 'Sign up free'}
          </button>
        </p>
      </form>
    </Sheet>
  )
}
