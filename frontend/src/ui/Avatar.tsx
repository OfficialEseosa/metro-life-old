import { memo } from 'react'
import type { Look } from '../api/types'

type Props = { look?: Partial<Look> | null; size?: number; className?: string }

const isColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v)

/** Small portrait drawn from a look's colours (skin, hairColor, top). Decorative. */
export const Avatar = memo(function Avatar({ look, size = 32, className }: Props) {
  const skin = isColor(look?.skin) ? look.skin : '#8d5a3b'
  const hair = isColor(look?.hairColor) ? look.hairColor : '#161616'
  const top = isColor(look?.top) ? look.top : '#12784a'
  const style = look?.hair ?? ''
  const big = style === 'afro' || style === 'curly'
  const long = look?.body === 'f' || style === 'bonestraight'

  return (
    <svg
      className={className ? `ll-avatar ${className}` : 'll-avatar'}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <g>
        <rect width="32" height="32" fill="#e6e2d9" />
        {long && <rect x="8" y="9" width="16" height="16" rx="6" fill={hair} />}
        {big && <circle cx="16" cy="12" r="9.5" fill={hair} />}
        <path d="M4 34c0-7 5-10.5 12-10.5S28 27 28 34Z" fill={top} stroke="rgba(0,0,0,0.12)" strokeWidth="0.5" />
        <rect x="13.5" y="19" width="5" height="6" rx="2" fill={skin} />
        <circle cx="16" cy="14.5" r="6.5" fill={skin} />
        <path d="M9.5 14c0-4.5 2.8-7.2 6.5-7.2s6.5 2.7 6.5 7.2c-2-2.6-4.2-3.6-6.5-3.6S11.5 11.4 9.5 14Z" fill={hair} />
      </g>
    </svg>
  )
})
