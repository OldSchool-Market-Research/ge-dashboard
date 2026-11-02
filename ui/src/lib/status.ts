// Every status in plain words: what a state means, why a strategy closed (from
// the evaluator's failure_mode and state_reason), whether it made money and how
// that figure was reached, and how a running one is doing against its test.
// The rules being explained live in ge-orchestrator internal/eval (transition)
// and internal/runner/vet.go; the numbers come from GET /api/outcomes.
import { gp, type Outcome } from './api'

export const STATE_INFO: Record<string, { label: string; meaning: string }> = {
  // strategies
  open: { label: 'Running', meaning: 'Being paper-traded now: re-priced against the live market every 5 to 15 minutes.' },
  armed: { label: 'Waiting', meaning: 'Waiting for its trigger. Not trading yet, and it gives up after 7 days.' },
  confirmed: { label: 'Proven', meaning: 'Passed its full test window: enough healthy checks and a high enough pace.' },
  expired: { label: 'Timed out', meaning: 'Reached the end of its test window, or never started, without clearing the bar.' },
  killed: { label: 'Killed', meaning: 'Closed early because the edge ended. Not the same as losing money: what it earned first still counts.' },
  vetoed: { label: 'Vetoed', meaning: 'Refused by the rules when it shipped, so it never traded.' },
  // one check of a running strategy
  healthy: { label: 'Healthy', meaning: 'Every check passes right now.' },
  degraded: { label: 'Degraded', meaning: 'A soft check fails right now, such as a stale price or thin volume. It keeps running, but too many of these stop it being proven.' },
  kill_signal: { label: 'Kill signal', meaning: 'A hard check failed. A few of these in a row closes the strategy.' },
  // runs
  running: { label: 'Running', meaning: 'The model is working on this run now.' },
  succeeded: { label: 'Succeeded', meaning: 'The run finished and its report was accepted.' },
  failed: { label: 'Failed', meaning: 'The run broke before it finished, so it shipped nothing.' },
}

export const LANE_INFO: Record<string, { name: string; how: string }> = {
  C: { name: 'Conversion', how: 'Buys the parts, converts them (assembles a set, decants, upgrades) and sells the result. The profit is the gap between parts and product after the 2% sell tax, so it does not rely on prices rising.' },
  P: { name: 'Processing', how: 'Buys materials, processes them by hand and sells the output. It earns only while someone is playing, so its number is gp per hour of play, and it never adds to gp earned.' },
  F: { name: 'Flip', how: 'Buys an item at its low price and sells it at its high price. The profit is that spread after the 2% sell tax.' },
  B: { name: 'High-value flip', how: 'Flips an expensive item, held for about a day. The profit is the spread after the 2% sell tax.' },
  V: { name: 'Volume shock', how: 'Trades the price move it expects after an unusual spike in volume.' },
  U: { name: 'Game update', how: 'Takes a position around a game update and trades the price move it expects.' },
  S: { name: 'Seasonal', how: 'Buys and sells in the hours of the week when prices tend to repeat.' },
  H: { name: 'Hold', how: 'Buys and holds for weeks.' },
}

const PAPER_NOTE =
  'Nobody traded this. At each check the evaluator re-prices the plan at live prices, after tax and slippage, and caps the size at what the market could absorb. The result is the median pace across checks × hours alive, so treat it as an upper bound.'
const PACE_NOTE =
  'Nobody traded this. At each check the evaluator re-prices the recipe at live prices, after tax and slippage. The figure is the median pace across those checks.'

// how a strategy's figure was reached; null when it never traded
export function paperNote(o: Outcome): string | null {
  if (moneyOf(o).kind === 'never') return null
  return o.archetype === 'P' ? PACE_NOTE : PAPER_NOTE
}

export function laneName(archetype: string): string {
  return LANE_INFO[archetype]?.name ?? archetype
}

export function hoursText(h: number): string {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`
  if (h < 10) return `${h.toFixed(1)}h`
  if (h < 72) return `${Math.round(h)}h`
  return `${(h / 24).toFixed(1)}d`
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`
}

export interface Why {
  headline: string
  detail: string
}

function killDetail(o: Outcome): Record<string, Why> {
  const profit =
    o.archetype === 'C'
      ? 'Profit per batch was under the kill bar'
      : o.archetype === 'P'
        ? 'Its gp per hour of play was under the kill bar'
        : 'Its profit was under the kill bar'
  return {
    margin_collapse: { headline: 'Profit dried up', detail: profit },
    leg_stale: { headline: 'Stopped trading', detail: 'A leg had no recent trade, so there was no live price to judge it on,' },
    volume_dried: { headline: 'Market went thin', detail: 'Too little traded to fill its size' },
    stopped_out: { headline: 'Hit its stop price', detail: 'The price was through the kill price set when it shipped' },
    entry_unreachable: { headline: 'Entry out of reach', detail: 'The price stayed above where it planned to buy' },
    exit_not_printing: { headline: 'Exit not printing', detail: 'The price stayed below where it planned to sell' },
  }
}

function whyExpired(o: Outcome, reason: string): Why {
  if (o.failure_mode === 'never_triggered') return { headline: 'Trigger never fired', detail: 'It waited 7 days for its trigger and never traded.' }
  if (reason.includes('event passed')) return { headline: 'Event passed', detail: 'More than 7 days went by after the game event it was built around.' }
  if (reason.includes('in-window observations')) return { headline: 'Too few observations', detail: 'The market barely traded in its seasonal windows, so there was nothing to judge.' }
  const m = reason.match(/(\d+)\/(\d+) healthy, ratio (-?[\d.]+) vs calibrated bar (-?[\d.]+)/)
  if (!m) return { headline: 'Earned too little', detail: reason }
  const share = Number(m[1]) / Math.max(1, Number(m[2]))
  const ratio = Number(m[3])
  const bar = Number(m[4])
  const need = o.confirm_healthy || 0.8
  const pace = reason.match(/(\d+) gp\/hr realized vs (\d+) needed/)
  const short = ratio < bar || pace !== null
  const parts = [`Healthy on ${pct(share)} of checks (needed ${pct(need)})`, `earned ${pct(ratio)} of its planned pace (needed ${pct(bar)})`]
  if (pace) parts.push(`${gp(Number(pace[1]))}/hr against the ${gp(Number(pace[2]))}/hr this lane needs`)
  return { headline: short ? 'Earned too little' : 'Too many bad checks', detail: `${parts.join(', ')}.` }
}

function whyConfirmed(o: Outcome, reason: string): Why {
  const m = reason.match(/(\d+)\/(\d+) healthy, median realized\/projected (-?[\d.]+) >= calibrated bar (-?[\d.]+)/)
  if (!m) return { headline: 'Passed its test', detail: reason }
  const share = Number(m[1]) / Math.max(1, Number(m[2]))
  return {
    headline: 'Passed its test',
    detail: `Healthy on ${pct(share)} of checks (needed ${pct(o.confirm_healthy || 0.8)}) and earned ${pct(Number(m[3]))} of its planned pace (needed ${pct(Number(m[4]))}).`,
  }
}

const VETO_RULES: [RegExp, string][] = [
  [/already has an open/, 'Already running on this item'],
  [/claimed per_cycle_gp/, "Profit claim didn't check out"],
  [/kill_price .* already breached/, 'Already past its stop price'],
  [/legs do not match|must be recipe|not found in process_recipes|cites no recipe_id|is a C relation/, 'Recipe was wrong'],
  [/below the .* floor|below the .*gate|exceeds? .*floor/, 'Too small'],
  [/graveyarded/, 'Killed too often lately'],
  [/exceeds the .* research budget|units .* budget|capital/, 'Sizing or budget problem'],
  [/snapshots|at the floor in only|margin_persistence/, "Margin doesn't last"],
  [/hasn't traded|no known|doesn't earn/, 'Recipe not tradeable right now'],
  [/weight 0/, 'Lane is switched off'],
]

function whyVetoed(reason: string): Why {
  const detail = reason.replace(/^vetoed at ship time: /, '')
  const hit = VETO_RULES.find(([re]) => re.test(detail))
  return { headline: hit ? hit[1] : 'Refused at ship time', detail }
}

// Why a closed strategy closed; null while it is still running.
export function whyClosed(o: Outcome): Why | null {
  const reason = o.state_reason ?? ''
  switch (o.state) {
    case 'killed': {
      const known = killDetail(o)[o.failure_mode ?? '']
      if (!known) return { headline: 'Failed its checks', detail: reason }
      return { headline: known.headline, detail: `${known.detail} on ${o.kill_needed || 3} checks in a row.` }
    }
    case 'expired':
      return whyExpired(o, reason)
    case 'confirmed':
      return whyConfirmed(o, reason)
    case 'vetoed':
      return whyVetoed(reason)
    default:
      return null
  }
}

export type MoneyKind = 'made' | 'lost' | 'flat' | 'unknown' | 'play' | 'never'

export interface Money {
  kind: MoneyKind
  value: string
  how: string
}

// Did it make money, and how that figure was reached. Paper in every case. A
// null estimate is a missing number, never a zero.
export function moneyOf(o: Outcome): Money {
  if (o.state === 'vetoed' || (o.state === 'armed' && !o.triggered_at)) return { kind: 'never', value: '—', how: 'never traded' }
  const med = o.med_realized_per_1h_gp
  if (o.archetype === 'P') {
    if (med === null) return { kind: 'unknown', value: '—', how: 'no priced checks yet' }
    return { kind: 'play', value: `${gp(med)}/hr`, how: 'per hour of play, not gp earned' }
  }
  const est = o.est_realized_gp
  if (est === null) return { kind: 'unknown', value: '—', how: 'no priced checks, so no estimate' }
  const how = o.sim_scored ? "the fill simulator's final equity" : `${gp(med)}/hr × ${hoursText(o.hours)}`
  if (est > 0) return { kind: 'made', value: `+${gp(est)}`, how }
  if (est < 0) return { kind: 'lost', value: gp(est), how }
  return { kind: 'flat', value: '0', how: 'no fillable profit at the median check' }
}

export const MONEY_CLASS: Record<MoneyKind, string> = {
  made: 'text-success',
  lost: 'text-destructive',
  flat: 'text-muted-foreground',
  unknown: 'text-muted-foreground',
  play: 'text-foreground',
  never: 'text-muted-foreground',
}

export type TestCall = 'on track' | 'behind' | 'dying' | 'too early' | 'waiting'

export interface TestProgress {
  pct: number // share of the test window gone, 0-100
  call: TestCall
  line: string
  killLine: string | null
}

// checks before a call on a running strategy means anything
const MIN_EVALS_FOR_CALL = 4

// How a running strategy stands against what will close it. The same statistics
// transition() applies when the window ends.
export function testProgress(o: Outcome): TestProgress {
  if (o.state === 'armed' && !o.triggered_at) return { pct: 0, call: 'waiting', line: 'Not trading until its trigger fires.', killLine: null }
  const window = o.window_hours || 48
  const share = o.n_evals ? o.n_healthy / o.n_evals : null
  const med = o.med_realized_per_1h_gp
  const ratio = med !== null && o.projected_per_1h_gp ? med / o.projected_per_1h_gp : null
  const healthyOk = share !== null && share >= o.confirm_healthy
  const paceOk = ratio !== null && ratio >= o.confirm_ratio_bar && (!o.confirm_min_per_1h_gp || (med ?? 0) >= o.confirm_min_per_1h_gp)
  const parts: string[] = []
  if (share !== null) parts.push(`${pct(share)} healthy (needs ${pct(o.confirm_healthy)})`)
  if (ratio !== null) parts.push(`${pct(ratio)} of planned pace (needs ${pct(o.confirm_ratio_bar)})`)
  if (o.confirm_min_per_1h_gp) parts.push(`${gp(med)}/hr (needs ${gp(o.confirm_min_per_1h_gp)}/hr)`)
  let call: TestCall = healthyOk && paceOk ? 'on track' : 'behind'
  if (o.n_evals < MIN_EVALS_FOR_CALL) call = 'too early'
  if (o.kill_streak > 0) call = 'dying'
  return {
    pct: Math.min(100, (o.hours / window) * 100),
    call,
    line: parts.join(' · ') || 'No checks yet.',
    killLine: o.kill_streak > 0 ? `${o.kill_streak} of ${o.kill_needed} kill signals in a row` : null,
  }
}

export const TEST_CALL_CLASS: Record<TestCall, string> = {
  'on track': 'text-success',
  behind: 'text-warning',
  dying: 'text-destructive',
  'too early': 'text-muted-foreground',
  waiting: 'text-muted-foreground',
}
