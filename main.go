// ge-dashboard: the human-facing web UI over ge-orchestrator. Stateless —
// all data comes from the orchestrator API; /api/* is reverse-proxied so the
// browser can reach SSE run feeds and trigger runs from the same origin.
package main

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"

	"github.com/osrs-ge/ge-dashboard/internal/orch"
)

//go:embed templates/*.html
var templateFS embed.FS

//go:embed static/*
var staticFS embed.FS

type server struct {
	orch *orch.Client
	tpl  *template.Template
	md   goldmark.Markdown
}

func main() {
	log.SetPrefix("ge-dashboard: ")
	orchURL := getenv("GE_DASHBOARD_ORCH_URL", "http://127.0.0.1:8410")
	addr := getenv("GE_DASHBOARD_ADDR", ":8420")

	funcs := template.FuncMap{
		"gp":      formatGp,
		"gpn":     func(v int64) string { return formatGp(&v) },
		"deref":   deref,
		"signClass": func(v int64) string {
			switch {
			case v > 0:
				return "c-ok"
			case v < 0:
				return "c-bad"
			}
			return "dim"
		},
		"pct":     func(f *float64) string { if f == nil { return "—" }; return fmt.Sprintf("%.2f%%", *f) },
		"ratio":   func(f *float64) string { if f == nil { return "—" }; return fmt.Sprintf("%.2f", *f) },
		"since":   since,
		"verdictClass": verdictClass,
		"statePill":    statePill,
		"runPill":      runPill,
		"signalPill":   signalPill,
		"howText":      howText,
		"sinceP": func(t *time.Time) string {
			if t == nil {
				return "—"
			}
			return since(*t)
		},
	}
	tpl := template.Must(template.New("").Funcs(funcs).ParseFS(templateFS, "templates/*.html"))

	s := &server{
		orch: orch.New(orchURL),
		tpl:  tpl,
		md:   goldmark.New(goldmark.WithExtensions(extension.GFM)),
	}

	target, err := url.Parse(orchURL)
	if err != nil {
		log.Fatal(err)
	}
	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.FlushInterval = -1 // SSE: flush every write

	mux := http.NewServeMux()
	mux.Handle("GET /static/", http.FileServer(http.FS(staticFS)))
	mux.Handle("/api/", proxy)
	mux.HandleFunc("GET /{$}", s.index)
	mux.HandleFunc("GET /runs", s.runs)
	mux.HandleFunc("POST /runs", s.triggerRun)
	mux.HandleFunc("GET /runs/{id}", s.run)
	mux.HandleFunc("GET /strategies/{id}", s.strategy)
	mux.HandleFunc("GET /scoreboard", s.scoreboard)
	mux.HandleFunc("GET /pnl", s.pnl)
	mux.HandleFunc("GET /signals", s.signals)
	mux.HandleFunc("GET /info", s.info)
	mux.HandleFunc("GET /status", s.status)

	log.Printf("listening on %s (orchestrator: %s)", addr, orchURL)
	log.Fatal(http.ListenAndServe(addr, mux))
}

type page struct {
	Title  string
	Active string
	Err    string
	Status *status
	Data   any
}

// status feeds the in-flight strip shown under the nav on every page.
type status struct {
	ActiveRunID          int64
	Open, Armed, Pending int
}

// fetchStatus returns nil when the orchestrator is unreachable — the strip
// hides itself and the page-level .Err banner reports the outage.
func (s *server) fetchStatus(ctx context.Context) *status {
	h, err := s.orch.Health(ctx)
	if err != nil {
		return nil
	}
	st := &status{ActiveRunID: h.ActiveRunID}
	if strats, err := s.orch.OpenStrategies(ctx); err == nil {
		for _, x := range strats {
			switch x.State {
			case "open":
				st.Open++
			case "armed":
				st.Armed++
			}
		}
	}
	// 500 is the API's max limit — pending signals accumulate past 100.
	if sigs, err := s.orch.Signals(ctx, 500); err == nil {
		for _, sg := range sigs {
			if sg.Status == "pending" {
				st.Pending++
			}
		}
	}
	return st
}

func (s *server) render(w http.ResponseWriter, r *http.Request, name string, p page) {
	p.Status = s.fetchStatus(r.Context())
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := s.tpl.ExecuteTemplate(w, name, p); err != nil {
		log.Printf("render %s: %v", name, err)
	}
}

// status serves the bare strip partial for the htmx 30s poll.
func (s *server) status(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := s.tpl.ExecuteTemplate(w, "status_strip", s.fetchStatus(r.Context())); err != nil {
		log.Printf("render status_strip: %v", err)
	}
}

func (s *server) info(w http.ResponseWriter, r *http.Request) {
	s.render(w, r, "info.html", page{Title: "Info", Active: "info"})
}

func (s *server) index(w http.ResponseWriter, r *http.Request) {
	list, err := s.orch.LatestStrategiesLive(r.Context())
	p := page{Title: "Actionable now", Active: "index", Data: list}
	if err != nil {
		p.Err = "orchestrator unreachable: " + err.Error()
	}
	s.render(w, r, "index.html", p)
}

func (s *server) runs(w http.ResponseWriter, r *http.Request) {
	runs, err := s.orch.Runs(r.Context())
	health, _ := s.orch.Health(r.Context())
	data := map[string]any{"Runs": runs, "Health": health}
	p := page{Title: "Runs", Active: "runs", Data: data}
	if err != nil {
		p.Err = "orchestrator unreachable: " + err.Error()
	}
	s.render(w, r, "runs.html", p)
}

// triggerRun converts the brief form to the orchestrator's JSON body and
// redirects to the run page (which streams live progress).
func (s *server) triggerRun(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	var b strings.Builder
	b.WriteString("{")
	fmt.Fprintf(&b, `"capital_gp": %s`, orInt(r.FormValue("capital_gp"), "100000000"))
	fmt.Fprintf(&b, `, "risk": %q`, orStr(r.FormValue("risk"), "medium"))
	fmt.Fprintf(&b, `, "min_confidence": %q`, orStr(r.FormValue("min_confidence"), "medium"))
	if v := r.FormValue("members"); v == "true" || v == "false" {
		fmt.Fprintf(&b, `, "members": %s`, v)
	}
	b.WriteString(`, "archetypes": {`)
	first := true
	for _, a := range []string{"S", "V", "C", "U", "H"} {
		if v := r.FormValue("w_" + a); v != "" {
			if !first {
				b.WriteString(", ")
			}
			fmt.Fprintf(&b, `%q: %s`, a, v)
			first = false
		}
	}
	b.WriteString("}")
	if n := strings.TrimSpace(r.FormValue("notes")); n != "" {
		fmt.Fprintf(&b, `, "notes": %q`, n)
	}
	b.WriteString("}")

	resp, err := http.Post(s.orch.BaseURL+"/api/runs", "application/json", strings.NewReader(b.String()))
	if err != nil {
		http.Error(w, "orchestrator unreachable: "+err.Error(), 502)
		return
	}
	defer resp.Body.Close()
	var out struct {
		RunID       int64  `json:"run_id"`
		ActiveRunID int64  `json:"active_run_id"`
		Error       string `json:"error"`
	}
	if err := jsonDecode(resp.Body, &out); err != nil {
		http.Error(w, err.Error(), 502)
		return
	}
	switch resp.StatusCode {
	case http.StatusCreated:
		http.Redirect(w, r, fmt.Sprintf("/runs/%d", out.RunID), http.StatusSeeOther)
	case http.StatusConflict:
		http.Redirect(w, r, fmt.Sprintf("/runs/%d", out.ActiveRunID), http.StatusSeeOther)
	default:
		http.Error(w, out.Error, resp.StatusCode)
	}
}

func (s *server) run(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	run, strategies, err := s.orch.Run(r.Context(), id)
	if err != nil {
		s.render(w, r, "run.html", page{Title: "Run", Active: "runs", Err: err.Error()})
		return
	}
	var reportHTML template.HTML
	if run.Status == "succeeded" {
		md, err := s.orch.Report(r.Context(), id)
		if err == nil && md != "" {
			var buf strings.Builder
			if err := s.md.Convert([]byte(md), &buf); err == nil {
				reportHTML = template.HTML(buf.String())
			}
		}
	}
	s.render(w, r, "run.html", page{Title: fmt.Sprintf("Run %d", id), Active: "runs", Data: map[string]any{
		"Run": run, "Strategies": strategies, "ReportHTML": reportHTML,
	}})
}

func (s *server) strategy(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	st, evals, err := s.orch.Strategy(r.Context(), id)
	if err != nil {
		s.render(w, r, "strategy.html", page{Title: "Strategy", Active: "index", Err: err.Error()})
		return
	}
	s.render(w, r, "strategy.html", page{Title: st.Title, Active: "index", Data: map[string]any{
		"S": st, "Evals": evals,
	}})
}

func (s *server) signals(w http.ResponseWriter, r *http.Request) {
	sigs, err := s.orch.Signals(r.Context(), 100)
	trends := map[string][]orch.TrendRow{}
	for _, lens := range []string{"seasonal", "volume", "band"} {
		if rows, terr := s.orch.Trends(r.Context(), lens); terr == nil {
			trends[lens] = rows
		}
	}
	p := page{Title: "Signals", Active: "signals", Data: map[string]any{
		"Signals": sigs, "Trends": trends,
	}}
	if err != nil {
		p.Err = "orchestrator unreachable: " + err.Error()
	}
	s.render(w, r, "signals.html", p)
}

func (s *server) scoreboard(w http.ResponseWriter, r *http.Request) {
	rows, err := s.orch.Scoreboard(r.Context())
	p := page{Title: "Scoreboard", Active: "scoreboard", Data: rows}
	if err != nil {
		p.Err = "orchestrator unreachable: " + err.Error()
	}
	s.render(w, r, "scoreboard.html", p)
}

// pnlView shapes /api/pnl for the "spent vs earned" page. All numbers are
// paper estimates with the self-impact haircut — upper bounds, not a ledger.
type pnlView struct {
	AsOf          time.Time
	CommittedGp   int64 // capital tied up in the open book ("spent")
	OpenPnLGp     int64 // est realized accruing on open positions
	Realized7dGp  int64 // est realized of strategies closed in the last 7d
	NetAllTimeGp  int64 // est realized across every evaluated strategy
	ByArch        []pnlArch
	Days          []pnlDay
	Open          []orch.PnLRow
	Closed        []orch.PnLRow
}

type pnlArch struct {
	Archetype                string
	N, OpenN                 int
	EstRealizedGp, Projected int64
}

// pnlDay is one column of the daily net-realized strip. Height is
// precomputed in pixels; sign is encoded by direction (color is redundant).
type pnlDay struct {
	Label string // day of month
	Title string // full date + value, the hover tooltip
	Val   int64
	H     int
	Up    bool
	Mark  string // direct label, set only on the extreme days
}

const pnlHalfPx = 56 // px height of each half of the daily strip

func (s *server) pnl(w http.ResponseWriter, r *http.Request) {
	res, err := s.orch.PnL(r.Context())
	p := page{Title: "P&L", Active: "pnl"}
	if err != nil {
		p.Err = "orchestrator unreachable: " + err.Error()
		s.render(w, r, "pnl.html", p)
		return
	}
	v := &pnlView{AsOf: res.AsOf}
	now := time.Now().UTC()
	byArch := map[string]*pnlArch{}
	byDay := map[string]int64{}
	for _, row := range res.Strategies {
		est := int64(0)
		if row.EstRealizedGp != nil {
			est = *row.EstRealizedGp
		}
		v.NetAllTimeGp += est
		a := byArch[row.Archetype]
		if a == nil {
			a = &pnlArch{Archetype: row.Archetype}
			byArch[row.Archetype] = a
		}
		a.N++
		a.EstRealizedGp += est
		if row.ProjectedGp != nil {
			a.Projected += *row.ProjectedGp
		}
		switch row.State {
		case "open", "armed":
			a.OpenN++
			if row.Capital != nil {
				v.CommittedGp += *row.Capital
			}
			v.OpenPnLGp += est
			v.Open = append(v.Open, row)
		default: // killed / expired / confirmed
			if row.ClosedAt != nil {
				if now.Sub(*row.ClosedAt) <= 7*24*time.Hour {
					v.Realized7dGp += est
				}
				byDay[row.ClosedAt.UTC().Format("2006-01-02")] += est
			}
			v.Closed = append(v.Closed, row)
		}
	}
	for _, k := range []string{"F", "B", "V", "C", "U", "S", "H"} {
		if a := byArch[k]; a != nil {
			v.ByArch = append(v.ByArch, *a)
		}
	}
	sort.Slice(v.Open, func(i, j int) bool { return deref(v.Open[i].EstRealizedGp) > deref(v.Open[j].EstRealizedGp) })
	sort.Slice(v.Closed, func(i, j int) bool {
		return v.Closed[i].ClosedAt != nil && v.Closed[j].ClosedAt != nil && v.Closed[i].ClosedAt.After(*v.Closed[j].ClosedAt)
	})
	if len(v.Closed) > 15 {
		v.Closed = v.Closed[:15]
	}
	v.Days = dailyBars(byDay, now, 14)
	p.Data = v
	s.render(w, r, "pnl.html", p)
}

// dailyBars renders the trailing-days net-realized values as fixed-height
// columns: linear scale, ±maxAbs mapped to pnlHalfPx, minimum 2px so a
// nonzero day is visible. The extreme gain and loss get direct labels.
func dailyBars(byDay map[string]int64, now time.Time, days int) []pnlDay {
	var out []pnlDay
	var maxAbs, minVal, maxVal int64
	for i := days - 1; i >= 0; i-- {
		d := now.AddDate(0, 0, -i)
		val := byDay[d.Format("2006-01-02")]
		if a := abs64(val); a > maxAbs {
			maxAbs = a
		}
		if val > maxVal {
			maxVal = val
		}
		if val < minVal {
			minVal = val
		}
		out = append(out, pnlDay{
			Label: d.Format("2"),
			Title: d.Format("Jan 2") + ": " + formatGp(&val) + " gp",
			Val:   val,
			Up:    val >= 0,
		})
	}
	for i := range out {
		if maxAbs == 0 {
			continue
		}
		h := int(float64(pnlHalfPx) * float64(abs64(out[i].Val)) / float64(maxAbs))
		if h < 2 && out[i].Val != 0 {
			h = 2
		}
		out[i].H = h
		if v := out[i].Val; v != 0 && ((v == maxVal && v > 0) || (v == minVal && v < 0)) {
			out[i].Mark = formatGp(&v)
		}
	}
	return out
}

func abs64(v int64) int64 {
	if v < 0 {
		return -v
	}
	return v
}

func deref(p *int64) int64 {
	if p == nil {
		return 0
	}
	return *p
}

// --- helpers ---

func formatGp(n *int64) string {
	if n == nil {
		return "—"
	}
	v := *n
	neg := v < 0
	if neg {
		v = -v
	}
	var s string
	switch {
	case v >= 1_000_000_000:
		s = fmt.Sprintf("%.2fB", float64(v)/1e9)
	case v >= 1_000_000:
		s = fmt.Sprintf("%.2fM", float64(v)/1e6)
	case v >= 10_000:
		s = fmt.Sprintf("%.1fk", float64(v)/1e3)
	default:
		s = fmt.Sprintf("%d", v)
	}
	if neg {
		s = "-" + s
	}
	return s
}

func since(t time.Time) string {
	d := time.Since(t)
	switch {
	case d < time.Minute:
		return fmt.Sprintf("%ds ago", int(d.Seconds()))
	case d < time.Hour:
		return fmt.Sprintf("%dm ago", int(d.Minutes()))
	case d < 48*time.Hour:
		return fmt.Sprintf("%.1fh ago", d.Hours())
	default:
		return fmt.Sprintf("%dd ago", int(d.Hours()/24))
	}
}

// howText renders an hour-of-week bucket (0-167 = dow*24+hour UTC, dow
// 0=Sunday) as "Tue 02:00".
func howText(b int) string {
	days := []string{"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"}
	if b < 0 || b > 167 {
		return fmt.Sprintf("?%d", b)
	}
	return fmt.Sprintf("%s %02d:00", days[b/24], b%24)
}

// statePill maps a strategy lifecycle state to its pill color class.
func statePill(s string) string {
	switch s {
	case "open", "confirmed":
		return "ok"
	case "armed":
		return "warn"
	case "killed":
		return "bad"
	}
	return "unknown" // expired
}

func runPill(s string) string {
	switch s {
	case "succeeded":
		return "ok"
	case "failed":
		return "bad"
	}
	return "warn" // running
}

func signalPill(s string) string {
	switch s {
	case "pending":
		return "warn"
	case "investigated":
		return "ok"
	case "assigned":
		return "unknown"
	}
	return "bad" // dismissed
}

func verdictClass(v string) string {
	switch v {
	case "healthy":
		return "ok"
	case "degraded":
		return "warn"
	case "kill_signal":
		return "bad"
	}
	return "unknown"
}

func jsonDecode(r io.Reader, v any) error {
	return json.NewDecoder(r).Decode(v)
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func orStr(v, def string) string {
	if v == "" {
		return def
	}
	return v
}

func orInt(v, def string) string {
	if _, err := strconv.ParseInt(v, 10, 64); err != nil {
		return def
	}
	return v
}
