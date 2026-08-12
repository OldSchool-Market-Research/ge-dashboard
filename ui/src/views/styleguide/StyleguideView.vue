<script setup lang="ts">
import ThemePicker from '@/components/ThemePicker.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { Separator } from '@/components/ui/separator'
import ColorSwatches from './ColorSwatches.vue'
import ComponentGallery from './ComponentGallery.vue'
import ContentPatterns from './ContentPatterns.vue'
import DashboardPatterns from './DashboardPatterns.vue'
import DataPatterns from './DataPatterns.vue'
import FormPatterns from './FormPatterns.vue'
import ProjectPatterns from './ProjectPatterns.vue'
import StatePatterns from './StatePatterns.vue'
import TypeScale from './TypeScale.vue'
</script>

<template>
  <div class="space-y-10">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="space-y-1">
        <h1
          class="bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-3xl font-bold tracking-tight text-transparent"
        >
          Styleguide
        </h1>
        <p class="text-muted-foreground">
          Live view of the current theme. Edit
          <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">src/assets/themes/*.css</code>
          and watch this page repaint.
        </p>
      </div>
      <div class="flex items-center gap-1">
        <ThemePicker />
        <ThemeToggle />
      </div>
    </div>

    <section class="space-y-4">
      <h2 class="flex items-center gap-2 text-xl font-semibold tracking-tight">
        <span class="size-2 rounded-sm bg-primary" aria-hidden="true" />Colors</h2>
      <ColorSwatches />
    </section>

    <Separator />

    <section class="space-y-4">
      <h2 class="flex items-center gap-2 text-xl font-semibold tracking-tight">
        <span class="size-2 rounded-sm bg-primary" aria-hidden="true" />Typography</h2>
      <TypeScale />
    </section>

    <Separator />

    <section class="space-y-4">
      <h2 class="flex items-center gap-2 text-xl font-semibold tracking-tight">
        <span class="size-2 rounded-sm bg-primary" aria-hidden="true" />Components</h2>
      <ComponentGallery />
    </section>

    <Separator />

    <section class="space-y-4">
      <h2 class="flex items-center gap-2 text-xl font-semibold tracking-tight">
        <span class="size-2 rounded-sm bg-primary" aria-hidden="true" />Dashboard patterns</h2>
      <p class="text-sm text-muted-foreground">
        Reusable pieces from
        <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">src/components/dashboard/</code>
        — the home dashboard is built entirely from these.
      </p>
      <DashboardPatterns />
    </section>

    <Separator />

    <section class="space-y-4">
      <h2 class="flex items-center gap-2 text-xl font-semibold tracking-tight">
        <span class="size-2 rounded-sm bg-primary" aria-hidden="true" />Project patterns</h2>
      <p class="text-sm text-muted-foreground">
        GitHub/orchestration pieces from
        <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">src/components/project/</code>
        — see them working together on the Project page.
      </p>
      <ProjectPatterns />
    </section>

    <Separator />

    <section class="space-y-4">
      <h2 class="flex items-center gap-2 text-xl font-semibold tracking-tight">
        <span class="size-2 rounded-sm bg-primary" aria-hidden="true" />Form patterns</h2>
      <p class="text-sm text-muted-foreground">
        From
        <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">src/components/forms/</code>
        — the Settings page is the full worked example.
      </p>
      <FormPatterns />
    </section>

    <Separator />

    <section class="space-y-4">
      <h2 class="flex items-center gap-2 text-xl font-semibold tracking-tight">
        <span class="size-2 rounded-sm bg-primary" aria-hidden="true" />Data patterns</h2>
      <p class="text-sm text-muted-foreground">
        From
        <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">src/components/data/</code>
        — the dashboard's orders table uses the same DataTable.
      </p>
      <DataPatterns />
    </section>

    <Separator />

    <section class="space-y-4">
      <h2 class="flex items-center gap-2 text-xl font-semibold tracking-tight">
        <span class="size-2 rounded-sm bg-primary" aria-hidden="true" />State patterns</h2>
      <p class="text-sm text-muted-foreground">
        From
        <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">src/components/states/</code>
        — empty, error, confirm, and loading.
      </p>
      <StatePatterns />
    </section>

    <Separator />

    <section class="space-y-4">
      <h2 class="flex items-center gap-2 text-xl font-semibold tracking-tight">
        <span class="size-2 rounded-sm bg-primary" aria-hidden="true" />Content patterns</h2>
      <p class="text-sm text-muted-foreground">
        From
        <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">src/components/content/</code>
        — the Blog pages are the worked example.
      </p>
      <ContentPatterns />
    </section>
  </div>
</template>
