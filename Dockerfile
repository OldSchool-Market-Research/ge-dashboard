# ge-dashboard: single static Go binary (templates + htmx embedded) on
# distroless. Stateless — everything comes from the orchestrator API.

# ---- build ----
FROM golang:1.26-bookworm AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux \
    go build -trimpath -ldflags="-s -w" -o /out/ge-dashboard .

# ---- runtime ----
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/ge-dashboard /ge-dashboard
USER nonroot:nonroot
ENV GE_DASHBOARD_ADDR=0.0.0.0:8420
ENTRYPOINT ["/ge-dashboard"]
