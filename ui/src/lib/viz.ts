// Chart color roles, from the validated dataviz reference palette (validated
// for CVD separation + surface contrast in both modes; see the dataviz skill's
// references/palette.md). Charts read these — never the theme's shadcn tokens —
// so series identity survives theme-preset switches. Categorical hues are
// assigned in FIXED order by archetype, never cycled.

export const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'] as const
export const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'] as const

// Fixed archetype -> slot assignment (identity follows the entity, not rank).
export const ARCHETYPE_ORDER = ['F', 'C', 'B', 'V', 'U'] as const

export function archetypeColor(archetype: string, dark: boolean): string {
  const i = ARCHETYPE_ORDER.indexOf(archetype as (typeof ARCHETYPE_ORDER)[number])
  const series = dark ? SERIES_DARK : SERIES_LIGHT
  return i >= 0 ? series[i] : dark ? '#c3c2b7' : '#52514e'
}

// Diverging pair for signed gp (blue = positive, red = negative — warm/cool
// poles; the neutral "nothing" is the surface itself).
export const DIVERGING = {
  light: { pos: '#2a78d6', neg: '#e34948' },
  dark: { pos: '#3987e5', neg: '#e66767' },
} as const

// Status palette (fixed, never themed): strategy/eval state chips.
export const STATUS = {
  good: '#0ca30c', // confirmed / healthy
  warning: '#fab219', // degraded / armed
  serious: '#ec835a', // expired
  critical: '#d03b3b', // killed / kill_signal / failed
} as const
