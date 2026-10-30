<script setup lang="ts">
// What the research engine has learned and what it wants to try. Proposals are
// the agent's ideas waiting on Jade; the lane tables are the record its weights
// would come from. All of it is read-only except the call on a proposal, and a
// call only records the decision: adding a recipe or a lane stays a code change.
import { Badge } from '@fisherrjd/ui/badge'
import { Button } from '@fisherrjd/ui/button'
import { Input } from '@fisherrjd/ui/input'
import { PageHeader } from '@fisherrjd/ui/layout'
import { EmptyState, ErrorState } from '@fisherrjd/ui/states'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@fisherrjd/ui/table'
import { computed, onMounted, reactive, ref } from 'vue'
import { toast } from 'vue-sonner'
import StatTile from '@/components/StatTile.vue'
import {
  api,
  errorText,
  gp,
  timeAgo,
  type LaneAllocation,
  type Proposal,
  type ProposalStatus,
  type RegimeSnapshot,
} from '@/lib/api'

const allocation = ref<LaneAllocation | null>(null)
const regime = ref<RegimeSnapshot | null>(null)
const proposals = ref<Proposal[]>([])
const error = ref('')
const loaded = ref(false)
// the note typed against each proposal, kept until its decision lands
const notes = reactive<Record<number, string>>({})
const deciding = ref<number | null>(null)

const open = computed(() => proposals.value.filter((p) => p.status === 'open'))
const decided = computed(() => proposals.value.filter((p) => p.status !== 'open'))

const families = computed(() =>
  [...(allocation.value?.families ?? [])].sort((a, b) => b.est_realized_gp - a.est_realized_gp),
)

function weight(v: number | null | undefined): string {
  return v == null ? '—' : v.toFixed(2)
}

// a share of closes; nothing closed has no rate, which is not 0%
function rate(n: number, of: number): string {
  return of > 0 ? `${Math.round((n / of) * 100)}%` : '—'
}

const KIND_LABEL: Record<string, string> = {
  recipe: 'New recipe',
  lane: 'New lane',
  method: 'Method change',
  tool: 'New tool',
}

async function decide(p: Proposal, status: ProposalStatus) {
  deciding.value = p.proposal_id
  const note = notes[p.proposal_id]?.trim() ?? ''
  try {
    await api.decideProposal(p.proposal_id, status, note)
    p.status = status
    p.decision_note = status === 'open' ? undefined : note || undefined
    p.decided_at = status === 'open' ? undefined : new Date().toISOString()
    delete notes[p.proposal_id]
  } catch (e) {
    toast.error(errorText(e, 'That proposal no longer exists.'))
  } finally {
    deciding.value = null
  }
}

onMounted(async () => {
  try {
    const [a, r, p] = await Promise.all([api.allocation(), api.regime(1), api.proposals()])
    allocation.value = a.latest
    regime.value = r.at(-1) ?? null
    proposals.value = p
  } catch (e) {
    error.value = errorText(e)
  } finally {
    loaded.value = true
  }
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Research"
      description="What the agent wants to try, and the record its lane weights would come from."
    />

    <ErrorState v-if="error" title="Research data unavailable" :description="error" />

    <template v-else-if="loaded">
      <section class="space-y-3">
        <h2 class="text-sm font-medium">Proposals waiting on you ({{ open.length }})</h2>
        <p class="max-w-2xl text-sm text-muted-foreground">
          The agent can suggest a recipe, lane, method or tool here, but can't ship one. Accepting records your call. The
          change itself still has to be built.
        </p>
        <EmptyState
          v-if="!open.length"
          title="Nothing waiting"
          description="A run files a proposal when it finds something the current lanes and recipes can't express."
        />
        <article v-for="p in open" :key="p.proposal_id" class="space-y-3 rounded-md border bg-card p-4">
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline">{{ KIND_LABEL[p.kind] ?? p.kind }}</Badge>
            <span class="font-mono text-muted-foreground">
              run {{ p.run_id }} · {{ timeAgo(p.last_seen_at) }}
              <template v-if="p.times_proposed > 1"> · proposed {{ p.times_proposed }} times</template>
            </span>
          </div>
          <h3 class="font-medium">{{ p.title }}</h3>
          <p class="max-w-3xl text-sm whitespace-pre-wrap">{{ p.detail }}</p>
          <p class="max-w-3xl text-sm text-muted-foreground whitespace-pre-wrap">
            <strong class="font-medium text-foreground">Agent's evidence:</strong> {{ p.evidence }}
          </p>
          <p v-if="p.recipe_check" class="max-w-3xl text-sm text-muted-foreground">
            <strong class="font-medium text-foreground">Harness check:</strong> {{ p.recipe_check }}
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <Input
              v-model="notes[p.proposal_id]"
              class="max-w-sm"
              :aria-label="`Note on proposal ${p.proposal_id}`"
              placeholder="Note (optional)"
            />
            <Button size="sm" :disabled="deciding === p.proposal_id" @click="decide(p, 'accepted')">Accept</Button>
            <Button size="sm" variant="outline" :disabled="deciding === p.proposal_id" @click="decide(p, 'rejected')">
              Reject
            </Button>
          </div>
        </article>
      </section>

      <section v-if="decided.length">
        <h2 class="mb-2 text-sm font-medium">Decided</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Decision</TableHead>
              <TableHead>Proposal</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>When</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="p in decided" :key="p.proposal_id">
              <TableCell class="capitalize">{{ p.status }}</TableCell>
              <TableCell class="font-medium">{{ p.title }}</TableCell>
              <TableCell class="text-muted-foreground">{{ p.decision_note ?? '—' }}</TableCell>
              <TableCell class="text-muted-foreground">{{ timeAgo(p.decided_at) }}</TableCell>
              <TableCell class="text-right">
                <Button size="sm" variant="ghost" :disabled="deciding === p.proposal_id" @click="decide(p, 'open')">
                  Reopen
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </section>

      <section v-if="regime" class="space-y-2">
        <h2 class="text-sm font-medium">Market conditions</h2>
        <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Flip persistence"
            :value="regime.flip_persistence_median == null ? '—' : `${Math.round(regime.flip_persistence_median * 100)}%`"
            hint="share of 24h a flip's margin held, median"
          />
          <StatTile label="Flip median" :value="gp(regime.flip_median_gp)" hint="per 4h batch, all flips scanned" />
          <StatTile label="Combine median" :value="gp(regime.combo_median_gp)" hint="per 4h batch, all combines scanned" />
          <StatTile
            label="Market volume"
            :value="regime.market_vol_ratio == null ? '—' : `${regime.market_vol_ratio.toFixed(2)}×`"
            hint="last hour against the 7-day hourly average"
          />
        </div>
        <p class="text-xs text-muted-foreground">Read {{ timeAgo(regime.as_of) }}.</p>
      </section>

      <section v-if="allocation" class="space-y-2">
        <h2 class="text-sm font-medium">Lanes, last {{ allocation.window_days }} days</h2>
        <p class="max-w-2xl text-sm text-muted-foreground">
          Log only: no run uses these weights yet. They show what this record would ask for, so the rule can be checked
          before it steers anything. Processing is judged per hour of play, so it has no gp per ship.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lane</TableHead>
              <TableHead class="text-right">Closed</TableHead>
              <TableHead class="text-right">Alive at 6h</TableHead>
              <TableHead class="text-right">Confirmed</TableHead>
              <TableHead class="text-right">Gp per ship</TableHead>
              <TableHead class="text-right">Earned weight</TableHead>
              <TableHead class="text-right">Proposed weight</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="l in allocation.lanes" :key="l.lane">
              <TableCell class="font-mono">{{ l.lane }}</TableCell>
              <TableCell class="text-right tabular-nums">{{ l.closed }}</TableCell>
              <TableCell class="text-right tabular-nums">{{ rate(l.survived_6h, l.closed) }}</TableCell>
              <TableCell class="text-right tabular-nums">{{ l.confirmed }}</TableCell>
              <TableCell class="text-right tabular-nums">{{ gp(l.per_ship_gp) }}</TableCell>
              <TableCell class="text-right tabular-nums">{{ weight(l.target_weight) }}</TableCell>
              <TableCell class="text-right tabular-nums">{{ weight(allocation.weights[l.lane]) }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </section>

      <section v-if="families.length" class="space-y-2">
        <h2 class="text-sm font-medium">Combine families, last {{ allocation?.window_days }} days</h2>
        <p class="max-w-2xl text-sm text-muted-foreground">
          A record only. Most families are still far under the 20 closes a lane needs before its weight moves.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Family</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead class="text-right">Closed</TableHead>
              <TableHead class="text-right">Alive at 6h</TableHead>
              <TableHead class="text-right">Estimated gp</TableHead>
              <TableHead class="text-right">Gp per ship</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="f in families" :key="`${f.kind}:${f.family}`">
              <TableCell class="font-medium capitalize">{{ f.family }}</TableCell>
              <TableCell class="text-muted-foreground">{{ f.kind }}</TableCell>
              <TableCell class="text-right tabular-nums">{{ f.closed }}</TableCell>
              <TableCell class="text-right tabular-nums">{{ rate(f.survived_6h, f.closed) }}</TableCell>
              <TableCell class="text-right tabular-nums">{{ gp(f.est_realized_gp) }}</TableCell>
              <TableCell class="text-right tabular-nums">{{ gp(f.per_ship_gp) }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </section>

      <section v-if="allocation?.signal_kinds?.length" class="space-y-2">
        <h2 class="text-sm font-medium">What became of each signal kind</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kind</TableHead>
              <TableHead class="text-right">Shipped</TableHead>
              <TableHead class="text-right">Linked</TableHead>
              <TableHead class="text-right">Dismissed</TableHead>
              <TableHead class="text-right">Expired</TableHead>
              <TableHead class="text-right">Withdrawn</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="k in allocation.signal_kinds" :key="k.kind">
              <TableCell class="font-mono">{{ k.kind }}</TableCell>
              <TableCell class="text-right tabular-nums">{{ k.shipped }}</TableCell>
              <TableCell class="text-right tabular-nums">{{ k.linked }}</TableCell>
              <TableCell class="text-right tabular-nums">{{ k.dismissed }}</TableCell>
              <TableCell class="text-right tabular-nums">{{ k.expired }}</TableCell>
              <TableCell class="text-right tabular-nums">{{ k.withdrawn }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </section>
    </template>
  </div>
</template>
