package main

import (
	"encoding/binary"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// fakePNG is a PNG header with the given IHDR size: all smallPNG looks at.
func fakePNG(w, h uint32) []byte {
	b := []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\x0dIHDR")
	b = binary.BigEndian.AppendUint32(b, w)
	b = binary.BigEndian.AppendUint32(b, h)
	return append(b, 8, 6, 0, 0, 0, 0, 0, 0, 0)
}

// real /mapping icon names with the punctuation item names use
var realNames = []string{
	"Dragon dart tip.png",
	"Abyssal dagger (p++).png",
	"Ahrim's hood.png",
	"Mushroom & onion.png",
	"Wyrmscraig villager robe bottom (A, black).png",
	"Imperial rosé.png",
	"Premade blurb' sp..png",
}

func newTestUpstream(t *testing.T, hits *atomic.Int32, delay time.Duration) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		time.Sleep(delay)
		if r.Header.Get("User-Agent") != iconUserAgent {
			t.Errorf("missing descriptive User-Agent, got %q", r.Header.Get("User-Agent"))
		}
		file := strings.TrimPrefix(r.URL.Path, "/images/")
		switch {
		case file == "Big_map.png":
			w.Write(fakePNG(800, 600))
		case file == "Huge.png":
			w.Write(append(fakePNG(32, 32), make([]byte, iconMaxBytes)...))
		case file == "Not_png.png":
			w.Header().Set("Content-Type", "image/svg+xml")
			w.Write([]byte("<svg/>"))
		case file == "Moved.png":
			http.Redirect(w, r, "https://example.com/x.png", http.StatusFound)
		case file == "Nope.png":
			http.NotFound(w, r)
		default:
			w.Header().Set("Content-Type", "image/png")
			w.Write(fakePNG(36, 32))
		}
	}))
}

func get(p *iconProxy, path string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	p.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	return rec
}

func TestIconProxyRealNamesAndCache(t *testing.T) {
	var hits atomic.Int32
	up := newTestUpstream(t, &hits, 0)
	defer up.Close()
	p := newIconProxy(up.URL)

	for _, n := range realNames {
		path := "/icons/" + strings.ReplaceAll(n, " ", "%20")
		for i := 0; i < 2; i++ {
			rec := get(p, path)
			if rec.Code != 200 || rec.Header().Get("Content-Type") != "image/png" || rec.Header().Get("X-Content-Type-Options") != "nosniff" {
				t.Fatalf("%q: got %d %q", n, rec.Code, rec.Header().Get("Content-Type"))
			}
		}
	}
	if int(hits.Load()) != len(realNames) {
		t.Fatalf("upstream hit %d times for %d names, want one each (cache)", hits.Load(), len(realNames))
	}
}

func TestIconProxyRejectsAndBounds(t *testing.T) {
	var hits atomic.Int32
	up := newTestUpstream(t, &hits, 0)
	defer up.Close()
	p := newIconProxy(up.URL)

	for _, bad := range []string{"/icons/a/b.png", "/icons/x.svg", "/icons/", "/icons/%00.png", "/icons/a%2Fb.png", "/icons/a?.png"} {
		if rec := get(p, bad); rec.Code != http.StatusBadRequest {
			t.Errorf("%s: got %d, want 400", bad, rec.Code)
		}
	}
	if hits.Load() != 0 {
		t.Fatalf("a rejected name reached upstream")
	}

	for _, c := range []struct {
		path string
		want int
	}{
		{"/icons/Big%20map.png", http.StatusBadGateway}, // a PNG, but not an icon
		{"/icons/Huge.png", http.StatusBadGateway},      // over the size cap
		{"/icons/Not%20png.png", http.StatusBadGateway}, // labelled image/*, not a PNG
		{"/icons/Moved.png", http.StatusBadGateway},     // redirect not followed
		{"/icons/Nope.png", http.StatusNotFound},
	} {
		if rec := get(p, c.path); rec.Code != c.want {
			t.Errorf("%s: got %d, want %d", c.path, rec.Code, c.want)
		}
	}
	if p.bytes != 0 || len(p.cache) != 0 {
		t.Fatalf("a rejected upstream response was cached (%d bytes)", p.bytes)
	}

	// a 404 is remembered: no second upstream request
	before := hits.Load()
	if rec := get(p, "/icons/Nope.png"); rec.Code != http.StatusNotFound || hits.Load() != before {
		t.Fatalf("404 not negatively cached: code %d, upstream hits %d -> %d", rec.Code, before, hits.Load())
	}
}

func TestIconProxyCoalescesConcurrentMisses(t *testing.T) {
	var hits atomic.Int32
	up := newTestUpstream(t, &hits, 50*time.Millisecond)
	defer up.Close()
	p := newIconProxy(up.URL)

	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if rec := get(p, "/icons/Dragon%20dart%20tip.png"); rec.Code != 200 {
				t.Errorf("got %d", rec.Code)
			}
		}()
	}
	wg.Wait()
	if hits.Load() != 1 {
		t.Fatalf("50 concurrent first requests made %d upstream fetches, want 1", hits.Load())
	}
}
