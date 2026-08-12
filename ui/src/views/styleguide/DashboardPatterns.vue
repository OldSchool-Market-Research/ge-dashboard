<script setup lang="ts">
import { CreditCardIcon, DollarSignIcon, UserPlusIcon, UsersIcon, ZapIcon } from '@lucide/vue'
import PageHeader from '@/components/PageHeader.vue'
import ActivityFeed from '@/components/dashboard/ActivityFeed.vue'
import BarChart from '@/components/dashboard/BarChart.vue'
import ProgressMeter from '@/components/dashboard/ProgressMeter.vue'
import Sparkline from '@/components/dashboard/Sparkline.vue'
import StatCard from '@/components/dashboard/StatCard.vue'
import UserAvatar from '@/components/dashboard/UserAvatar.vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const trend = [12, 18, 14, 22, 20, 28, 26, 34]
const dip = [30, 26, 28, 22, 24, 18, 20, 14]

const sampleActivity = [
  { id: 1, title: 'New signup', description: 'ana@acme.dev joined', time: '2m', icon: UserPlusIcon },
  { id: 2, title: 'Payment received', description: '$1,240.00', time: '18m', icon: CreditCardIcon },
  { id: 3, title: 'Deploy finished', description: 'v2.4.1 in production', time: '1h', icon: ZapIcon },
]

const bars = [
  { label: 'Mon', value: 32 },
  { label: 'Tue', value: 41 },
  { label: 'Wed', value: 28 },
  { label: 'Thu', value: 52 },
  { label: 'Fri', value: 46 },
]
</script>

<template>
  <div class="space-y-8">
    <div class="space-y-3">
      <h3 class="text-sm font-medium text-muted-foreground">
        PageHeader — title, description, actions slot
      </h3>
      <Card class="p-5">
        <PageHeader title="Page title" description="One-line description of the page.">
          <template #actions>
            <Button size="sm" variant="outline">Secondary</Button>
            <Button size="sm">Primary</Button>
          </template>
        </PageHeader>
      </Card>
    </div>

    <div class="space-y-3">
      <h3 class="text-sm font-medium text-muted-foreground">
        StatCard — animated value, delta trend, sparkline
      </h3>
      <div class="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Revenue"
          :value="24830"
          :delta="12.4"
          :data="trend"
          :format="(n) => `$${Math.round(n).toLocaleString('en-US')}`"
          :icon="DollarSignIcon"
        />
        <StatCard label="Churn" :value="184" :delta="-3.2" :data="dip" :icon="UsersIcon" />
      </div>
    </div>

    <div class="grid gap-6 md:grid-cols-2">
      <div class="space-y-3">
        <h3 class="text-sm font-medium text-muted-foreground">
          Sparkline — colored via currentColor on the wrapper
        </h3>
        <Card class="flex-row items-center gap-6 p-5">
          <div class="h-10 w-28 text-primary"><Sparkline :data="trend" /></div>
          <div class="h-10 w-28 text-emerald-500"><Sparkline :data="trend" /></div>
          <div class="h-10 w-28 text-destructive"><Sparkline :data="dip" /></div>
        </Card>

        <h3 class="pt-3 text-sm font-medium text-muted-foreground">
          ProgressMeter — value 0–100 plus optional detail text
        </h3>
        <Card class="gap-4 p-5">
          <ProgressMeter label="Storage" :value="72" detail="14.4 / 20 GB" />
          <ProgressMeter label="Seats" :value="90" detail="9 / 10" />
        </Card>

        <h3 class="pt-3 text-sm font-medium text-muted-foreground">
          UserAvatar — initials from a name, three sizes
        </h3>
        <Card class="flex-row items-center gap-3 p-5">
          <UserAvatar name="Maya Okafor" size="sm" />
          <UserAvatar name="Liam Chen" />
          <UserAvatar name="Sofia Reyes" size="lg" />
        </Card>
      </div>

      <div class="space-y-3">
        <h3 class="text-sm font-medium text-muted-foreground">
          BarChart — grows in on mount, values on hover
        </h3>
        <Card class="p-5">
          <BarChart :data="bars" :height="140" />
        </Card>

        <h3 class="pt-3 text-sm font-medium text-muted-foreground">
          ActivityFeed — icon timeline with times
        </h3>
        <Card class="p-5">
          <ActivityFeed :items="sampleActivity" />
        </Card>
      </div>
    </div>
  </div>
</template>
