import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { CircleAlert, X, type LucideIcon } from 'lucide-react'

/** One stroke width and a three-step size scale for every icon in the HUD. */
export const ICON = { stroke: 1.75, sm: 14, md: 16, lg: 20 } as const

export function Icon({ icon: I, size = ICON.md, className }: { icon: LucideIcon; size?: number; className?: string }) {
  return <I size={size} strokeWidth={ICON.stroke} className={className} aria-hidden="true" focusable="false" />
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  block?: boolean
}

export function Btn({ tone = 'primary', size = 'md', block, className, type = 'button', ...rest }: BtnProps) {
  const cls = ['ll-btn', `ll-btn--${tone}`, `ll-btn--${size}`, block ? 'll-btn--block' : '', className ?? '']
    .filter(Boolean)
    .join(' ')
  return <button type={type} className={cls} {...rest} />
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p className="ll-note ll-note--error" role="alert">
      <Icon icon={CircleAlert} size={ICON.sm} />
      <span>{children}</span>
    </p>
  )
}

export function OkNote({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p className="ll-note ll-note--ok" role="status">
      {children}
    </p>
  )
}

type FieldProps = {
  label: string
  hint?: string
  error?: string | null
  children: (p: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode
}

/** Label + control + inline error, wired together with ids. */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId()
  const descId = `${id}-d`
  const desc = error || hint
  return (
    <div className="ll-field">
      <label className="ll-label" htmlFor={id}>
        {label}
      </label>
      {children({ id, 'aria-describedby': desc ? descId : undefined, 'aria-invalid': error ? true : undefined })}
      {desc && (
        <p id={descId} className={error ? 'll-field__msg ll-field__msg--error' : 'll-field__msg'}>
          {desc}
        </p>
      )}
    </div>
  )
}

type SheetProps = {
  title: string
  subtitle?: string
  icon?: LucideIcon
  onClose: () => void
  /** 'modal' = centred dialog with a dim backdrop; 'sheet' = side sheet (bottom sheet on phones) */
  variant?: 'modal' | 'sheet'
  /** false leaves the map underneath interactive (no click-catching backdrop) */
  backdrop?: boolean
  header?: ReactNode
  children: ReactNode
}

/**
 * Shared overlay shell. Focuses the first form field on open (or the close button when there
 * is none) and returns focus to whatever was focused before when it closes.
 */
export function Sheet({ title, subtitle, icon, onClose, variant = 'sheet', backdrop = true, header, children }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const root = ref.current
    const target =
      root?.querySelector<HTMLElement>('[data-autofocus]') ??
      root?.querySelector<HTMLElement>('.ll-sheet__body input:not([disabled]), .ll-sheet__body textarea:not([disabled])') ??
      root?.querySelector<HTMLElement>('.ll-sheet__close')
    target?.focus({ preventScroll: true })
    return () => {
      if (prev && prev.isConnected) prev.focus({ preventScroll: true })
    }
  }, [])

  return (
    <div className={`ll-overlay ll-overlay--${variant}`}>
      {backdrop && <div className="ll-overlay__backdrop" onClick={onClose} aria-hidden="true" />}
      <div ref={ref} className="ll-sheet" role="dialog" aria-modal={backdrop || undefined} aria-labelledby={titleId}>
        {header}
        <div className="ll-sheet__head">
          {icon && (
            <span className="ll-sheet__icon">
              <Icon icon={icon} size={ICON.lg} />
            </span>
          )}
          <div className="ll-sheet__titles">
            <h2 id={titleId} className="ll-sheet__title">
              {title}
            </h2>
            {subtitle && <p className="ll-sheet__subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="ll-iconbtn ll-sheet__close" onClick={onClose} aria-label="Close">
            <Icon icon={X} size={ICON.md} />
          </button>
        </div>
        <div className="ll-sheet__body">{children}</div>
      </div>
    </div>
  )
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="ll-stat">
      <span className="ll-micro">{label}</span>
      <span className="ll-stat__value">{value}</span>
    </div>
  )
}
