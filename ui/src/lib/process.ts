// Display helpers for processing recipes. No math on margins: the numbers come
// computed from the orchestrator; these only explain them.
import type { ProcessQuote, Throughput } from '@/lib/api'

export const throughputLabel: Record<Throughput, string> = {
  fixed: 'player speed',
  volume_capped: 'player speed, volume-capped',
  volume_bound: 'market-bound',
  unknown: 'rate unknown',
}

// Which ceiling sets the effective actions/hr: the view takes the LEAST of
// player speed, the buy-limit rate and the market-volume rate (insta orders
// use the other side of the book's volume).
export function bindingRate(q: ProcessQuote, basis: 'slow' | 'insta' = 'slow'): string | null {
  const eff = basis === 'slow' ? q.effective_actions_per_hour : q.effective_actions_per_hour_insta
  const market = basis === 'slow' ? q.market_actions_per_hour : q.market_actions_per_hour_insta
  if (eff === null) return null
  const near = (v: number | null) => v !== null && Math.abs(v - eff) < 0.01
  if (near(market)) return 'capped by market volume'
  if (near(q.limit_actions_per_hour)) return 'capped by buy limit'
  if (near(q.actions_per_hour)) return 'player speed'
  return null
}

// GE buy limits reset every 4 hours. Every cap in the quote view (player
// speed, buy limit, market volume) scales with time, so one window yields
// exactly 4 x gp/hr: a unit change, not new math.
export const WINDOW_HOURS = 4

export function perWindow(gpHr: number | null): number | null {
  return gpHr === null ? null : gpHr * WINDOW_HOURS
}

// Roughly how much clicking one window's actions take at the recipe's
// player speed. Null when there's no player-speed figure (market-bound NPC
// exchanges, unknown rates): their time per window isn't tracked.
export function activeTime(q: ProcessQuote, basis: 'slow' | 'insta' = 'slow'): string | null {
  const eff = basis === 'slow' ? q.effective_actions_per_hour : q.effective_actions_per_hour_insta
  if (eff === null || !q.actions_per_hour) return null
  const minutes = ((eff * WINDOW_HOURS) / q.actions_per_hour) * 60
  if (minutes < 1) return '<1m'
  if (minutes < 90) return `${Math.round(minutes)}m`
  return `${(minutes / 60).toFixed(1)}h`
}
