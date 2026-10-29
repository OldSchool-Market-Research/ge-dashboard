package main

import (
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
)

func TestIconProxy(t *testing.T) {
	var hits atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		if r.Header.Get("User-Agent") != iconUserAgent {
			t.Errorf("missing descriptive User-Agent, got %q", r.Header.Get("User-Agent"))
		}
		switch r.URL.EscapedPath() {
		case "/images/Dragon_dart_tip.png", "/images/Abyssal_bracelet%285%29.png":
			w.Header().Set("Content-Type", "image/png")
			w.Write([]byte("png-bytes"))
		case "/images/Not_html.png":
			w.Header().Set("Content-Type", "text/html")
			w.Write([]byte("<html>"))
		default:
			http.NotFound(w, r)
		}
	}))
	defer upstream.Close()
	p := newIconProxy(upstream.URL)

	get := func(path string) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		p.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		return rec
	}

	// fetched once, then served from memory
	for i := 0; i < 3; i++ {
		rec := get("/icons/Dragon%20dart%20tip.png")
		if rec.Code != 200 || rec.Body.String() != "png-bytes" || rec.Header().Get("Content-Type") != "image/png" {
			t.Fatalf("got %d %q %q", rec.Code, rec.Body.String(), rec.Header().Get("Content-Type"))
		}
	}
	if hits.Load() != 1 {
		t.Fatalf("upstream hit %d times, want 1 (cache)", hits.Load())
	}

	// parentheses (common in item names) survive the escaping
	if rec := get("/icons/Abyssal%20bracelet(5).png"); rec.Code != 200 {
		t.Fatalf("bracelet: got %d", rec.Code)
	}

	// rejected before any upstream request
	before := hits.Load()
	for _, bad := range []string{"/icons/../main.go", "/icons/a/b.png", "/icons/x.svg", "/icons/..png", "/icons/"} {
		if rec := get(bad); rec.Code != http.StatusBadRequest {
			t.Errorf("%s: got %d, want 400", bad, rec.Code)
		}
	}
	if hits.Load() != before {
		t.Errorf("a rejected name reached upstream")
	}

	// upstream misses and non-images aren't served or cached
	if rec := get("/icons/Nope.png"); rec.Code != http.StatusNotFound {
		t.Errorf("missing icon: got %d, want 404", rec.Code)
	}
	if rec := get("/icons/Not%20html.png"); rec.Code != http.StatusBadGateway {
		t.Errorf("non-image upstream: got %d, want 502", rec.Code)
	}
	if rec := get("/icons/Nope.png"); rec.Code != http.StatusNotFound || hits.Load() < before+3 {
		t.Errorf("a 404 was cached")
	}
}
