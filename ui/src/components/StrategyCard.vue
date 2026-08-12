<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { gp, timeAgo, type Strategy } from '@/lib/api'

const props = defineProps<{ strategy: Strategy }>()

const s = computed(() => props.strategy)
const itemName = computed(() => s.value.items?.[0]?.name ?? s.value.sid)
// live checks, failing first so problems lead
const checks = computed(() =>
  Object.entries(s.value.live_checks ?? {}).sort(([, a], [, b]) => Number(a) - Number(b)),
)
</script>

<template>
  <Card>
    <CardHeader class="pb-2">
      <div class="flex items-start justify-between gap-2">
        <CardTitle class="text-base leading-tight">
          <Badge variant="outline" class="mr-1.5 align-middle font-mono">{{ s.archetype }}</Badge>
          {{ itemName }}
        </CardTitle>
        <StatusBadge :state="s.live_verdict ?? s.state" />
      </div>
      <p class="text-xs text-muted-foreground">{{ s.title }}</p>
    </CardHeader>
    <CardContent class="space-y-2 text-sm">
      <div class="grid grid-cols-3 gap-2 tabular-nums">
        <div>
          <div class="text-xs text-muted-foreground">buy → sell</div>
          {{ s.entry_price.toLocaleString() }} → {{ s.exit_price.toLocaleString() }}
        </div>
        <div>
          <div class="text-xs text-muted-foreground">capital</div>
          {{ gp(s.capital_required) }}
        </div>
        <div>
          <div class="text-xs text-muted-foreground">
            {{ s.projected_per_1h_gp !== null ? 'harness gp/hr' : 'claim gp/hr' }}
          </div>
          {{ gp(s.projected_per_1h_gp ?? s.per_1h_gp) }}
        </div>
      </div>
      <div v-if="s.attention" class="text-xs text-muted-foreground">
        <span class="font-medium text-foreground">attention:</span> {{ s.attention }}
      </div>
      <div v-if="checks.length" class="flex flex-wrap gap-1">
        <TooltipProvider v-for="[name, ok] in checks" :key="name" :delay-duration="150">
          <Tooltip>
            <TooltipTrigger as-child>
              <span
                class="rounded px-1.5 py-0.5 font-mono text-[10px]"
                :class="ok ? 'bg-muted text-muted-foreground' : 'bg-destructive/15 font-semibold text-destructive'"
              >
                {{ ok ? name : `✗ ${name}` }}
              </span>
            </TooltipTrigger>
            <TooltipContent>{{ name }}: {{ ok ? 'passing' : 'FAILING' }} (live)</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div class="flex items-center justify-between text-xs text-muted-foreground">
        <span class="font-mono">{{ s.sid }}</span>
        <span>opened {{ timeAgo(s.opened_at) }}</span>
      </div>
      <p v-if="s.state_reason && s.state !== 'open'" class="text-xs text-muted-foreground">
        {{ s.state_reason }}
      </p>
    </CardContent>
  </Card>
</template>
