# ge-dashboard: Vue SPA (ui/, from app-template) embedded in a single static
# Go binary on distroless. Stateless — everything comes from the orchestrator
# API, reverse-proxied under /api.

# ---- ui build ----
FROM oven/bun:1 AS ui
WORKDIR /src/ui
COPY ui/package.json ui/bun.lock ./
RUN bun install --frozen-lockfile
COPY ui/ ./
RUN bunx --bun vite build

# ---- go build ----
FROM golang:1.26-bookworm AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY main.go ./
COPY --from=ui /src/ui/dist ./ui/dist
RUN CGO_ENABLED=0 GOOS=linux \
    go build -trimpath -ldflags="-s -w" -o /out/ge-dashboard .

# ---- runtime ----
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/ge-dashboard /ge-dashboard
USER nonroot:nonroot
ENV GE_DASHBOARD_ADDR=0.0.0.0:8420
ENTRYPOINT ["/ge-dashboard"]
