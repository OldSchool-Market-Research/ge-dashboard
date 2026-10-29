<script setup lang="ts">
// Item lookup: every GE item with its latest insta-buy/sell prices, the
// ingester's post-tax margin, ROI, buy limit and 24h volume, searchable and
// sortable (a prices.runescape.wiki-style browser over our own data). One
// fetch of the whole list; filtering, sorting and paging happen here.
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
import { ArrowDownIcon, ArrowUpIcon } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import ItemIcon from '@/components/ItemIcon.vue'
import { api, errorText, gp, timeAgo, type ItemRow } from '@/lib/api'

const router = useRouter()
const items = ref<ItemRow[] | null>(null)
const error = ref<string | null>(null)

const search = ref('')
const membership = ref<'all' | 'members' | 'f2p'>('all')
const minVolume = ref(0)
type SortKey = 'name' | 'high' | 'low' | 'margin' | 'roi' | 'volume' | 'limit' | 'limit_profit'
const sortKey = ref<SortKey>('volume')
const sortDir = ref<'desc' | 'asc'>('desc')
const PAGE = 50
const shown = ref(PAGE)

const columns: { key: SortKey; label: string; title?: string }[] = [
  { key: 'high', label: 'Buy price', title: 'Latest insta-buy price (what you pay to buy now)' },
  { key: 'low', label: 'Sell price', title: 'Latest insta-sell price (what you get selling now)' },
  { key: 'margin', label: 'Margin', title: 'Flip margin after GE tax: buy at the sell price, sell at the buy price' },
  { key: 'roi', label: 'ROI' },
  { key: 'volume', label: '24h volume' },
  { key: 'limit', label: 'Buy limit' },
  { key: 'limit_profit', label: 'Limit profit', title: 'Margin x buy limit: one 4-hour buy-limit window at the current margin' },
]

const volume = (r: ItemRow) => r.high_vol_24h + r.low_vol_24h
const sortValue: Record<SortKey, (r: ItemRow) => number | string | null> = {
  name: (r) => r.name.toLowerCase(),
  high: (r) => r.high,
  low: (r) => r.low,
  margin: (r) => r.margin,
  roi: (r) => r.roi_pct,
  volume,
  limit: (r) => r.buy_limit,
  limit_profit: (r) => r.limit_profit,
}

const rows = computed(() => {
  const term = search.value.trim().toLowerCase()
  const key = sortValue[sortKey.value]
  const dir = sortDir.value === 'desc' ? -1 : 1
  return (items.value ?? [])
    .filter((r) => !term || r.name.toLowerCase().includes(term))
    // unknown membership (null) matches neither Members nor F2P
    .filter((r) => membership.value === 'all' || (membership.value === 'members' ? r.members === true : r.members === false))
    .filter((r) => volume(r) >= minVolume.value)
    .sort((a, b) => {
      const va = key(a)
      const vb = key(b)
      // nulls (nothing traded recently) always sink, whichever direction
      if (va === null && vb === null) return 0
      if (va === null) return 1
      if (vb === null) return -1
      return (va < vb ? -1 : va > vb ? 1 : 0) * dir
    })
})

function setSort(k: SortKey) {
  if (sortKey.value === k) sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
  else {
    sortKey.value = k
    sortDir.value = k === 'name' ? 'asc' : 'desc'
  }
}

watch([search, membership, minVolume, sortKey, sortDir], () => (shown.value = PAGE))

async function load() {
  error.value = null
  try {
    items.value = await api.items()
  } catch (e) {
    error.value = errorText(e)
  }
}
onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Items"
      description="Every GE item: latest insta-buy and insta-sell prices, post-tax flip margin and 24h volume, refreshed every minute."
    />

    <ErrorState v-if="error" title="Item data unavailable" :description="error" @retry="load" />

    <section v-else-if="items">
      <!-- filters in one row above the table -->
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <Input v-model="search" placeholder="Search items…" aria-label="Search items" class="h-8 w-64" />
        <div class="flex gap-1" role="group" aria-label="Membership">
          <Button
            v-for="m in ['all', 'members', 'f2p'] as const"
            :key="m"
            :variant="membership === m ? 'secondary' : 'ghost'"
            size="sm"
            :aria-pressed="membership === m"
            @click="membership = m"
          >
            {{ m === 'all' ? 'All' : m === 'members' ? 'Members' : 'F2P' }}
          </Button>
        </div>
        <div class="flex items-center gap-1" role="group" aria-label="Minimum 24h volume">
          <span class="text-xs text-muted-foreground">Min volume</span>
          <Button
            v-for="v in [0, 100, 1000, 10000]"
            :key="v"
            :variant="minVolume === v ? 'secondary' : 'ghost'"
            size="sm"
            :aria-pressed="minVolume === v"
            @click="minVolume = v"
          >
            {{ v === 0 ? 'any' : gp(v) }}
          </Button>
        </div>
        <span class="ml-auto font-mono text-xs text-muted-foreground">{{ rows.length.toLocaleString() }} items</span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead :aria-sort="sortKey === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'">
              <button type="button" class="inline-flex items-center gap-1 hover:text-foreground" @click="setSort('name')">
                Item
                <ArrowDownIcon v-if="sortKey === 'name' && sortDir === 'desc'" class="size-3" />
                <ArrowUpIcon v-else-if="sortKey === 'name'" class="size-3" />
              </button>
            </TableHead>
            <TableHead
              v-for="c in columns"
              :key="c.key"
              class="text-right"
              :aria-sort="sortKey === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'"
            >
              <button type="button" class="inline-flex items-center gap-1 hover:text-foreground" :title="c.title" @click="setSort(c.key)">
                {{ c.label }}
                <ArrowDownIcon v-if="sortKey === c.key && sortDir === 'desc'" class="size-3" />
                <ArrowUpIcon v-else-if="sortKey === c.key" class="size-3" />
              </button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="r in rows.slice(0, shown)" :key="r.item_id" class="cursor-pointer" @click="router.push(`/items/${r.item_id}`)">
            <TableCell class="max-w-xs">
              <div class="flex items-center gap-2">
                <ItemIcon :icon="r.icon" />
                <div class="min-w-0">
                  <RouterLink :to="`/items/${r.item_id}`" class="block truncate font-medium hover:underline" @click.stop>
                    {{ r.name }}
                  </RouterLink>
                  <div v-if="r.members !== null" class="text-xs text-muted-foreground">{{ r.members ? 'Members' : 'F2P' }}</div>
                </div>
              </div>
            </TableCell>
            <TableCell class="text-right tabular-nums">
              {{ gp(r.high) }}
              <div class="text-xs text-muted-foreground">{{ r.high_time ? timeAgo(r.high_time) : 'no trade' }}</div>
            </TableCell>
            <TableCell class="text-right tabular-nums">
              {{ gp(r.low) }}
              <div class="text-xs text-muted-foreground">{{ r.low_time ? timeAgo(r.low_time) : 'no trade' }}</div>
            </TableCell>
            <TableCell class="text-right font-medium tabular-nums">{{ gp(r.margin) }}</TableCell>
            <TableCell class="text-right tabular-nums">{{ r.roi_pct === null ? '—' : `${r.roi_pct.toFixed(1)}%` }}</TableCell>
            <TableCell class="text-right tabular-nums">{{ volume(r).toLocaleString() }}</TableCell>
            <TableCell class="text-right tabular-nums">{{ r.buy_limit?.toLocaleString() ?? '—' }}</TableCell>
            <TableCell class="text-right tabular-nums">{{ gp(r.limit_profit) }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <EmptyState v-if="!rows.length" title="No items match" description="Try a shorter search or loosen the filters." />
      <Button v-if="rows.length > shown" variant="ghost" size="sm" class="mt-2" @click="shown += PAGE * 2">
        show more ({{ (rows.length - shown).toLocaleString() }} left)
      </Button>
    </section>
  </div>
</template>
