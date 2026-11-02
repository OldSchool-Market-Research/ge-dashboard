// The time window the "how is it going" pages share: pick 3d on Run health and
// Outcomes and Performance follow. Kept in this browser only; the pages work the
// same without storage. Plus paper gp over a window: a strategy's result spread
// evenly across the hours it traded, so a 48h strategy closing today doesn't
// land all at once, and one still running counts for what it has done so far.
import { computed, ref } from 'vue'

export interface TimeWindow {
  key: string
  label: string
  hours: number | null // null: everything on record
  bucketHours: number // chart resolution
  long: string // "last 24 hours"
  before: string | null // "the 24 hours before"
}

export const WINDOWS: TimeWindow[] = [
  { key: '24h', label: '24h', hours: 24, bucketHours: 1, long: 'last 24 hours', before: 'the 24 hours before' },
  { key: '3d', label: '3d', hours: 72, bucketHours: 3, long: 'last 3 days', before: 'the 3 days before' },
  { key: '7d', label: '7d', hours: 168, bucketHours: 6, long: 'last 7 days', before: 'the 7 days before' },
  { key: '30d', label: '30d', hours: 720, bucketHours: 24, long: 'last 30 days', before: 'the 30 days before' },
  { key: '90d', label: '90d', hours: 2160, bucketHours: 24, long: 'last 90 days', before: 'the 90 days before' },
  { key: 'all', label: 'All', hours: null, bucketHours: 24, long: 'all time', before: null },
]

const STORAGE_KEY = 'ge-window'

function readKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? WINDOWS[0].key
  } catch {
    return WINDOWS[0].key
  }
}

const key = ref(readKey())

export function useTimeWindow() {
  const win = computed(() => WINDOWS.find((w) => w.key === key.value) ?? WINDOWS[0])
  function set(k: string) {
    key.value = k
    try {
      localStorage.setItem(STORAGE_KEY, k)
    } catch {
      // storage blocked: the choice still holds for this visit
    }
  }
  return { win, set }
}

const HOUR = 3600_000

// the fields a paper result needs; PnLRow and Outcome both have them
export interface Accruing {
  est_realized_gp: number | null
  hours: number
  closed_at?: string | null
}

function spanOf(r: Accruing, asOf: number): [start: number, end: number] {
  const end = r.closed_at ? Date.parse(r.closed_at) : asOf
  return [end - r.hours * HOUR, end]
}

// the share of a strategy's paper result that falls inside [from, to)
export function accrued(r: Accruing, asOf: number, from: number, to: number): number {
  if (r.est_realized_gp === null || r.hours <= 0) return 0
  const [start, end] = spanOf(r, asOf)
  const overlap = Math.min(end, to) - Math.max(start, from)
  return overlap > 0 ? (r.est_realized_gp * overlap) / (end - start) : 0
}

export function earnedIn(rows: Accruing[], asOf: number, from: number, to: number): number {
  return rows.reduce((sum, r) => sum + accrued(r, asOf, from, to), 0)
}

// when the oldest strategy started trading: where "all time" begins
export function firstStart(rows: Accruing[], asOf: number): number {
  const starts = rows.filter((r) => r.est_realized_gp !== null && r.hours > 0).map((r) => spanOf(r, asOf)[0])
  return starts.length ? Math.min(...starts) : asOf
}

export interface Bucket {
  t: number // bucket start
  gp: number
  alive: number // strategies trading in it
}

// paper gp per bucket from `from` to asOf, buckets aligned to UTC multiples of
// bucketHours (so day buckets are UTC days); the first and last can be partial
export function accrualBuckets(rows: Accruing[], asOf: number, from: number, bucketHours: number): Bucket[] {
  const size = bucketHours * HOUR
  const live = rows.filter((r) => r.est_realized_gp !== null && r.hours > 0)
  const out: Bucket[] = []
  for (let t = Math.floor(from / size) * size; t < asOf; t += size) {
    const lo = Math.max(t, from)
    const hi = Math.min(t + size, asOf)
    let gp = 0
    let alive = 0
    for (const r of live) {
      const [start, end] = spanOf(r, asOf)
      if (Math.min(end, hi) > Math.max(start, lo)) {
        gp += accrued(r, asOf, lo, hi)
        alive++
      }
    }
    out.push({ t, gp, alive })
  }
  return out
}

// When the evaluator's measure of a lane changed. Paper gp on either side of a
// cut isn't comparable, so a window (or its comparison) that crosses one says so.
const MEASURE_CUTS = [
  {
    at: Date.parse('2026-10-30T18:44:00Z'),
    note: "Lane C's measure changed on Oct 30: pace now reads real 4h volume instead of 30 minutes × 8, and fewer checks read zero. Its gp before and after that isn't comparable.",
  },
]

export function measureNotes(from: number, to: number): string[] {
  return MEASURE_CUTS.filter((c) => c.at >= from && c.at <= to).map((c) => c.note)
}

export const FOLLOW_ALL_NOTE = 'Adding these up assumes every strategy was followed at once, with all their capital and check-ins.'
