<script setup lang="ts" generic="T extends Record<string, unknown>">
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
} from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { DataTableColumn } from './types'

// client-side table: sorting via sortable columns, optional pagination
// via pageSize, skeletons via loading. customize any cell with a slot:
//   <template #cell-amount="{ row, value }">…</template>
const props = withDefaults(
  defineProps<{
    columns: DataTableColumn[]
    rows: T[]
    rowKey: keyof T & string
    pageSize?: number
    loading?: boolean
    emptyMessage?: string
  }>(),
  { emptyMessage: 'Nothing to show.' },
)

const sort = ref<{ key: string; dir: 'asc' | 'desc' } | null>(null)

function toggleSort(key: string) {
  sort.value =
    sort.value?.key !== key
      ? { key, dir: 'asc' }
      : sort.value.dir === 'asc'
        ? { key, dir: 'desc' }
        : null
}

function sortIcon(key: string) {
  if (sort.value?.key !== key) return ChevronsUpDownIcon
  return sort.value.dir === 'asc' ? ChevronUpIcon : ChevronDownIcon
}

const sorted = computed(() => {
  if (!sort.value) return props.rows
  const { key, dir } = sort.value
  return [...props.rows].sort((a, b) => {
    const av = a[key]
    const bv = b[key]
    const cmp =
      typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true })
    return dir === 'asc' ? cmp : -cmp
  })
})

const page = ref(0)
const pageCount = computed(() =>
  props.pageSize ? Math.max(1, Math.ceil(sorted.value.length / props.pageSize)) : 1,
)
watch([() => props.rows, () => props.pageSize], () => (page.value = 0))
watch(pageCount, (n) => {
  if (page.value >= n) page.value = n - 1
})

const visible = computed(() =>
  props.pageSize
    ? sorted.value.slice(page.value * props.pageSize, (page.value + 1) * props.pageSize)
    : sorted.value,
)

const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' }
</script>

<template>
  <div>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b text-xs text-muted-foreground">
            <th
              v-for="col in columns"
              :key="col.key"
              class="pb-2 font-medium"
              :class="[alignClass[col.align ?? 'left'], col.class]"
            >
              <button
                v-if="col.sortable"
                class="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                :class="sort?.key === col.key ? 'text-foreground' : ''"
                @click="toggleSort(col.key)"
              >
                {{ col.label }}
                <component :is="sortIcon(col.key)" class="size-3.5" />
              </button>
              <template v-else>{{ col.label }}</template>
            </th>
          </tr>
        </thead>

        <tbody v-if="loading">
          <tr v-for="i in pageSize ?? 3" :key="i" class="border-b last:border-0">
            <td v-for="col in columns" :key="col.key" class="py-3" :class="col.class">
              <Skeleton class="h-4 w-full max-w-24" />
            </td>
          </tr>
        </tbody>

        <tbody v-else-if="visible.length">
          <tr v-for="row in visible" :key="String(row[rowKey])" class="border-b last:border-0">
            <td
              v-for="col in columns"
              :key="col.key"
              class="py-3"
              :class="[alignClass[col.align ?? 'left'], col.class]"
            >
              <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
                {{ row[col.key] }}
              </slot>
            </td>
          </tr>
        </tbody>

        <tbody v-else>
          <tr>
            <td :colspan="columns.length" class="py-8 text-center text-muted-foreground">
              {{ emptyMessage }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="pageSize && pageCount > 1" class="mt-3 flex items-center justify-between">
      <p class="text-xs text-muted-foreground tabular-nums">
        Page {{ page + 1 }} of {{ pageCount }} · {{ sorted.length }} rows
      </p>
      <div class="flex gap-1">
        <Button
          variant="outline"
          size="icon"
          class="size-7"
          :disabled="page === 0"
          aria-label="Previous page"
          @click="page--"
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          variant="outline"
          size="icon"
          class="size-7"
          :disabled="page >= pageCount - 1"
          aria-label="Next page"
          @click="page++"
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  </div>
</template>
