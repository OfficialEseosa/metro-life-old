import { memo, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, Landmark, Megaphone, Timer } from 'lucide-react'
import { api } from '../../api/client'
import type { Candidate, Gov } from '../../api/types'
import { useStore } from '../../store'
import { Avatar } from '../Avatar'
import { countdown, errorText, num } from '../format'
import { POLICIES, POLICY_BY_ID } from '../policies'
import { Btn, ErrorNote, Field, ICON, Icon, OkNote, Sheet } from '../primitives'

const PAGE = 50

/** Leaf component so the once-a-second tick re-renders one text node, not the panel. */
function Countdown({ to }: { to: number | null | undefined }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return <span className="ll-num">{to == null ? '—' : countdown(to - now)}</span>
}

const CandidateRow = memo(function CandidateRow({
  c,
  rank,
  mine,
  disabled,
  busy,
  onVote,
}: {
  c: Candidate
  rank: number
  mine: boolean
  disabled: boolean
  busy: boolean
  onVote: (id: string) => void
}) {
  return (
    <li className={mine ? 'll-row ll-row--mine' : 'll-row'}>
      <span className="ll-row__rank ll-num">{rank}</span>
      <Avatar look={c.look} size={36} />
      <div className="ll-row__main">
        <p className="ll-row__title">
          {c.name || c.username} <span className="ll-row__handle">@{c.username}</span>
        </p>
        {c.slogan && <p className="ll-row__sub">{c.slogan}</p>}
      </div>
      <div className="ll-row__side">
        <span className="ll-row__votes ll-num">{num(c.votes)}</span>
        {mine ? (
          <span className="ll-tag ll-tag--ok">
            <Icon icon={Check} size={ICON.sm} />
            Your vote
          </span>
        ) : (
          <Btn size="sm" tone="secondary" disabled={disabled || busy} onClick={() => onVote(c.id)} aria-label={`Vote for @${c.username}`}>
            {busy ? '…' : 'Vote'}
          </Btn>
        )}
      </div>
    </li>
  )
})

function GovernorTools({ gov }: { gov: Gov }) {
  const setGov = useStore((s) => s.setGov)
  const [policy, setPolicy] = useState(gov.governor?.policy ?? '')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<null | 'policy' | 'announce'>(null)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const run = async (kind: 'policy' | 'announce', fn: () => Promise<Gov>, done: string) => {
    setBusy(kind)
    setError(null)
    setOk(null)
    try {
      setGov(await fn())
      setOk(done)
      if (kind === 'announce') setText('')
    } catch (e) {
      setError(errorText(e))
    }
    setBusy(null)
  }

  return (
    <section className="ll-section ll-section--accent" aria-labelledby="ll-gov-office">
      <h3 id="ll-gov-office" className="ll-h3">
        Your office
      </h3>
      <form
        className="ll-form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          if (policy) void run('policy', () => api.govPolicy(policy), 'Policy is now law.')
        }}
      >
        <fieldset className="ll-options">
          <legend className="ll-label">City-wide policy</legend>
          {POLICIES.map((p) => (
            <label key={p.id} className="ll-option">
              <input type="radio" name="ll-policy" value={p.id} checked={policy === p.id} onChange={() => setPolicy(p.id)} />
              <span className="ll-option__icon">
                <Icon icon={p.Icon} size={ICON.md} />
              </span>
              <span className="ll-option__text">
                <span className="ll-option__label">{p.label}</span>
                <span className="ll-option__sub">{p.effect}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <Btn type="submit" disabled={!policy || policy === gov.governor?.policy || busy !== null}>
          {busy === 'policy' ? 'Saving…' : 'Set policy'}
        </Btn>
      </form>
      <form
        className="ll-form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          if (text.trim()) void run('announce', () => api.govAnnounce(text.trim()), 'Announcement sent to the whole city.')
        }}
      >
        <Field label="Announcement" hint="Shown to everyone in the banner under the top bar.">
          {(p) => (
            <textarea {...p} className="ll-input ll-input--area" rows={2} maxLength={140} value={text} onChange={(e) => setText(e.target.value)} />
          )}
        </Field>
        <Btn type="submit" tone="secondary" disabled={!text.trim() || busy !== null}>
          {busy === 'announce' ? 'Sending…' : 'Announce'}
        </Btn>
      </form>
      <ErrorNote>{error}</ErrorNote>
      <OkNote>{ok}</OkNote>
    </section>
  )
}

function RunForm({ gov }: { gov: Gov }) {
  const setGov = useStore((s) => s.setGov)
  const loggedIn = useStore((s) => s.user !== null)
  const openPanel = useStore((s) => s.openPanel)
  const [slogan, setSlogan] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canRun = gov.election.canRun
  const blocked = canRun === true ? null : canRun || 'You cannot run right now.'

  if (gov.election.running) {
    return (
      <section className="ll-section" aria-labelledby="ll-gov-run">
        <h3 id="ll-gov-run" className="ll-h3">
          Run for Governor
        </h3>
        <OkNote>You are on the ballot. Go and campaign.</OkNote>
      </section>
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (blocked || slogan.trim().length < 3 || busy) return
    setBusy(true)
    setError(null)
    try {
      setGov(await api.govRun(slogan.trim()))
      setSlogan('')
    } catch (err) {
      setError(errorText(err))
    }
    setBusy(false)
  }

  return (
    <section className="ll-section" aria-labelledby="ll-gov-run">
      <h3 id="ll-gov-run" className="ll-h3">
        Run for Governor
      </h3>
      <p className="ll-p">Most votes when the election closes wins a week in office: a city-wide policy and announcements.</p>
      <form className="ll-form" onSubmit={submit}>
        <Field label="Your slogan" error={slogan && slogan.trim().length < 3 ? 'At least 3 characters.' : null}>
          {(p) => (
            <input
              {...p}
              className="ll-input"
              maxLength={80}
              placeholder="e.g. Steady light for all"
              value={slogan}
              disabled={!!blocked}
              onChange={(e) => setSlogan(e.target.value)}
            />
          )}
        </Field>
        {blocked && <p className="ll-reason">{blocked}</p>}
        <ErrorNote>{error}</ErrorNote>
        {blocked && !loggedIn ? (
          <Btn onClick={() => openPanel('signup')}>Sign up to run</Btn>
        ) : (
          <Btn type="submit" disabled={!!blocked || slogan.trim().length < 3 || busy}>
            {busy ? 'Submitting…' : 'Run for Governor'}
          </Btn>
        )}
      </form>
    </section>
  )
}

function Election({ gov }: { gov: Gov }) {
  const setGov = useStore((s) => s.setGov)
  const loggedIn = useStore((s) => s.user !== null)
  const openPanel = useStore((s) => s.openPanel)
  const [shown, setShown] = useState(PAGE)
  const [voting, setVoting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sorted = useMemo(
    () => [...(gov.election.candidates ?? [])].sort((a, b) => b.votes - a.votes),
    [gov.election.candidates],
  )
  const canVote = gov.election.canVote
  const blocked = canVote === true ? null : canVote || 'You cannot vote right now.'
  const myVote = gov.election.myVote

  // stable identity so memoised rows are not re-rendered by unrelated state changes
  const vote = useMemo(
    () => async (id: string) => {
      setVoting(id)
      setError(null)
      try {
        setGov(await api.govVote(id))
      } catch (e) {
        setError(errorText(e))
      }
      setVoting(null)
    },
    [setGov],
  )

  return (
    <section className="ll-section" aria-labelledby="ll-gov-election">
      <div className="ll-section__head">
        <h3 id="ll-gov-election" className="ll-h3">
          Election
        </h3>
        <span className="ll-meta">
          <span className="ll-num">{num(sorted.length)}</span> candidates · closes in <Countdown to={gov.election.closes} />
        </span>
      </div>
      {blocked && (
        <div className="ll-reason ll-reason--row">
          <span>{blocked}</span>
          {!loggedIn && (
            <Btn size="sm" onClick={() => openPanel('signup')}>
              Sign up
            </Btn>
          )}
        </div>
      )}
      <ErrorNote>{error}</ErrorNote>
      {sorted.length === 0 ? (
        <p className="ll-empty">Nobody is on the ballot yet.</p>
      ) : (
        <ol className="ll-list">
          {sorted.slice(0, shown).map((c, i) => (
            <CandidateRow
              key={c.id}
              c={c}
              rank={i + 1}
              mine={myVote === c.id}
              disabled={!!blocked || voting !== null}
              busy={voting === c.id}
              onVote={vote}
            />
          ))}
        </ol>
      )}
      {sorted.length > shown && (
        <Btn tone="ghost" block onClick={() => setShown((n) => n + PAGE)}>
          Show more ({num(sorted.length - shown)} left)
        </Btn>
      )}
    </section>
  )
}

export function GovPanel() {
  const gov = useStore((s) => s.gov)
  const openPanel = useStore((s) => s.openPanel)
  const g = gov?.governor ?? null
  const policy = g?.policy ? POLICY_BY_ID[g.policy] : undefined

  return (
    <Sheet icon={Landmark} title="Lagos State House" subtitle="One Governor, one week, one policy." onClose={() => openPanel(null)}>
      {!gov ? (
        <p className="ll-empty">Election results are not available right now. Check back in a moment.</p>
      ) : (
        <>
          <section className="ll-govcard" aria-label="Current Governor">
            {g ? (
              <>
                <div className="ll-govcard__top">
                  <Avatar look={g.look} size={56} />
                  <div className="ll-govcard__id">
                    <span className="ll-micro">Governor</span>
                    <p className="ll-govcard__name">@{g.username}</p>
                    {g.slogan && <p className="ll-govcard__slogan">“{g.slogan}”</p>}
                  </div>
                  <div className="ll-govcard__votes">
                    <span className="ll-govcard__num ll-num">{num(g.votes)}</span>
                    <span className="ll-micro">votes</span>
                  </div>
                </div>
                <dl className="ll-facts">
                  <div className="ll-fact">
                    <dt>
                      <Icon icon={policy?.Icon ?? Landmark} size={ICON.sm} />
                      Policy
                    </dt>
                    <dd>{policy ? `${policy.label} — ${policy.effect}` : (g.policy ?? 'No policy set')}</dd>
                  </div>
                  <div className="ll-fact">
                    <dt>
                      <Icon icon={Megaphone} size={ICON.sm} />
                      Announcement
                    </dt>
                    <dd>{g.announcement || 'Nothing announced yet'}</dd>
                  </div>
                  <div className="ll-fact">
                    <dt>
                      <Icon icon={Timer} size={ICON.sm} />
                      Term ends in
                    </dt>
                    <dd>
                      <Countdown to={gov.term?.ends} />
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="ll-empty">Lagos has no Governor yet. Vote, or run for office yourself.</p>
            )}
          </section>

          {gov.isGovernor && <GovernorTools gov={gov} />}
          <Election gov={gov} />
          <RunForm gov={gov} />
        </>
      )}
    </Sheet>
  )
}
