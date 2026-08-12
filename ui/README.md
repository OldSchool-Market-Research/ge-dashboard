# app-template

A personal starting point for web apps: Vue 3 + Vite + TypeScript, Tailwind v4,
shadcn-vue components, and a theme system with live-editable presets. Clone it,
rename it, delete what you don't need.

**Stack:** Vue 3 · Vite · TypeScript · Tailwind v4 (`@tailwindcss/vite`, CSS-first) ·
shadcn-vue (reka-ui) · `@lucide/vue` icons · vue-sonner toasts · bun · nix devshell

## Start a new app from this

```sh
gh repo create myapp --template fisherrjd/app-template --public --clone
cd myapp
```

Or without a GitHub repo:

```sh
git clone https://github.com/fisherrjd/app-template myapp
cd myapp
rm -rf .git && git init
```

Rename checklist:

- [ ] `package.json` → `name`
- [ ] `default.nix` → `name = "..."`
- [ ] `index.html` → `<title>`
- [ ] `src/App.vue` → brand text in the header (and footer)
- [ ] `public/favicon.svg` → replace the placeholder mark
- [ ] `vite.config.ts` → `PORT` (one unique port per app; used by dev and preview)

Then:

```sh
direnv allow   # builds the nix devshell (bun + pog scripts)
dev            # installs deps if needed, starts vite on PORT (default :3000)
```

## Scripts

Pog scripts from the devshell (each has a `bun run` equivalent):

| script    | does                                  |
| --------- | ------------------------------------- |
| `dev`     | vite dev server (`bun run dev`)       |
| `build`   | typecheck + build to `./dist`         |
| `preview` | serve the production build            |
| `check`   | typecheck only (`bun run typecheck`)  |

The server binds `0.0.0.0` on `PORT` (set in `vite.config.ts`, default 3000)
for both dev and preview, with `allowedHosts: true` — so it's reachable as
`<host>:PORT` over tailscale from any machine.

## Theming

Themes are **presets** (`data-theme` on `<html>`) crossed with **mode**
(`.dark` class). Both persist to localStorage and apply pre-paint via the
inline script in `index.html`.

- Tokens live in `src/assets/themes/<preset>.css` — one file per preset, a
  light block and a `.dark` block of shadcn HSL triplets. Presets: **evergreen**
  (default — forest green/grey/tan, dark-first), dusk, earthy, grapebox.
  Default mode is dark.
- Open **`/styleguide`** while editing: swatches, type scale, and every
  component repaint live via HMR.
- The wiring (`@theme inline` map, radius, base styles) is in
  `src/assets/index.css` — you rarely touch it.

Add a preset:

1. Copy `src/assets/themes/earthy.css` → `themes/<name>.css`, change the
   `[data-theme='<name>']` selectors and the triplets.
2. Add `@import "./themes/<name>.css";` in `src/assets/index.css`.
3. Add `{ id: '<name>', label: '<Name>' }` to `THEMES` in `src/lib/themes.ts`.
4. Add the id to the pre-paint `themes` list in `index.html` (it validates
   saved themes so a deleted preset can't paint unstyled).

To lock a single look for a real app, delete the presets you don't want and
(optionally) the `ThemePicker` from `App.vue`.

## Pattern library

Beyond the shadcn primitives in `src/components/ui/`, reusable patterns live in
domain folders — each has a matching section in the styleguide, and the example
pages compose them:

| folder                      | components                                                        | example page |
| --------------------------- | ----------------------------------------------------------------- | ------------ |
| `components/dashboard/`     | StatCard, Sparkline, BarChart, ActivityFeed, ProgressMeter, UserAvatar | `/` |
| `components/project/`       | KanbanBoard (touch drag & drop), StatusBadge, PullRequestItem, NotesPanel, FreshnessDot, SaveIndicator, Checklist | `/project` |
| `components/forms/`         | FormField, SettingsSection, TagInput                              | `/settings` |
| `components/data/`          | DataTable (sort/pagination/slots), SearchInput, FilterBar         | styleguide |
| `components/states/`        | EmptyState, ErrorState, ConfirmDialog                             | styleguide |
| `components/content/`       | MarkdownView (marked + DOMPurify, `.md-prose` tokens), ArticleCard, PostMeta | `/blog` |
| `components/` (top level)   | PageHeader, ThemePicker, ThemeToggle                              | everywhere |

Demo data stays in the views; components only take props/v-model, so they lift
straight into real apps. Kanban and notes persist to localStorage until a
backend replaces them. For a new app, delete the folders (and routes) you
don't need.

Note: `crypto.randomUUID` is unavailable over plain http (e.g. tailnet) — use
`uid()` from `src/lib/utils.ts` for client-side ids.

## Stripping the styleguide

For apps that don't want the playground:

1. Delete `src/views/styleguide/`.
2. Remove the `/styleguide` route from `src/router.ts`.
3. Remove the Styleguide nav link in `src/App.vue`.

## Adding components

```sh
bunx shadcn-vue@latest add <component>
```

Included set: button, card, input, textarea, label, select, checkbox, switch,
dialog, dropdown-menu, tabs, table, badge, separator, skeleton, sonner, tooltip.

Note: this repo keeps the `hsl(var(--x))` triplet convention in
`src/assets/index.css` rather than the newer oklch style the shadcn-vue CLI
generates — newly added components work either way since they only use utility
names, but don't let the CLI rewrite `src/assets/index.css`.

## Backend proxy

When the app grows an API, uncomment the `/api` proxy block in
`vite.config.ts` and point `VITE_BACKEND` at it.
