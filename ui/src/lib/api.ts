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
  entry_text: string
  exit_text: string
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
  // live=1 extras
  live_checks?: Record<string, boolean>
  live_verdict?: string
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

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
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
  strategy: (id: number | string) =>
    get<{ strategy: Strategy; evaluations: Evaluation[] }>(`/api/strategies/${id}`),
  pnl: () => get<PnLResponse>('/api/pnl'),
  calibration: (days = 30) => get<CalibrationResponse>(`/api/calibration?days=${days}`),
  signals: (limit = 100) => get<Signal[]>(`/api/signals?limit=${limit}`),
  watchlist: () => get<WatchRow[]>('/api/watchlist'),
  briefPreview: () => get<{ brief_text: string }>('/api/brief/preview'),
  triggerRun: async () => {
    const res = await fetch('/api/runs', { method: 'POST', body: '{}' })
    if (res.status === 409) throw new Error('a run is already in progress')
    if (!res.ok) throw new Error(`trigger: ${res.status} ${await res.text()}`)
    return res.json() as Promise<{ run_id: number }>
  },
}

export interface Evaluation {
  at: string
  cur_high: number | null
  cur_low: number | null
  cur_margin: number | null
  realized_per_1h_gp: number | null
  verdict: 'healthy' | 'degraded' | 'kill_signal'
  checks: Record<string, boolean>
}

// gp renders an amount the way a player reads one: 1.2M, 470k, 987.
// Signed variant keeps the minus visible for P&L.
export function gp(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  const sign = v < 0 ? '-' : ''
  const a = Math.abs(v)
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
