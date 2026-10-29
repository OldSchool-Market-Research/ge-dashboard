<script setup lang="ts">
// A strategy's legs as item icons: what you buy (x qty, live price) -> what
// you sell. Names are on hover and in the alt-free title; `large` adds them
// under each icon for the detail page.
import { ArrowRightIcon } from '@lucide/vue'
import { computed } from 'vue'
import ItemIcon from '@/components/ItemIcon.vue'
import { gp } from '@/lib/api'
import type { LegView } from '@/lib/strategy'

const props = defineProps<{ legs: LegView[]; large?: boolean }>()

const buys = computed(() => props.legs.filter((l) => l.side === 'buy'))
const sells = computed(() => props.legs.filter((l) => l.side === 'sell'))
</script>

<template>
  <div class="flex flex-wrap items-start gap-1.5">
    <template v-for="(group, gi) in [buys, sells]" :key="gi">
      <div
        v-if="gi === 1"
        class="flex items-center self-stretch text-primary-text"
        :class="large ? 'px-2' : 'px-0.5'"
        aria-hidden="true"
      >
        <ArrowRightIcon :class="large ? 'size-6' : 'size-4'" />
      </div>
      <div
        v-for="l in group"
        :key="`${l.side}:${l.item_id}`"
        class="flex flex-col items-center gap-1"
        :class="large ? 'w-24' : 'w-14'"
        :title="`${l.side === 'buy' ? 'Buy' : 'Sell'} ${l.qty} × ${l.name}`"
      >
        <div
          class="relative flex items-center justify-center border bg-muted/40"
          :class="[large ? 'size-16' : 'size-11', l.side === 'sell' ? 'border-primary' : '']"
        >
          <ItemIcon :icon="l.icon" />
          <span v-if="l.qty !== 1" class="absolute right-0.5 bottom-0 font-mono text-[11px] tabular-nums">×{{ l.qty }}</span>
        </div>
        <span v-if="large" class="line-clamp-2 text-center text-xs text-muted-foreground">{{ l.name }}</span>
        <span class="font-mono text-[11px] tabular-nums" :class="l.side === 'sell' ? 'text-primary-text' : 'text-muted-foreground'">
          {{ gp(l.price) }}
        </span>
      </div>
    </template>
  </div>
</template>
