<script setup lang="ts">
import { RefreshCwIcon } from '@lucide/vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import PageHeader from '@/components/PageHeader.vue'
import StatTile from '@/components/StatTile.vue'
import StrategyCard from '@/components/StrategyCard.vue'
import { Button } from '@/components/ui/button'
import { api, gp, type Strategy } from '@/lib/api'

const book = ref<Strategy[]>([])
const loading = ref(true)

const committed = computed(() =>
  book.value.reduce((sum, s) => sum + (s.capital_required ?? 0), 0),
)

async function load() {
  try {
    book.value = await api.openBook()
  } catch (e) {
    toast.error(String(e))
  } finally {
    loading.value = false
  }
}

let timer: ReturnType<typeof setInterval>
onMounted(() => {
  load()
  timer = setInterval(load, 60_000)
})
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Open book" description="Live positions with their current check state — what the paper trader is holding right now.">
      <template #actions>
        <Button variant="outline" size="sm" @click="load"><RefreshCwIcon /> Refresh</Button>
      </template>
    </PageHeader>

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <StatTile label="Positions" :value="String(book.length)" hint="open + armed" />
      <StatTile label="Capital committed" :value="gp(committed)" />
      <StatTile
        label="Failing live"
        :value="String(book.filter((s) => s.live_verdict === 'kill_signal').length)"
        hint="kill_signal this tick"
      />
    </div>

    <div class="grid gap-3 md:grid-cols-2">
      <StrategyCard v-for="s in book" :key="s.strategy_id" :strategy="s" />
    </div>
    <p v-if="!loading && book.length === 0" class="text-sm text-muted-foreground">
      book is empty — the next run fills free slots
    </p>
  </div>
</template>
