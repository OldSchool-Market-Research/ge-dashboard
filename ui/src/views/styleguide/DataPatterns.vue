<script setup lang="ts">
import { computed, ref } from 'vue'
import DataTable from '@/components/data/DataTable.vue'
import FilterBar from '@/components/data/FilterBar.vue'
import SearchInput from '@/components/data/SearchInput.vue'
import type { DataTableColumn } from '@/components/data/types'
import StatusBadge from '@/components/project/StatusBadge.vue'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

const deploys = [
  { id: 'd-101', service: 'api', env: 'production', status: 'passing', duration: 142 },
  { id: 'd-102', service: 'web', env: 'production', status: 'passing', duration: 98 },
  { id: 'd-103', service: 'worker', env: 'staging', status: 'failing', duration: 210 },
  { id: 'd-104', service: 'api', env: 'staging', status: 'pending', duration: 65 },
  { id: 'd-105', service: 'web', env: 'preview', status: 'passing', duration: 74 },
  { id: 'd-106', service: 'cron', env: 'production', status: 'failing', duration: 33 },
  { id: 'd-107', service: 'api', env: 'preview', status: 'passing', duration: 121 },
  { id: 'd-108', service: 'web', env: 'staging', status: 'pending', duration: 87 },
  { id: 'd-109', service: 'worker', env: 'production', status: 'passing', duration: 190 },
  { id: 'd-110', service: 'cron', env: 'staging', status: 'passing', duration: 41 },
  { id: 'd-111', service: 'api', env: 'production', status: 'pending', duration: 156 },
  { id: 'd-112', service: 'web', env: 'production', status: 'passing', duration: 102 },
]

const columns: DataTableColumn[] = [
  { key: 'service', label: 'Service', sortable: true },
  { key: 'env', label: 'Environment', sortable: true, class: 'max-sm:hidden' },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'duration', label: 'Duration', sortable: true, align: 'right' },
]

const search = ref('')
const env = ref('all')
const loading = ref(false)

const filtered = computed(() =>
  deploys.filter(
    (d) =>
      (env.value === 'all' || d.env === env.value) &&
      d.service.toLowerCase().includes(search.value.trim().toLowerCase()),
  ),
)

const filtersActive = computed(() => search.value !== '' || env.value !== 'all')

function clearFilters() {
  search.value = ''
  env.value = 'all'
}
</script>

<template>
  <div class="space-y-3">
    <h3 class="text-sm font-medium text-muted-foreground">
      FilterBar + SearchInput + DataTable — sorting, pagination, filtering, loading, empty state
    </h3>
    <Card class="gap-4 p-5">
      <FilterBar :count="filtered.length" :active="filtersActive" @clear="clearFilters">
        <SearchInput v-model="search" placeholder="Search services…" />
        <Select v-model="env">
          <SelectTrigger class="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All envs</SelectItem>
            <SelectItem value="production">Production</SelectItem>
            <SelectItem value="staging">Staging</SelectItem>
            <SelectItem value="preview">Preview</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      <DataTable
        :columns="columns"
        :rows="filtered"
        row-key="id"
        :page-size="5"
        :loading="loading"
        empty-message="No deploys match those filters."
      >
        <template #cell-service="{ value }">
          <span class="font-medium">{{ value }}</span>
        </template>
        <template #cell-status="{ row }">
          <StatusBadge :status="row.status" />
        </template>
        <template #cell-duration="{ row }">
          <span class="tabular-nums">{{ row.duration }}s</span>
        </template>
      </DataTable>

      <div class="flex items-center gap-2 border-t pt-4">
        <Switch id="data-loading" v-model="loading" />
        <Label for="data-loading" class="text-xs text-muted-foreground">
          Toggle the loading skeletons
        </Label>
      </div>
    </Card>
  </div>
</template>
