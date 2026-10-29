package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"
)

// iconProxy serves OSRS item icons at /icons/<file>.png. The file names come
// from the Wiki /mapping feed (items.icon, e.g. "Dragon dart tip.png"); the
// images live on the OSRS Wiki. Each icon is fetched from the Wiki once, with
// a descriptive User-Agent, and kept in memory, so browsers never call the
// Wiki directly and it sees about one request per icon per pod.
//
// The endpoint takes untrusted names, so it is bounded on every side:
//   - only small PNGs (inventory icons are ~36x32, a few hundred bytes) are
//     accepted, so other Wiki images can't fill the cache;
//   - the cache is capped in bytes;
//   - concurrent first requests for one name share a single fetch, misses
//     are remembered for a while, and at most a few fetches run at once, so
//     no client can drive unbounded Wiki traffic under our User-Agent;
//   - the upstream host is fixed and redirects aren't followed.
type iconProxy struct {
	upstream string // e.g. https://oldschool.runescape.wiki
	client   *http.Client
	slots    chan struct{} // concurrent upstream fetches

	mu       sync.Mutex
	cache    map[string][]byte
	bytes    int
	misses   map[string]time.Time // name -> retry after (Wiki 404s)
	inflight map[string]*iconFetch
}

type iconFetch struct {
	done   chan struct{}
	img    []byte
	status int
}

const (
	iconCacheBytes = 8 << 20  // ~4.7k real icons are ~2 MB
	iconMaxBytes   = 16 << 10 // the largest real icon is under 1 KB
	iconMaxDim     = 64       // inventory icons are at most 36x32
	iconMissTTL    = 15 * time.Minute
	iconMissMax    = 4096
	iconFetchSlots = 4
	iconUserAgent  = "ge-dashboard (private OSRS GE research dashboard; item icons cached server-side)"
)

// iconName is the only shape accepted: a /mapping-style file name (letters
// in any script, digits, and the punctuation item names use) ending in .png.
// No "/" means no path segments, so nothing but /images/<one name> is ever
// requested upstream.
var iconName = regexp.MustCompile(`^[\p{L}\p{N} _'()+.,!&-]{1,120}\.png$`)

var pngSignature = []byte("\x89PNG\r\n\x1a\n")

func newIconProxy(upstream string) *iconProxy {
	return &iconProxy{
		upstream: strings.TrimRight(upstream, "/"),
		client: &http.Client{
			Timeout: 10 * time.Second,
			// a redirect off the Wiki's image path is a miss, not something to cache
			CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
		},
		slots:    make(chan struct{}, iconFetchSlots),
		cache:    map[string][]byte{},
		misses:   map[string]time.Time{},
		inflight: map[string]*iconFetch{},
	}
}

func (p *iconProxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(r.URL.Path, "/icons/")
	if !iconName.MatchString(name) {
		http.Error(w, "bad icon name", http.StatusBadRequest)
		return
	}
	img, status := p.get(name)
	if img == nil {
		http.Error(w, http.StatusText(status), status)
		return
	}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	// icons change only with game updates; a day of browser caching is plenty
	w.Header().Set("Cache-Control", "public, max-age=86400")
	w.Write(img)
}

// get returns a cached icon, or fetches it once no matter how many requests
// for the same name arrive at the same time.
func (p *iconProxy) get(name string) ([]byte, int) {
	p.mu.Lock()
	if img, ok := p.cache[name]; ok {
		p.mu.Unlock()
		return img, http.StatusOK
	}
	if until, ok := p.misses[name]; ok && time.Now().Before(until) {
		p.mu.Unlock()
		return nil, http.StatusNotFound
	}
	if f, ok := p.inflight[name]; ok {
		p.mu.Unlock()
		<-f.done
		return f.img, f.status
	}
	f := &iconFetch{done: make(chan struct{})}
	p.inflight[name] = f
	p.mu.Unlock()

	f.img, f.status = p.fetch(name)

	p.mu.Lock()
	delete(p.inflight, name)
	switch {
	case f.img != nil && p.bytes+len(f.img) <= iconCacheBytes:
		p.cache[name] = f.img
		p.bytes += len(f.img)
	case f.status == http.StatusNotFound:
		if len(p.misses) >= iconMissMax {
			p.misses = map[string]time.Time{} // crude but bounded
		}
		p.misses[name] = time.Now().Add(iconMissTTL)
	}
	p.mu.Unlock()
	close(f.done)
	return f.img, f.status
}

// fetch gets one icon from the Wiki (spaces are underscores in its file
// URLs). Returns (nil, status) on any failure: anything but a small PNG is a
// 502, a missing file a 404, all fetch slots busy a 503.
func (p *iconProxy) fetch(name string) ([]byte, int) {
	select {
	case p.slots <- struct{}{}:
		defer func() { <-p.slots }()
	case <-time.After(p.client.Timeout):
		return nil, http.StatusServiceUnavailable
	}

	u := fmt.Sprintf("%s/images/%s", p.upstream, url.PathEscape(strings.ReplaceAll(name, " ", "_")))
	req, err := http.NewRequest(http.MethodGet, u, nil)
	if err != nil {
		return nil, http.StatusBadRequest
	}
	req.Header.Set("User-Agent", iconUserAgent)
	resp, err := p.client.Do(req)
	if err != nil {
		return nil, http.StatusBadGateway
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return nil, http.StatusNotFound
	}
	if resp.StatusCode != http.StatusOK {
		return nil, http.StatusBadGateway
	}
	img, err := io.ReadAll(io.LimitReader(resp.Body, iconMaxBytes+1))
	if err != nil || len(img) > iconMaxBytes || !smallPNG(img) {
		return nil, http.StatusBadGateway
	}
	return img, http.StatusOK
}

// smallPNG checks the PNG signature and that the IHDR dimensions are within
// an inventory icon's size, so detail images, maps and non-PNGs never get
// cached or served as image/png.
func smallPNG(b []byte) bool {
	if len(b) < 24 || !bytes.Equal(b[:8], pngSignature) || string(b[12:16]) != "IHDR" {
		return false
	}
	w, h := binary.BigEndian.Uint32(b[16:20]), binary.BigEndian.Uint32(b[20:24])
	return w > 0 && h > 0 && w <= iconMaxDim && h <= iconMaxDim
}
