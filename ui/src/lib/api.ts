// Typed client for the orchestrator API (same-origin /api, reverse-proxied
// by the Go server in prod and by vite in dev). Shapes mirror
// ge-orchestrator/internal/{api,store} — nullable columns stay nullable
// here; a null price/estimate is signal, never zero.

export interface Run {
  run_id: number
  started_at: string
  finished_at: string | null
  status: 'running' | 'succeeded' | 'failed'
  fail_reason: string | null
  n_strategies: number
  // why the run started; null for rows predating orchestrator migration 017
  trigger_source: 'schedule' | 'signal' | 'empty' | 'manual' | null
  // cost record from the agent's stats sidecar; null when absent
  turns: number | null
  tool_calls: number | null
  input_tokens: number | null
  output_tokens: number | null
  peak_input_tokens: number | null
  pruned_bytes: number | null
  // orchestrator 0.17+: what the run shipped (any state, vetoed included),
  // and a failed run's reason sorted into a kind (detail: the rejected field,
  // the tool name, ...). Optional so an older orchestrator still renders.
  shipped?: ShippedStrategy[]
  fail_kind?: FailKind
  fail_detail?: string
}

export type FailKind = 'rejected' | 'max_turns' | 'max_tokens' | 'restart' | 'tool_error' | 'other'

export interface ShippedStrategy {
  strategy_id: number
  archetype: string
  title: string
  state: Strategy['state']
  primary_item_id: number | null
  primary_item_name: string | null
  icon: string | null
}

// Full cost sidecar (GET /api/runs/{id}/stats) — per-turn token detail.
export interface RunStats {
  outcome: 'submitted' | 'failed'
  fail_reason?: string
  turns: number
  tool_calls: number
  input_tokens: number
  output_tokens: number
  peak_input_tokens: number
  pruned_bytes: number
  per_turn: { turn: number; input_tokens: number; output_tokens: number; tool_calls: number }[]
}

export interface AttentionSpec {
  checks_per_hour: number
  max_unattended_hours: number
}

export interface Strategy {
  strategy_id: number
  run_id: number
  sid: string
  archetype: string
  title: string
  thesis: string
  items: { name: string; id: number }[]
  primary_item_id: number
  entry: string
  exit: string
  entry_price: number
  exit_price: number
  kill_price: number | null
  horizon: string
  attention?: string
  attention_spec?: AttentionSpec
  capital_required: number | null
  units_used: number | null
  per_cycle_gp: number | null
  per_1h_gp: number | null
  projected_per_1h_gp: number | null
  confidence: string
  state: 'armed' | 'open' | 'confirmed' | 'killed' | 'expired' | 'vetoed'
  state_reason: string | null
  failure_mode?: string
  eval_epoch: number
  opened_at: string
  closed_at: string | null
  legs?: { item_id: number; name: string; side: string; qty: number; price: number }[]
  relation_id?: number
  // lane P: the process_recipes row this strategy runs (orchestrator migration 022)
  recipe_id?: number
  // live=1 extras
  live_checks?: Record<string, boolean>
  live_verdict?: string
  live?: Evaluation
  // orchestrator 0.17+ (list endpoint): item id -> /mapping icon file, the
  // newest 30 evaluations oldest first, verdict tallies over all of them,
  // and the newest stored evaluation in full
  item_icons?: Record<string, string>
  trail?: TrailPoint[]
  verdict_counts?: Record<string, number>
  n_evals?: number
  last_eval?: Evaluation | null
}

export interface TrailPoint {
  at: string
  cur_margin: number | null
  // C lane: the post-tax conversion margin (cur_margin is the primary
  // item's own spread there); null for other kinds
  combo_margin?: number | null
  verdict: Verdict
  realized_per_1h_gp: number | null
}

export interface PnLRow {
  strategy_id: number
  sid: string
  title: string
  archetype: string
  state: string
  opened_at: string
  closed_at?: string
  hours: number
  med_realized_per_1h_gp: number | null
  est_realized_gp: number | null
  projected_gp: number | null
  capital_required: number | null
  eval_epoch: number
  sim_scored?: boolean
  /** known-bad numbers (migration 016): listed by the API, counted nowhere */
  quarantined_reason?: string
  // orchestrator 0.17+
  run_id?: number
  primary_item_id?: number | null
  primary_item_name?: string | null
  icon?: string | null
}

export interface PnLBucket {
  n: number
  est_realized_gp: number
  projected_gp: number
}

export interface PnLResponse {
  as_of: string
  by_state: Record<string, PnLBucket>
  by_archetype: Record<string, PnLBucket>
  quarantined: PnLBucket
  strategies: PnLRow[]
}

export interface CalibrationRow {
  computed_at: string
  archetype: string
  n_closed: number
  n_survived: number
  p_survive: number | null
  n_pace: number
  pace_ratio: number | null
  factor: number
  epoch: number
}

export interface FailureModeCount {
  archetype: string
  mode: string
  n: number
}

export interface CalibrationResponse {
  latest: CalibrationRow[]
  history: CalibrationRow[]
  failure_modes: FailureModeCount[]
}

export interface Signal {
  signal_id: number
  kind: string
  item_id: number
  item_name: string
  metrics: Record<string, unknown>
  status: 'pending' | 'assigned' | 'investigated' | 'dismissed'
  run_id: number | null
  created_at: string
  reason: string | null
}

export interface WatchRow {
  watch_id: number
  item_id: number
  item_name: string
  archetype: string
  score: number
  times_validated: number
  times_confirmed: number
  last_result: string | null
}

export interface Health {
  ok: boolean
  db: boolean
  active_run_id: number | null
}

// Processing recipes (GET /api/process*): player-time money-makers ranked by
// gp/hr. Every number is computed by ge-data's process_quotes_now view, the
// same source as the agent's process_* tools. A null margin is an
// unpriceable leg (nothing traded that side), never zero.
export type Throughput = 'fixed' | 'volume_capped' | 'volume_bound' | 'unknown'

export interface ProcessQuote {
  recipe_id: number
  name: string
  category: string
  throughput: Throughput
  margin_slow: number | null
  margin_insta: number | null
  gp_hr: number | null
  gp_hr_insta: number | null
  gp_hr_theoretical: number | null
  actions_per_hour: number | null
  effective_actions_per_hour: number | null
  limit_actions_per_hour: number | null
  market_actions_per_hour: number | null
  // insta orders fill against the other side of the book
  effective_actions_per_hour_insta: number | null
  market_actions_per_hour_insta: number | null
  fee_gp: number
  missing_legs: number
  missing_legs_insta: number
  // buy legs with an unknown GE limit: the limit cap skips them (optimistic)
  unknown_limit_legs: number
  max_leg_age_s: number | null
  // main output's /mapping icon file (display only)
  icon: string | null
}

export interface ProcessLeg {
  side: 'buy' | 'sell'
  // null when the recipe's leg is malformed (the recipe is then unpriceable)
  item_id: number | null
  name: string | null
  qty: number | null
  buy_limit: number | null
  price_slow: number | null
  price_insta: number | null
  slow_age_s: number | null
  fill_volume_24h: number | null
  icon: string | null
}

export interface ProcessDetail {
  quote: ProcessQuote
  source: string
  relation_name: string | null
  relation_direction: 'forward' | 'reverse' | null
  notes: string | null
  legs: ProcessLeg[]
}

export interface ProcessHistoryPoint {
  bucket: string
  margin_slow: number | null
  margin_insta: number | null
  gp_hr: number | null
  gp_hr_insta: number | null
  effective_actions_per_hour: number | null
  hours: number
  priced_hours: number
}

export interface ProcessTopRow {
  recipe_id: number
  name: string
  category: string
  hours: number
  priced_hours: number
  metric_hours: number
  avg: number | null
  median: number | null
  p25: number | null
  pct_hours_positive: number | null
  hours_in_top10: number
  avg_last_24h: number | null
  // latest hour; orchestrator 0.23.2+
  unknown_limit_legs?: number
}

// Item lookup (GET /api/items*): every GE item with its latest quote from
// the last 14 days, the ingester's post-tax margin on that same row, and 24h
// volumes. A null price means nothing traded that side recently, never 0.
export interface ItemRow {
  item_id: number
  name: string
  members: boolean | null
  buy_limit: number | null
  icon: string | null
  high: number | null // latest insta-buy price
  high_time: string | null
  low: number | null // latest insta-sell price
  low_time: string | null
  margin: number | null // post-tax flip margin
  roi_pct: number | null
  limit_profit: number | null // upper bound on one 4h window: margin x min(buy limit, thinner side 24h volume / 6); null when stale, limit unknown or no volume
  high_vol_24h: number
  low_vol_24h: number
}

export interface ItemDetail extends ItemRow {
  examine: string | null
  value: number | null
  lowalch: number | null
  highalch: number | null
  recipes: { recipe_id: number; name: string; category: string; side: 'buy' | 'sell'; gp_hr: number | null }[]
}

export interface ItemHistoryPoint {
  bucket: string
  avg_high: number | null
  avg_low: number | null
  high_vol: number
  low_vol: number
}

// ApiError keeps the HTTP status so a view can branch on it (503 = the
// processing schema isn't applied yet) without string-matching a message
// that also contains the URL.
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new ApiError(res.status, `${path}: ${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}

// errorText turns a failed request into what a person should read.
export function errorText(e: unknown, notFound = 'Not found.'): string {
  if (e instanceof ApiError && e.status === 503) {
    return "The processing schema isn't applied to the database yet (ge-data init/04-06)."
  }
  if (e instanceof ApiError && e.status === 404) return notFound
  return String(e)
}

export const api = {
  health: () => get<Health>('/api/health'),
  runs: (limit = 50) => get<Run[]>(`/api/runs?limit=${limit}`),
  run: (id: number | string) => get<{ run: Run; strategies: Strategy[] }>(`/api/runs/${id}`),
  reportUrl: (id: number | string) => `/api/runs/${id}/report`,
  runStats: (id: number | string) => get<RunStats>(`/api/runs/${id}/stats`),
  report: async (id: number | string) => {
    const res = await fetch(`/api/runs/${id}/report`)
    if (!res.ok) throw new Error(`report ${id}: ${res.status}`)
    return res.text()
  },
  openBook: () => get<Strategy[]>('/api/strategies?scope=open&live=1'),
  // newest first, up to 600
  strategy: (id: number | string) =>
    get<{ strategy: Strategy; evaluations: Evaluation[]; item_icons?: Record<string, string> }>(
      `/api/strategies/${id}`,
    ),
  // quarantined strategies stay in the API's list for the record; the
  // dashboard leaves them out of every chart, list and total (the server's
  // buckets already do)
  pnl: async () => {
    const res = await get<PnLResponse>('/api/pnl')
    return { ...res, strategies: res.strategies.filter((r) => !r.quarantined_reason) }
  },
  calibration: (days = 30) => get<CalibrationResponse>(`/api/calibration?days=${days}`),
  signals: (limit = 100) => get<Signal[]>(`/api/signals?limit=${limit}`),
  watchlist: () => get<WatchRow[]>('/api/watchlist'),
  briefPreview: () => get<{ brief_text: string }>('/api/brief/preview'),
  allocation: () => get<{ latest: LaneAllocation | null }>('/api/allocation'),
  regime: (days = 1) => get<RegimeSnapshot[]>(`/api/regime?days=${days}`),
  proposals: () => get<Proposal[]>('/api/proposals'),
  decideProposal: async (id: number, status: ProposalStatus, note: string) => {
    const res = await fetch(`/api/proposals/${id}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, note }),
    })
    if (!res.ok) throw new ApiError(res.status, `decision ${id}: ${res.status} ${await res.text()}`)
    return res.json() as Promise<{ proposal_id: number; status: ProposalStatus }>
  },
  process: () => get<ProcessQuote[]>('/api/process'),
  items: () => get<ItemRow[]>('/api/items'),
  item: (id: number | string) => get<ItemDetail>(`/api/items/${id}`),
  itemHistory: (id: number | string, days: 1 | 7 | 30 | 90 = 7) =>
    get<ItemHistoryPoint[]>(`/api/items/${id}/history?days=${days}`),
  processTop: (days = 7, limit = 20, metric: 'gp_hr' | 'gp_hr_insta' = 'gp_hr') =>
    get<ProcessTopRow[]>(`/api/process/top?days=${days}&limit=${limit}&metric=${metric}`),
  processDetail: (id: number | string) => get<ProcessDetail>(`/api/process/${id}`),
  processHistory: (id: number | string, days = 7, bucket: '1h' | '6h' | '1d' = '1h') =>
    get<ProcessHistoryPoint[]>(`/api/process/${id}/history?days=${days}&bucket=${bucket}`),
  triggerRun: async () => {
    const res = await fetch('/api/runs', { method: 'POST', body: '{}' })
    if (res.status === 409) throw new Error('a run is already in progress')
    if (!res.ok) throw new Error(`trigger: ${res.status} ${await res.text()}`)
    return res.json() as Promise<{ run_id: number }>
  },
}

export type Verdict = 'healthy' | 'degraded' | 'kill_signal'

export interface Evaluation {
  at: string
  cur_high: number | null
  cur_low: number | null
  high_age_s?: number | null
  low_age_s?: number | null
  cur_margin: number | null
  vol_30m?: number | null
  realized_per_1h_gp: number | null
  verdict: Verdict
  checks: Record<string, boolean>
  detail?: EvalDetail | null
}

// The evaluator's working (C lane carries per-leg prices and the margin the
// strategy shipped with). Every field is optional: kinds differ.
export interface EvalDetail {
  // vol_4h and trades_24h since C's epoch 2; older ticks have vol_30m only
  legs?: { item_id: number; name: string; side: 'buy' | 'sell'; qty: number; price: number | null; age_s: number | null; vol_30m: number | null; vol_4h?: number | null; trades_24h?: number | null }[]
  projected_margin?: number
  combo_margin_now?: number
  kill_bar_gp?: number
  // lane P: the recipe's margin after the haircut, and its pace per hour of play
  margin_haircut?: number | null
  actions_per_hour?: number | null
  gp_hr?: number | null
}

// The lane allocation (GET /api/allocation): what each lane has earned over the
// window, and the weights that record would set. Log mode: no run uses them yet.
export interface YieldCounts {
  pitched: number
  vetoed: number
  closed: number
  survived_6h: number
  confirmed: number
  est_realized_gp: number
}

export interface LaneYield extends YieldCounts {
  lane: string
  // null: nothing closed
  per_ship_gp: number | null
  // null: below the sample gate
  target_weight: number | null
}

// a C recipe family's record; no weight follows from it yet
export interface FamilyYield extends YieldCounts {
  family: string
  kind: string
  per_ship_gp: number | null
}

export interface SignalKindYield {
  kind: string
  shipped: number
  linked: number
  dismissed: number
  expired: number
  withdrawn: number
}

export interface LaneAllocation {
  allocation_id: number
  computed_at: string
  mode: string
  window_days: number
  lanes: LaneYield[]
  families: FamilyYield[] | null
  signal_kinds: SignalKindYield[]
  weights: Record<string, number>
}

// One hourly read of the market (GET /api/regime). Each number is null until
// enough of the market has been seen, not zero.
export interface RegimeSnapshot {
  as_of: string
  flip_clear_floor: number | null
  flip_median_gp: number | null
  flip_persistence_median: number | null
  combo_clear_floor: number | null
  combo_median_gp: number | null
  volume_anomalies: number | null
  market_vol_ratio: number | null
}

// An idea the agent filed for Jade (GET /api/proposals). It can suggest, not
// ship: accepting records the call and changes nothing by itself. Every text
// field is model output, so it renders as plain text.
export type ProposalStatus = 'open' | 'accepted' | 'rejected'

export interface Proposal {
  proposal_id: number
  run_id: number
  created_at: string
  last_seen_at: string
  kind: string
  title: string
  detail: string
  evidence: string
  recipe?: {
    inputs?: { item_id: number; qty: number }[]
    outputs?: { item_id: number; qty: number }[]
    reversible?: boolean
  }
  // what the harness found when it priced the recipe; absent for a non-recipe
  recipe_check?: string
  times_proposed: number
  status: ProposalStatus
  decided_at?: string
  decision_note?: string
}

// gp renders an amount the way a player reads one: 1.2M, 470k, 987.
// Signed variant keeps the minus visible for P&L.
export function gp(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  const sign = v < 0 ? '-' : ''
  const a = Math.abs(v)
  if (a >= 1_000_000_000) return `${sign}${(a / 1e9).toFixed(1)}B`
  if (a >= 10_000_000) return `${sign}${(a / 1e6).toFixed(0)}M`
  if (a >= 1_000_000) return `${sign}${(a / 1e6).toFixed(1)}M`
  if (a >= 10_000) return `${sign}${(a / 1e3).toFixed(0)}k`
  return `${sign}${a.toFixed(0)}`
}

// Compact token count: 1234 -> "1.2k", 2_500_000 -> "2.5M". Null stays "—"
// (no cost record), never 0 — absence of measurement is not zero cost.
export function tokens(v: number | null | undefined): string {
  if (v == null) return '—'
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(v < 10_000 ? 1 : 0)}k`
  return String(v)
}

// Run duration from its timestamps; running/unknown stays "—".
export function duration(start: string, end: string | null | undefined): string {
  if (!end) return '—'
  const s = (new Date(end).getTime() - new Date(start).getTime()) / 1000
  if (s < 90) return `${Math.round(s)}s`
  return `${Math.round(s / 60)}m`
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 90) return `${Math.round(s)}s ago`
  if (s < 5400) return `${Math.round(s / 60)}m ago`
  if (s < 129600) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}
