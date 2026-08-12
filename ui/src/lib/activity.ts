// freshness signals for anything with a last-activity timestamp —
// generalized from atlas, where it grades repos by last push.

export type Freshness = 'fresh' | 'cooling' | 'dormant'

const DAY = 24 * 60 * 60 * 1000

export function daysSince(date: string | Date | null | undefined): number | null {
  if (!date) return null
  return Math.floor((Date.now() - new Date(date).getTime()) / DAY)
}

export function freshness(
  days: number | null,
  thresholds = { fresh: 30, cooling: 90 },
): Freshness | null {
  if (days === null) return null
  if (days < thresholds.fresh) return 'fresh'
  if (days < thresholds.cooling) return 'cooling'
  return 'dormant'
}

/** "pushed 3d ago" — pass a verb matching your activity kind */
export function relativeDays(days: number | null, verb = 'active'): string {
  if (days === null) return 'no activity'
  if (days === 0) return `${verb} today`
  if (days === 1) return `${verb} yesterday`
  if (days < 30) return `${verb} ${days}d ago`
  if (days < 365) return `${verb} ${Math.floor(days / 30)}mo ago`
  return `${verb} ${Math.floor(days / 365)}y ago`
}
