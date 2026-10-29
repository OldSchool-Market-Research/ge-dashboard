// Run outcome vocabulary shared by the run health charts: a succeeded run
// that shipped nothing is its own outcome (a valid one), not a failure.
import type { Run } from './api'
import { STATUS } from './viz'

export type Outcome = 'shipped' | 'empty' | 'failed' | 'running'

export const OUTCOME: Record<Outcome, { label: string; color: string }> = {
  shipped: { label: 'shipped', color: STATUS.good },
  empty: { label: 'shipped nothing', color: 'hsl(var(--muted-foreground))' },
  failed: { label: 'failed', color: STATUS.critical },
  running: { label: 'running', color: 'hsl(var(--chart-3))' },
}

export function runOutcome(r: Run): Outcome {
  if (r.status === 'running') return 'running'
  if (r.status === 'failed') return 'failed'
  return r.n_strategies > 0 ? 'shipped' : 'empty'
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
