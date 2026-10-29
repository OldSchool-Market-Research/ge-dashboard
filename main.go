// ge-dashboard: the web face of the research engine. A single static Go
// binary serving the embedded Vue SPA (built from ui/ — jade's app-template),
// reverse-proxying /api/* to the orchestrator (SSE included), and serving
// item icons from a memory cache of the OSRS Wiki's (icons.go). Stateless:
// every fact on screen comes from the orchestrator API.
package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"
)

//go:embed all:ui/dist
var uiFS embed.FS

func main() {
	log.SetPrefix("ge-dashboard: ")
	orchURL := getenv("GE_DASHBOARD_ORCH_URL", "http://127.0.0.1:8410")
	addr := getenv("GE_DASHBOARD_ADDR", ":8420")

	target, err := url.Parse(orchURL)
	if err != nil {
		log.Fatal(err)
	}
	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.FlushInterval = -1 // SSE: flush every write

	dist, err := fs.Sub(uiFS, "ui/dist")
	if err != nil {
		log.Fatal(err)
	}
	files := http.FileServer(http.FS(dist))

	mux := http.NewServeMux()
	mux.Handle("/api/", proxy)
	mux.Handle("/icons/", newIconProxy(getenv("GE_DASHBOARD_ICON_UPSTREAM", "https://oldschool.runescape.wiki")))
	// SPA contract: real files (assets, favicon) serve as-is; every other
	// path falls back to index.html and the router takes it from there.
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		p := strings.TrimPrefix(r.URL.Path, "/")
		if p != "" {
			if f, err := dist.Open(p); err == nil {
				f.Close()
				files.ServeHTTP(w, r)
				return
			}
		}
		index, err := fs.ReadFile(dist, "index.html")
		if err != nil {
			http.Error(w, "ui not built", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(index)
	})

	log.Printf("listening on %s (orchestrator: %s)", addr, orchURL)
	log.Fatal(http.ListenAndServe(addr, mux))
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
