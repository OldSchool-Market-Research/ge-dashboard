// Strategy display helpers shared by the board, the detail page and the
// command center: checks in plain English, the check cadence, legs with icons
// and live prices, and the needs-you rules. Pure functions over API shapes.
import { gp, type Evaluation, type Strategy, type TrailPoint } from './api'

// Every check the evaluator emits (ge-orchestrator internal/eval), worded the
// way a player reads it. Unknown keys fall back to the key itself.
const CHECK_TEXT: Record<string, [ok: string, bad: string]> = {
  legs_priced: ['Every leg has a price', 'A leg has no price'],
  legs_fresh: ['Every leg traded recently', "A leg hasn't traded recently"],
  buy_leg_fresh: ['Buy side traded recently', "Buy side hasn't traded recently"],
  sell_leg_fresh: ['Sell side traded recently', "Sell side hasn't traded recently"],
  margin_ok: ['Margin above floor', 'Margin under floor'],
  margin_alive: ['Margin still positive', 'Margin gone'],
  vol_ok: ['Enough volume to fill', 'Volume too thin'],
  kill_price_ok: ['Above the kill price', 'Below the kill price'],
  entry_reachable: ['Entry price reachable', 'Entry price out of reach'],
  exit_reachable: ['Exit price reachable', 'Exit price out of reach'],
  trigger_fired: ['Trigger fired', 'Waiting on its trigger'],
  windows_observed: ['Seasonal windows seen', 'Seasonal windows not seen yet'],
  floor_ok: ['Above the gp floor', 'Under the gp floor'],
}

export interface CheckLine {
  key: string
  ok: boolean
  text: string
}

// checks as plain-English lines, failing first so problems lead
export function checkLines(checks: Record<string, boolean> | null | undefined): CheckLine[] {
  return Object.entries(checks ?? {})
    .map(([key, ok]) => {
      const t = CHECK_TEXT[key]
      return { key, ok, text: t ? t[ok ? 0 : 1] : `${key.replace(/_/g, ' ')}: ${ok ? 'ok' : 'failing'}` }
    })
    .sort((a, b) => Number(a.ok) - Number(b.ok))
}

export function checkLabel(key: string): string {
  return CHECK_TEXT[key]?.[0] ?? key.replace(/_/g, ' ')
}

// "every 15m", "every 4h", "daily" from checks per hour
export function cadence(checksPerHour: number | null | undefined): string {
  if (!checksPerHour || checksPerHour <= 0) return '—'
  if (checksPerHour >= 1) return `every ${Math.round(60 / checksPerHour)}m`
  const hours = 1 / checksPerHour
  return hours >= 20 ? 'daily' : `every ${Math.round(hours)}h`
}

export function ageText(seconds: number | null | undefined): string {
  if (seconds == null) return 'never'
  if (seconds < 90) return `${Math.round(seconds)}s`
  if (seconds < 5400) return `${Math.round(seconds / 60)}m`
  if (seconds < 129600) return `${Math.round(seconds / 3600)}h`
  return `${Math.round(seconds / 86400)}d`
}

export interface LegView {
  item_id: number
  name: string
  side: 'buy' | 'sell'
  qty: number
  price: number | null // from the latest eval; null = not priced, never the plan price
  plan: number | null // as shipped
  age_s: number | null
  icon: string | null
}

// The newest evaluation we have: the live one (?live=1), else the stored one.
export function latestEval(s: Strategy): Evaluation | null {
  return s.live ?? s.last_eval ?? null
}

// Legs with icons and the latest eval's prices. A leg the evaluator didn't
// price stays null (nothing traded that side), never the plan price.
// Single-item strategies (no legs) get a buy leg at the eval's insta-sell
// low and a sell leg at its insta-buy high. `ev` undefined = the strategy's
// own latest eval; null = no eval.
export function legsOf(s: Strategy, icons?: Record<string, string>, ev?: Evaluation | null): LegView[] {
  const iconMap = icons ?? s.item_icons ?? {}
  const e = ev === undefined ? latestEval(s) : ev
  const live = new Map(e?.detail?.legs?.map((l) => [`${l.side}:${l.item_id}`, l]) ?? [])
  const icon = (id: number) => iconMap[String(id)] ?? null
  if (s.legs?.length) {
    return s.legs.map((l) => {
      const side = l.side === 'sell' ? 'sell' : 'buy'
      const lv = live.get(`${side}:${l.item_id}`)
      return { item_id: l.item_id, name: l.name, side, qty: l.qty, price: lv?.price ?? null, plan: l.price, age_s: lv?.age_s ?? null, icon: icon(l.item_id) }
    })
  }
  const item = s.items?.find((i) => i.id === s.primary_item_id) ?? s.items?.[0]
  if (!item) return []
  return [
    { item_id: item.id, name: item.name, side: 'buy', qty: 1, price: e?.cur_low ?? null, plan: s.entry_price, age_s: e?.low_age_s ?? null, icon: icon(item.id) },
    { item_id: item.id, name: item.name, side: 'sell', qty: 1, price: e?.cur_high ?? null, plan: s.exit_price, age_s: e?.high_age_s ?? null, icon: icon(item.id) },
  ]
}

// C strategies convert legs into a product; every other kind trades one item
export function isCombo(s: Strategy): boolean {
  return s.archetype === 'C'
}

// what one margin is measured over
export function unitLabel(s: Strategy): string {
  return isCombo(s) ? 'per conversion' : 'per item'
}

// GE sell tax as the evaluator charges it: 2%, rounded down, capped at 5M
export function postTax(price: number): number {
  return price - Math.min(Math.floor(price / 50), 5_000_000)
}

// the short name a card leads with: the primary item, else the first one
export function shortName(s: Strategy): string {
  return s.items?.find((i) => i.id === s.primary_item_id)?.name ?? s.items?.[0]?.name ?? s.sid
}

export function projectedPerHour(s: Strategy): number | null {
  return s.projected_per_1h_gp ?? s.per_1h_gp
}

// The post-tax margin the strategy shipped with. A C exit_price is already
// post-tax per conversion (the evaluator records it as projected_margin);
// every other kind's exit_price is the gross sell offer, so tax it here.
export function planMargin(s: Strategy, ev?: Evaluation | null): number {
  if (isCombo(s)) return ev?.detail?.projected_margin ?? s.exit_price - s.entry_price
  return postTax(s.exit_price) - s.entry_price
}

// The live post-tax margin at one eval. C: the conversion margin from the
// eval's detail, null when a leg wasn't priced (the stored sum is then
// partial) — never cur_margin, which there is only the primary item's own
// spread. Other kinds: cur_margin, the item's post-tax buy/sell spread.
export function evalMargin(e: Evaluation | null | undefined, combo: boolean): number | null {
  if (!e) return null
  if (!combo) return e.cur_margin
  if (e.checks?.legs_priced === false) return null
  return e.detail?.combo_margin_now ?? null
}

// same rule for a trail point (the server already nulls a partial combo)
export function trailMargin(p: TrailPoint, combo: boolean): number | null {
  return combo ? (p.combo_margin ?? null) : p.cur_margin
}

export function marginNow(s: Strategy): number | null {
  const p = s.trail?.at(-1)
  return p ? trailMargin(p, isCombo(s)) : evalMargin(latestEval(s), isCombo(s))
}

export type Severity = 'critical' | 'serious' | 'warning' | 'info'

export interface Alert {
  severity: Severity
  title: string
  why: string
  strategy?: Strategy
}

const SEVERITY_ORDER: Severity[] = ['critical', 'serious', 'warning', 'info']

// What needs a person, from the open book alone. Each rule is a plain fact
// about the data, never a prediction:
//   critical  the evaluator says kill right now
//   serious   the latest live margin is negative
//   warning   kill signals keep firing, or the estimated realized pace was
//             zero across the trail a day after opening, or units x entry
//             disagrees with the capital it reserved
//   info      a check fails on every open strategy
export function needsYou(book: Strategy[], now = Date.now()): Alert[] {
  const out: Alert[] = []
  for (const s of book) {
    const name = `#${s.strategy_id} ${shortName(s)}`
    const ev = latestEval(s)
    const trail = s.trail ?? []
    const lastMargin = marginNow(s)
    const ageH = (now - new Date(s.opened_at).getTime()) / 3600_000
    if ((s.live_verdict ?? ev?.verdict) === 'kill_signal') {
      out.push({ severity: 'critical', title: `${name}: kill signal now`, why: 'The evaluator flags this position to close.', strategy: s })
    } else if (lastMargin !== null && lastMargin < 0) {
      out.push({ severity: 'serious', title: `${name} went negative`, why: `Latest live margin is ${gp(lastMargin)} ${unitLabel(s)}, after tax.`, strategy: s })
    }
    const kills = s.verdict_counts?.kill_signal ?? 0
    const paced = trail.some((p) => (p.realized_per_1h_gp ?? 0) > 0)
    if (kills >= 5) {
      out.push({ severity: 'warning', title: `${name}: repeated kill signals`, why: `${kills} kill signals over ${s.n_evals ?? '?'} evals.`, strategy: s })
    } else if (s.state !== 'armed' && ageH >= 24 && trail.length >= 10 && !paced) {
      out.push({
        severity: 'warning',
        title: `${name}: no realized pace yet`,
        why: `The estimated realized pace was zero in all of the last ${trail.length} evals, ${Math.round(ageH)}h after opening.`,
        strategy: s,
      })
    }
    if (s.units_used && s.capital_required && s.entry_price > 0) {
      const implied = s.units_used * s.entry_price
      if (implied > s.capital_required * 2 || implied < s.capital_required / 2) {
        out.push({
          severity: 'warning',
          title: `${name}: sizing looks off`,
          why: `${s.units_used.toLocaleString()} units at ${gp(s.entry_price)} is ${gp(implied)}, but it reserved ${gp(s.capital_required)}.`,
          strategy: s,
        })
      }
    }
  }
  if (book.length >= 2) {
    const keys = new Set(book.flatMap((s) => Object.keys(latestEval(s)?.checks ?? s.live_checks ?? {})))
    for (const k of keys) {
      const failing = book.filter((s) => (latestEval(s)?.checks ?? s.live_checks ?? {})[k] === false)
      if (failing.length === book.length) {
        out.push({ severity: 'info', title: `"${checkLabel(k)}" fails on all ${book.length}`, why: 'Every open strategy fails this check right now.' })
      }
    }
  }
  return out.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
}

// a failed run's kind in words (orchestrator 0.17 fail_kind)
export const FAIL_KIND_LABEL: Record<string, string> = {
  rejected: 'report rejected',
  max_turns: 'out of turns',
  max_tokens: 'output token cap',
  restart: 'orchestrator restart',
  tool_error: 'tool error',
  other: 'other',
}
