// demo content for the blog pattern — replace with an API or real files.
// bodies are markdown, rendered by MarkdownView.

export interface Post {
  slug: string
  title: string
  excerpt: string
  date: string // ISO
  tags: string[]
  author: string
  body: string
}

export function readingTime(md: string): string {
  const words = md.split(/\s+/).length
  return `${Math.max(1, Math.round(words / 220))} min read`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export const POSTS: Post[] = [
  {
    slug: 'why-this-template-exists',
    title: 'Why this template exists',
    excerpt:
      'Every side project used to start with the same two hours of setup. Now it starts with a clone, a rename, and a port number.',
    date: '2026-07-20',
    tags: ['meta'],
    author: 'Jade Fisher',
    body: `Every side project used to start the same way: create a Vite app, add Tailwind,
add a component library, argue with the theme, wire a router, and finally — two
hours in — write the first line of actual product.

This template is that two hours, done once.

## The rules it follows

1. **Delete-friendly.** Everything demo-shaped (the dashboard, the kanban, this
   blog) lives in views with mock data. Components never own data, so stripping
   a page never breaks a component.
2. **Token-discipline.** No hardcoded colors outside the theme files. Switch the
   preset and *everything* repaints — charts, badges, prose, all of it.
3. **One port per app.** \`PORT\` lives in \`vite.config.ts\`, binds \`0.0.0.0\`, and
   allows any host — so every clone is instantly reachable over the tailnet.

## What "done" means here

A pattern goes in the library when it has shown up in **two or more** real
projects. One-offs stay in their app. That keeps the template a toolbox, not
a junk drawer.

> Clone it, rename it, delete what you don't need — the README has the
> checklist.
`,
  },
  {
    slug: 'theme-system-notes',
    title: 'A theme system that survives deletion',
    excerpt:
      'Presets crossed with dark mode, applied before first paint, and safe to delete without unstyled flashes.',
    date: '2026-07-22',
    tags: ['ui', 'theming'],
    author: 'Jade Fisher',
    body: `The theme system has two independent axes: a **preset** (\`data-theme\` on
\`<html>\`) and a **mode** (the \`.dark\` class). Both persist to localStorage and
both apply *before first paint* via an inline script in \`index.html\`:

\`\`\`js
const themes = ['evergreen', 'dusk', 'earthy', 'grapebox']
const saved = localStorage.getItem('app.theme')
document.documentElement.dataset.theme =
  themes.includes(saved) ? saved : 'evergreen'
\`\`\`

That \`themes.includes(saved)\` check is the part people skip. Delete a preset
and any browser that has it saved falls back to the default instead of painting
a page with no tokens at all.

## One file per preset

Each preset is a single CSS file with a light block and a \`.dark\` block of
shadcn HSL triplets. Adding one is four small steps (file, import, registry
entry, pre-paint list) — and the styleguide repaints live while you edit, which
turns theme design into a feedback loop instead of a guessing game.
`,
  },
  {
    slug: 'touch-first-kanban',
    title: 'Touch-first kanban drag & drop',
    excerpt:
      'HTML5 drag events don’t exist on phones. Pointer events, elementFromPoint, and one CSS property get you the rest of the way.',
    date: '2026-07-24',
    tags: ['ui', 'mobile'],
    author: 'Jade Fisher',
    body: `The native HTML5 drag-and-drop API simply does not fire on touch devices,
which is a problem when the whole point of serving on the tailnet is reviewing
from a phone.

The kanban board uses **pointer events** instead. Three ideas carry it:

1. \`setPointerCapture\` on the grip handle — every subsequent move/up event
   routes to the handle, no matter where the finger goes.
2. \`document.elementFromPoint(x, y)\` — during the drag, ask what's under the
   finger and walk up to the nearest \`[data-kanban-col]\` / \`[data-kanban-card]\`.
3. \`touch-action: none\` **on the handle only** — dragging works without
   hijacking page scroll everywhere else.

\`\`\`ts
const hit = document.elementFromPoint(e.clientX, e.clientY)
const col = hit?.closest('[data-kanban-col]')
\`\`\`

A 5px movement threshold separates taps from drags, and a ⋮ menu offers
"Move to…" for anyone who can't (or won't) drag.

## The bug the phone found

\`crypto.randomUUID\` only exists in **secure contexts** — and plain-http over
the tailnet isn't one. The fix is a tiny \`uid()\` helper that falls back to
\`crypto.getRandomValues\`. The lesson: review on the real device early; the
desktop browser was never going to catch that.
`,
  },
]
