# ge-dashboard ui

The Vue SPA for ge-dashboard: overview, book, runs, P&L, calibration and
signals over the orchestrator API. The Go server in the repo root embeds the
build (`ui/dist`) and proxies `/api`.

**Stack:** Vue 3 · Vite · TypeScript · Tailwind v4 · `@fisherrjd/ui` (Jade's
theme: shell, primitives, styles) · `@lucide/vue` icons · bun · nix devshell

## Run it

```sh
direnv allow   # builds the nix devshell (bun + pog scripts)
dev            # vite on :3041, /api proxied to the orchestrator
```

Point the proxy elsewhere with `VITE_BACKEND=http://host:8410 dev`.

| script      | does                                                  |
| ----------- | ----------------------------------------------------- |
| `dev`       | vite dev server                                       |
| `build`     | typecheck + build to `./dist`                         |
| `preview`   | serve the production build                            |
| `check`     | typecheck only                                        |
| `ui-update` | pull the latest `@fisherrjd/ui`, typecheck            |

## Look

Colors, fonts and style come from one `ui({ ... })` call in `vite.config.ts`
(Grand Exchange gold, HUD style). To try another look, run `dev` and open
`/styleguide`: its theme lab repaints the app live and prints the config to
paste back. The styleguide is dev-only and never ships in a build.

Shared pieces (AppShell, PageHeader, the shadcn primitives, ConfirmDialog,
dashboard components) come from `@fisherrjd/ui` and update with `ui-update`.
Only components this app needs live in `src/components/`. Chart colors are in
`src/lib/viz.ts`.
