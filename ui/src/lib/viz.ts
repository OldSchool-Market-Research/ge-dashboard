// Chart color roles. Archetype series come from the validated dataviz
// reference palette (validated for CVD separation + surface contrast in both
// modes; see the dataviz skill's references/palette.md), assigned in FIXED
// order by archetype, never cycled. Signed gp and status chips use the
// theme's own colors (ui() in vite.config.ts), so they match the app.

export const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'] as const
export const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300'] as const

// Fixed archetype -> slot assignment (identity follows the entity, not rank).
export const ARCHETYPE_ORDER = ['F', 'C', 'B', 'V', 'U', 'P'] as const

export function archetypeColor(archetype: string, dark: boolean): string {
  const i = ARCHETYPE_ORDER.indexOf(archetype as (typeof ARCHETYPE_ORDER)[number])
  const series = dark ? SERIES_DARK : SERIES_LIGHT
  return i >= 0 ? series[i] : dark ? '#c3c2b7' : '#52514e'
}

// Diverging pair for signed gp (chart color = made gp, danger = lost gp; the
// neutral "nothing" is the surface itself). Theme variables follow the mode
// by themselves. Use them as style values: SVG fill attributes can't read var().
export const DIVERGING = {
  pos: 'hsl(var(--chart-1))',
  neg: 'hsl(var(--destructive))',
} as const

// Status palette: strategy/eval state chips.
export const STATUS = {
  good: 'hsl(var(--success))', // confirmed / healthy
  warning: 'hsl(var(--warning))', // degraded / armed
  serious: 'hsl(var(--highlight))', // expired
  critical: 'hsl(var(--destructive))', // killed / kill_signal / failed
} as const
