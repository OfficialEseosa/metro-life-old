import { Briefcase, Bus, PartyPopper, Utensils, Zap, type LucideIcon } from 'lucide-react'

export type Policy = { id: string; label: string; effect: string; Icon: LucideIcon }

/** Policy ids, labels and effects as defined by the live game. */
export const POLICIES: Policy[] = [
  { id: 'transport', label: 'Transport subsidy', effect: 'Danfo and keke fares are half price', Icon: Bus },
  { id: 'wages', label: 'Minimum wage raise', effect: 'Everyone earns 15% more per shift', Icon: Briefcase },
  { id: 'owambe', label: 'Owambe season', effect: 'Fun at places around Lagos is 30% stronger', Icon: PartyPopper },
  { id: 'food', label: 'Food subsidy', effect: 'Groceries and food are 30% cheaper', Icon: Utensils },
  { id: 'light', label: 'Steady light', effect: 'NEPA cuts are shorter and rarer', Icon: Zap },
]

export const POLICY_BY_ID: Record<string, Policy> = Object.fromEntries(POLICIES.map((p) => [p.id, p]))
