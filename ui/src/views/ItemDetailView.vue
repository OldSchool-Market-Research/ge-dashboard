<script setup lang="ts">
// One GE item: latest prices and margin, its price and volume history, and
// the processing recipes it appears in (links into the Processing page).
import { Badge } from '@fisherrjd/ui/badge'
import { Button } from '@fisherrjd/ui/button'
import { Card, CardContent } from '@fisherrjd/ui/card'
import { PageHeader } from '@fisherrjd/ui/layout'
import { EmptyState, ErrorState } from '@fisherrjd/ui/states'
import { ArrowLeftIcon, ExternalLinkIcon, HistoryIcon } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import ItemIcon from '@/components/ItemIcon.vue'
import ItemPriceChart from '@/components/ItemPriceChart.vue'
import StatTile from '@/components/StatTile.vue'
import VolumeBars from '@/components/VolumeBars.vue'
import { api, errorText, gp, timeAgo, type ItemDetail, type ItemHistoryPoint } from '@/lib/api'

const route = useRoute()
const id = route.params.id as string

const item = ref<ItemDetail | null>(null)
const history = ref<ItemHistoryPoint[]>([])
const error = ref<string | null>(null)
const days = ref<1 | 7 | 30 | 90>(7)
// must match the orchestrator's bucket for each range (api/items.go)
const bucketMinutes = computed(() => ({ 1: 5, 7: 60, 30: 240, 90: 1440 })[days.value])

const volume = computed(() => (item.value ? item.value.high_vol_24h + item.value.low_vol_24h : 0))
const wikiUrl = computed(() =>
  item.value ? `https://oldschool.runescape.wiki/w/${encodeURIComponent(item.value.name.replace(/ /g, '_'))}` : '',
)

// only the latest range request may land
let seq = 0
async function loadHistory() {
  const mine = ++seq
  const pts = await api.itemHistory(id, days.value)
  if (mine === seq) history.value = pts
}

async function load() {
  error.value = null
  try {
    item.value = await api.item(id)
    await loadHistory()
  } catch (e) {
    error.value = errorText(e, 'There is no item with this id.')
  }
}

watch(days, () => loadHistory().catch((e) => (error.value = errorText(e))))
onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <Button variant="ghost" size="sm" as-child>
      <RouterLink to="/items"><ArrowLeftIcon class="size-4" /> Items</RouterLink>
    </Button>

    <ErrorState v-if="error" title="Couldn't load this item" :description="error" @retry="load" />

    <template v-else-if="item">
      <div class="flex items-center gap-3">
        <ItemIcon :icon="item.icon" />
        <PageHeader :title="item.name" :description="item.examine ?? ''" />
        <Badge v-if="item.members !== null" variant="outline" class="ml-auto">{{ item.members ? 'Members' : 'F2P' }}</Badge>
        <a :href="wikiUrl" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          Wiki <ExternalLinkIcon class="size-3" />
        </a>
      </div>

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Buy price (insta-buy)" :value="gp(item.high)" :hint="item.high_time ? timeAgo(item.high_time) : 'no trade in 14 days'" />
        <StatTile label="Sell price (insta-sell)" :value="gp(item.low)" :hint="item.low_time ? timeAgo(item.low_time) : 'no trade in 14 days'" />
        <StatTile
          label="Margin after tax"
          :value="gp(item.margin)"
          :signed="item.margin"
          :hint="item.roi_pct === null ? undefined : `${item.roi_pct.toFixed(2)}% ROI`"
        />
        <StatTile
          label="Per buy limit (4h)"
          :value="gp(item.limit_profit)"
          :hint="item.buy_limit ? `limit ${item.buy_limit.toLocaleString()}` : 'buy limit unknown'"
        />
        <StatTile label="24h volume" :value="volume.toLocaleString()" :hint="`${item.high_vol_24h.toLocaleString()} buys · ${item.low_vol_24h.toLocaleString()} sells`" />
        <StatTile label="High alch" :value="gp(item.highalch)" :hint="item.lowalch ? `low alch ${gp(item.lowalch)}` : undefined" />
        <StatTile label="Store value" :value="gp(item.value)" />
        <StatTile label="Processing recipes" :value="String(item.recipes.length)" hint="that use or make this item" />
      </div>

      <section>
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-sm font-medium">Price history</h2>
          <!-- filters in one row above the charts -->
          <div class="flex gap-1" role="group" aria-label="History range">
            <Button
              v-for="d in [1, 7, 30, 90] as const"
              :key="d"
              :variant="days === d ? 'secondary' : 'ghost'"
              size="sm"
              :aria-pressed="days === d"
              @click="days = d"
            >
              {{ d }}d
            </Button>
          </div>
        </div>
        <template v-if="history.some((p) => p.avg_high !== null || p.avg_low !== null)">
          <ItemPriceChart :points="history" :days="days" :bucket-minutes="bucketMinutes" />
          <h3 class="mb-1 mt-4 text-xs font-medium text-muted-foreground">Units traded</h3>
          <VolumeBars :points="history" :days="days" :bucket-minutes="bucketMinutes" />
        </template>
        <EmptyState v-else :icon="HistoryIcon" title="No trades in this range" description="Nothing traded on either side; try a longer range." />
      </section>

      <section v-if="item.recipes.length">
        <h2 class="mb-2 text-sm font-medium">Processing recipes</h2>
        <Card>
          <CardContent class="divide-y pt-2">
            <RouterLink
              v-for="r in item.recipes"
              :key="`${r.recipe_id}-${r.side}`"
              :to="`/process/${r.recipe_id}`"
              class="flex items-center justify-between gap-3 py-2 text-sm hover:underline"
            >
              <span class="min-w-0 truncate">
                <span class="font-medium">{{ r.name }}</span>
                <span class="ml-2 text-xs text-muted-foreground">{{ r.side === 'buy' ? 'uses it' : 'makes it' }} · {{ r.category }}</span>
              </span>
              <span class="shrink-0 tabular-nums">{{ r.gp_hr === null ? '—' : `${gp(r.gp_hr)}/hr` }}</span>
            </RouterLink>
          </CardContent>
        </Card>
      </section>
    </template>
  </div>
</template>
