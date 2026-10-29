<script setup lang="ts">
// Processing recipes: player-time money-makers ranked by live gp/hr, plus
// the consistent performers from the hourly snapshot history. All numbers
// come from the orchestrator's /api/process* (ge-data's process views);
// this page only filters and sorts. The Slow/Insta toggle switches every
// figure that has an insta counterpart; slow-only columns say so.
import { Badge } from '@fisherrjd/ui/badge'
import { Button } from '@fisherrjd/ui/button'
import { Input } from '@fisherrjd/ui/input'
import { PageHeader } from '@fisherrjd/ui/layout'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@fisherrjd/ui/select'
import { EmptyState, ErrorState } from '@fisherrjd/ui/states'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@fisherrjd/ui/table'
import { ArrowDownIcon, ArrowUpIcon, HistoryIcon } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import ItemIcon from '@/components/ItemIcon.vue'
import StatTile from '@/components/StatTile.vue'
import { api, errorText, gp, type ProcessQuote, type ProcessTopRow } from '@/lib/api'
import { activeTime, bindingRate, perWindow, throughputLabel } from '@/lib/process'

const router = useRouter()
const quotes = ref<ProcessQuote[] | null>(null)
const top = ref<ProcessTopRow[]>([])
const error = ref<string | null>(null)

const search = ref('')
const category = ref('all')
const basis = ref<'slow' | 'insta'>('slow')
const profitableOnly = ref(true)
type SortKey = 'gp_hr' | 'window' | 'margin' | 'theoretical' | 'rate'
const sortKey = ref<SortKey>('gp_hr')
const sortLabels: Record<SortKey, string> = {
  gp_hr: 'gp/hr',
  window: 'Per 4h window',
  margin: 'Margin/action',
  rate: 'Actions/hr',
  theoretical: 'Theoretical (slow)',
}

// the top table has no icons of its own: borrow them from the quote list
const iconById = computed(() => new Map((quotes.value ?? []).map((q) => [q.recipe_id, q.icon])))
const categories = computed(() => [...new Set((quotes.value ?? []).map((q) => q.category))].sort())

function gpHr(q: ProcessQuote) {
  return basis.value === 'slow' ? q.gp_hr : q.gp_hr_insta
}
function margin(q: ProcessQuote) {
  return basis.value === 'slow' ? q.margin_slow : q.margin_insta
}
function rate(q: ProcessQuote) {
  return basis.value === 'slow' ? q.effective_actions_per_hour : q.effective_actions_per_hour_insta
}
function missing(q: ProcessQuote) {
  return basis.value === 'slow' ? q.missing_legs : q.missing_legs_insta
}
// throughput=unknown has no rate, so no gp/hr: judge it on margin instead
// of letting a null gp/hr count as zero
function profitable(q: ProcessQuote) {
  const v = q.throughput === 'unknown' ? margin(q) : gpHr(q)
  return v !== null && v > 0
}
const sortValue: Record<SortKey, (q: ProcessQuote) => number | null> = {
  gp_hr: gpHr,
  window: (q) => perWindow(gpHr(q)),
  margin,
  theoretical: (q) => q.gp_hr_theoretical,
  rate,
}

const rows = computed(() => {
  const term = search.value.trim().toLowerCase()
  const key = sortValue[sortKey.value]
  return (quotes.value ?? [])
    .filter((q) => category.value === 'all' || q.category === category.value)
    .filter((q) => !term || q.name.toLowerCase().includes(term) || q.category.toLowerCase().includes(term))
    .filter((q) => !profitableOnly.value || profitable(q))
    // nulls (unpriceable now / no rate) sink to the bottom, never sort as zero
    .sort((a, b) => (key(b) ?? -Infinity) - (key(a) ?? -Infinity))
})

const priced = computed(() => (quotes.value ?? []).filter((q) => margin(q) !== null).length)
const positive = computed(() => (quotes.value ?? []).filter(profitable).length)
const best = computed(() =>
  [...(quotes.value ?? [])].filter((q) => gpHr(q) !== null).sort((a, b) => gpHr(b)! - gpHr(a)!)[0],
)

function age(s: number | null) {
  if (s === null) return '—'
  if (s < 3600) return `${Math.round(s / 60)}m`
  if (s < 172800) return `${Math.round(s / 3600)}h`
  return `${Math.round(s / 86400)}d`
}
function legs(n: number) {
  return `${n} leg${n === 1 ? '' : 's'} unpriced`
}

// last 24h vs the window average: a recipe that's rising or fading
function trend(r: ProcessTopRow): 'up' | 'down' | null {
  if (r.avg === null || r.avg_last_24h === null || r.avg === 0) return null
  const d = (r.avg_last_24h - r.avg) / Math.abs(r.avg)
  return d > 0.1 ? 'up' : d < -0.1 ? 'down' : null
}

// only the latest request may land: fast Slow/Insta toggles can resolve out of order
let topSeq = 0
async function loadTop() {
  const seq = ++topSeq
  const rows = await api.processTop(7, 15, basis.value === 'slow' ? 'gp_hr' : 'gp_hr_insta')
  if (seq === topSeq) top.value = rows
}

async function load() {
  error.value = null
  try {
    const [q] = await Promise.all([api.process(), loadTop()])
    quotes.value = q
  } catch (e) {
    error.value = errorText(e)
  }
}

watch(basis, () => loadTop().catch((e) => (error.value = errorText(e))))
onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Processing"
      description="Player-time money-makers ranked by live gp/hr: post-tax margins, rates capped by buy limits and market volume. Skill and quest requirements aren't checked."
    />

    <ErrorState
      v-if="error"
      title="Processing data unavailable"
      :description="error"
      @retry="load"
    />

    <template v-else-if="quotes">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile :label="`Best gp/hr now (${basis})`" :value="best ? gp(gpHr(best)) : '—'" :hint="best?.name" />
        <StatTile :label="`Profitable now (${basis})`" :value="String(positive)" :hint="`of ${quotes.length} recipes`" />
        <StatTile
          :label="`Priced (${basis})`"
          :value="`${priced}/${quotes.length}`"
          :hint="priced < quotes.length ? 'the rest have a leg nothing traded' : 'every leg of every recipe has a price'"
        />
        <StatTile label="Categories" :value="String(categories.length)" />
      </div>

      <section>
        <!-- filters in one row above the table -->
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <Input v-model="search" placeholder="Search recipes…" aria-label="Search recipes" class="h-8 w-56" />
          <Select v-model="category">
            <SelectTrigger class="h-8 w-56" aria-label="Category"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              <SelectItem v-for="c in categories" :key="c" :value="c">{{ c }}</SelectItem>
            </SelectContent>
          </Select>
          <div class="flex gap-1" role="group" aria-label="Price basis">
            <Button
              v-for="b in ['slow', 'insta'] as const"
              :key="b"
              :variant="basis === b ? 'secondary' : 'ghost'"
              size="sm"
              :aria-pressed="basis === b"
              @click="basis = b"
            >
              {{ b === 'slow' ? 'Slow' : 'Insta' }}
            </Button>
          </div>
          <Button
            :variant="profitableOnly ? 'secondary' : 'ghost'"
            size="sm"
            :aria-pressed="profitableOnly"
            @click="profitableOnly = !profitableOnly"
          >
            Profitable only
          </Button>
          <span class="ml-auto font-mono text-xs text-muted-foreground">{{ rows.length }} shown</span>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recipe</TableHead>
              <TableHead
                v-for="k in ['gp_hr', 'window', 'margin', 'rate', 'theoretical'] as const"
                :key="k"
                class="text-right"
                :aria-sort="sortKey === k ? 'descending' : 'none'"
              >
                <button
                  type="button"
                  class="inline-flex items-center gap-1 hover:text-foreground"
                  :title="k === 'theoretical' ? 'The sheet\'s figure: margin x player speed only, ignoring buy limits and market volume. Overstates thin markets.' : k === 'window' ? 'What one 4-hour GE buy-limit window yields (gp/hr x 4), and roughly how much clicking it takes at player speed' : undefined"
                  @click="sortKey = k"
                >
                  {{ sortLabels[k] }}<ArrowDownIcon v-if="sortKey === k" class="size-3" />
                </button>
              </TableHead>
              <TableHead class="text-right" title="Age of the oldest price used (slow side)">Price age (slow)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="q in rows"
              :key="q.recipe_id"
              class="cursor-pointer"
              @click="router.push(`/process/${q.recipe_id}`)"
            >
              <TableCell class="max-w-sm">
                <div class="flex items-center gap-2">
                  <ItemIcon :icon="q.icon" />
                  <div class="min-w-0">
                    <RouterLink :to="`/process/${q.recipe_id}`" class="block truncate font-medium hover:underline" @click.stop>
                      {{ q.name }}
                    </RouterLink>
                    <div class="truncate text-xs text-muted-foreground">{{ q.category }}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell class="text-right font-medium tabular-nums">
                {{ gp(gpHr(q)) }}
                <Badge v-if="q.throughput === 'unknown'" variant="outline" class="ml-1 text-[10px]">rate unknown</Badge>
              </TableCell>
              <TableCell class="text-right tabular-nums">
                {{ gp(perWindow(gpHr(q))) }}
                <div v-if="activeTime(q, basis)" class="text-xs text-muted-foreground">~{{ activeTime(q, basis) }} clicking</div>
              </TableCell>
              <TableCell class="text-right tabular-nums">
                {{ gp(margin(q)) }}
                <div v-if="missing(q) > 0" class="text-xs text-muted-foreground">{{ legs(missing(q)) }}</div>
              </TableCell>
              <TableCell class="text-right tabular-nums">
                {{ rate(q) === null ? '—' : rate(q)!.toLocaleString() }}
                <div class="text-xs text-muted-foreground">{{ bindingRate(q, basis) ?? throughputLabel[q.throughput] }}</div>
              </TableCell>
              <TableCell class="text-right tabular-nums text-muted-foreground">{{ gp(q.gp_hr_theoretical) }}</TableCell>
              <TableCell class="text-right font-mono text-xs text-muted-foreground">{{ age(q.max_leg_age_s) }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <EmptyState v-if="!rows.length" title="No recipes match" description="Loosen the filters or show all recipes." />
      </section>

      <section>
        <div class="mb-2">
          <h2 class="text-sm font-medium">Consistent performers, last 7 days ({{ basis }})</h2>
          <p class="mt-0.5 text-xs text-muted-foreground">
            From hourly snapshots, ranked by median gp/hr. A high p25 and % of hours positive near 100 means it pays reliably, not just in a spike.
          </p>
        </div>
        <EmptyState
          v-if="!top.length"
          :icon="HistoryIcon"
          title="No history yet"
          description="The ingester snapshots every recipe once an hour; this fills in after the first few hours."
        />
        <Table v-else>
          <TableHeader>
            <TableRow>
              <TableHead>Recipe</TableHead>
              <TableHead class="text-right">Median gp/hr</TableHead>
              <TableHead class="text-right">p25</TableHead>
              <TableHead class="text-right">Hours positive</TableHead>
              <TableHead class="text-right">Hours in top 10</TableHead>
              <TableHead class="text-right" title="Average over the last 24 hours; the arrow compares it with the 7-day average">Last 24h avg</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="r in top"
              :key="r.recipe_id"
              class="cursor-pointer"
              @click="router.push(`/process/${r.recipe_id}`)"
            >
              <TableCell class="max-w-sm">
                <div class="flex items-center gap-2">
                  <ItemIcon :icon="iconById.get(r.recipe_id)" />
                  <div class="min-w-0">
                    <RouterLink :to="`/process/${r.recipe_id}`" class="block truncate font-medium hover:underline" @click.stop>
                      {{ r.name }}
                    </RouterLink>
                    <div class="truncate text-xs text-muted-foreground">{{ r.category }}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell class="text-right font-medium tabular-nums">{{ gp(r.median) }}</TableCell>
              <TableCell class="text-right tabular-nums">{{ gp(r.p25) }}</TableCell>
              <TableCell class="text-right tabular-nums">
                {{ r.pct_hours_positive === null ? '—' : `${r.pct_hours_positive}%` }}
                <Badge v-if="r.metric_hours < r.hours" variant="outline" class="ml-1 text-[10px]">
                  {{ r.hours - r.metric_hours }}h unpriced
                </Badge>
              </TableCell>
              <TableCell class="text-right tabular-nums">{{ r.hours_in_top10 }} / {{ r.hours }}</TableCell>
              <TableCell class="text-right tabular-nums">
                <span class="inline-flex items-center gap-1">
                  {{ gp(r.avg_last_24h) }}
                  <ArrowUpIcon v-if="trend(r) === 'up'" class="size-3 text-success" aria-label="rising vs 7-day average" />
                  <ArrowDownIcon v-else-if="trend(r) === 'down'" class="size-3 text-destructive" aria-label="fading vs 7-day average" />
                </span>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </section>
    </template>
  </div>
</template>
