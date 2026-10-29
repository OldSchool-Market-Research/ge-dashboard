package main

import (
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
// Wiki directly and the Wiki sees about one request per icon per pod. There
// are ~4.7k tradeable items at a few hundred bytes each, so the cache stays
// a few MB; the cap below is a backstop.
type iconProxy struct {
	upstream string // e.g. https://oldschool.runescape.wiki
	client   *http.Client

	mu    sync.Mutex
	cache map[string][]byte
}

const (
	iconCacheMax  = 6000
	iconMaxBytes  = 256 << 10
	iconUserAgent = "ge-dashboard (private OSRS GE research dashboard; item icons cached server-side)"
)

// iconName is the only shape accepted: a /mapping-style file name, no path
// separators or dot-dot, ending in .png. Anything else is a 400 before any
// upstream request is made.
var iconName = regexp.MustCompile(`^[A-Za-z0-9 _'()+.,!&%-]{1,120}\.png$`)

func newIconProxy(upstream string) *iconProxy {
	return &iconProxy{
		upstream: strings.TrimRight(upstream, "/"),
		client:   &http.Client{Timeout: 10 * time.Second},
		cache:    map[string][]byte{},
	}
}

func (p *iconProxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(r.URL.Path, "/icons/")
	if !iconName.MatchString(name) || strings.Contains(name, "..") {
		http.Error(w, "bad icon name", http.StatusBadRequest)
		return
	}

	p.mu.Lock()
	img, ok := p.cache[name]
	p.mu.Unlock()
	if !ok {
		var status int
		img, status = p.fetch(name)
		if img == nil {
			http.Error(w, http.StatusText(status), status)
			return
		}
		p.mu.Lock()
		if len(p.cache) < iconCacheMax {
			p.cache[name] = img
		}
		p.mu.Unlock()
	}

	w.Header().Set("Content-Type", "image/png")
	// icons change only with game updates; a day of browser caching is plenty
	w.Header().Set("Cache-Control", "public, max-age=86400")
	w.Write(img)
}

// fetch gets one icon from the Wiki. The Wiki's file URLs use underscores for
// spaces. Returns (nil, status) on any failure; failures aren't cached.
func (p *iconProxy) fetch(name string) ([]byte, int) {
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
	if resp.StatusCode != http.StatusOK || !strings.HasPrefix(resp.Header.Get("Content-Type"), "image/") {
		return nil, http.StatusBadGateway
	}
	img, err := io.ReadAll(io.LimitReader(resp.Body, iconMaxBytes+1))
	if err != nil || len(img) > iconMaxBytes {
		return nil, http.StatusBadGateway
	}
	return img, http.StatusOK
}
