/**
 * The HR dashboard page. Self-contained HTML (no external scripts) that polls
 * `?format=json` every 10s, so anonymous shares clicked in Slack show up live.
 * All values are inserted with textContent — theme/hub/group names are data.
 */
export const dashboardPage = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Early Talent Pulse</title>
<style>
:root {
  color-scheme: light;
  --page: #f9f9f7; --surface: #fcfcfb; --border: rgba(11,11,11,0.10);
  --ink: #0b0b0b; --ink-2: #52514e; --muted: #898781; --grid: #e1e0d9; --axis: #c3c2b7;
  --series: #2a78d6; --series-hover: #1c5cab; --empty: #f0efec; --suppressed: #e9e8e3;
  --up-good: #006300;
  --good: #0ca30c; --warning: #fab219; --serious: #ec835a; --critical: #d03b3b;
  --seq-1: #b7d3f6; --seq-2: #86b6ef; --seq-3: #5598e7; --seq-4: #2a78d6; --seq-5: #1c5cab; --seq-6: #104281;
  --seq-ink-low: #0b0b0b; --seq-ink-high: #ffffff;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --page: #0d0d0d; --surface: #1a1a19; --border: rgba(255,255,255,0.10);
    --ink: #f0efec; --ink-2: #c3c2b7; --muted: #898781; --grid: #2c2c2a; --axis: #383835;
    --series: #3987e5; --series-hover: #6da7ec; --empty: #232322; --suppressed: #2a2a28;
    --up-good: #0ca30c;
    --seq-1: #104281; --seq-2: #184f95; --seq-3: #1c5cab; --seq-4: #2a78d6; --seq-5: #5598e7; --seq-6: #9ec5f4;
    --seq-ink-low: #ffffff; --seq-ink-high: #0b0b0b;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --page: #0d0d0d; --surface: #1a1a19; --border: rgba(255,255,255,0.10);
  --ink: #f0efec; --ink-2: #c3c2b7; --muted: #898781; --grid: #2c2c2a; --axis: #383835;
  --series: #3987e5; --series-hover: #6da7ec; --empty: #232322; --suppressed: #2a2a28;
  --up-good: #0ca30c;
  --seq-1: #104281; --seq-2: #184f95; --seq-3: #1c5cab; --seq-4: #2a78d6; --seq-5: #5598e7; --seq-6: #9ec5f4;
  --seq-ink-low: #ffffff; --seq-ink-high: #0b0b0b;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--page); color: var(--ink);
  font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
.wrap { max-width: 1180px; margin: 0 auto; padding: 28px 20px 48px; }
header { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px 24px; margin-bottom: 20px; }
h1 { font-size: 24px; margin: 0; letter-spacing: -0.01em; }
.sub { color: var(--ink-2); margin: 4px 0 0; }
.live { color: var(--muted); font-size: 12px; display: flex; align-items: center; gap: 6px; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--good); }
.stale .dot { background: var(--muted); }
.grid { display: grid; gap: 16px; }
.kpis { grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr)); margin-bottom: 16px; }
.two { grid-template-columns: repeat(auto-fit, minmax(min(340px, 100%), 1fr)); margin-top: 16px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px 20px; min-width: 0; }
.card h2 { font-size: 15px; margin: 0 0 2px; }
.card .note { color: var(--muted); font-size: 12px; margin: 0 0 14px; }
.tile .label { color: var(--ink-2); font-size: 13px; }
.tile .value { font-size: 32px; font-weight: 650; margin: 2px 0; letter-spacing: -0.02em; }
.tile .meta { color: var(--muted); font-size: 12px; }
.tile .meta b { font-weight: 600; }
.up { color: var(--up-good); }
.down { color: var(--critical); }
/* actions */
.actions { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.actions li { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; padding: 10px 12px;
  border: 1px solid var(--border); border-radius: 8px; }
.badge { grid-row: span 2; align-self: start; display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 600; padding: 2px 8px 2px 6px; border-radius: 999px; white-space: nowrap;
  border: 1px solid var(--border); color: var(--ink); }
.badge i { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }
.actions .t { font-weight: 600; }
.actions .d { color: var(--ink-2); font-size: 13px; }
/* heatmap */
.scroll { overflow-x: auto; }
table.heat { border-collapse: separate; border-spacing: 2px; width: 100%; min-width: 420px; }
.heat th { font-weight: 500; color: var(--muted); font-size: 12px; text-align: center; padding: 0 0 4px; }
.heat th.row { text-align: left; color: var(--ink-2); font-size: 13px; padding-right: 10px; white-space: nowrap; }
.heat td { height: 34px; min-width: 56px; text-align: center; border-radius: 4px; font-variant-numeric: tabular-nums;
  font-size: 13px; font-weight: 600; cursor: default; outline-offset: 1px; }
.heat td:hover, .heat td:focus { outline: 2px solid var(--ink); }
.heat td.sup { background: var(--suppressed); color: var(--muted); font-weight: 400;
  background-image: repeating-linear-gradient(45deg, transparent 0 5px, var(--grid) 5px 6px); }
.heat td.zero { background: var(--empty); color: var(--muted); font-weight: 400; }
.risk-tag { font-size: 10px; font-weight: 600; color: var(--ink-2); border: 1px solid var(--serious);
  border-radius: 999px; padding: 0 6px; margin-left: 6px; vertical-align: 1px; }
.scale { display: flex; align-items: center; gap: 4px; margin-top: 10px; color: var(--muted); font-size: 12px; flex-wrap: wrap; }
.scale span.sw { width: 22px; height: 10px; border-radius: 2px; display: inline-block; }
/* bars */
.bars { display: grid; gap: 8px; }
.bar-row { display: grid; grid-template-columns: minmax(110px, 38%) 1fr; align-items: center; gap: 10px; }
.bar-row .name { color: var(--ink-2); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.track { position: relative; height: 22px; display: flex; align-items: center; gap: 8px; }
.bar { height: 14px; background: var(--series); border-radius: 0 4px 4px 0; min-width: 2px; }
.bar-row:hover .bar, .bar-row:focus .bar { background: var(--series-hover); }
.bar-row:focus { outline: 2px solid var(--ink); outline-offset: 2px; border-radius: 4px; }
.track .v { font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
.track .v small { color: var(--muted); font-weight: 400; }
.hidden-note { color: var(--muted); font-size: 12px; margin-top: 10px; }
/* tables */
table.list { width: 100%; border-collapse: collapse; font-size: 13px; }
.list th { text-align: left; color: var(--muted); font-weight: 500; font-size: 12px; padding: 0 8px 6px 0; border-bottom: 1px solid var(--grid); }
.list td { padding: 8px 8px 8px 0; border-bottom: 1px solid var(--grid); font-variant-numeric: tabular-nums; }
.list td.num, .list th.num { text-align: right; }
.empty { color: var(--muted); font-size: 13px; }
footer { margin-top: 24px; color: var(--muted); font-size: 12px; display: grid; gap: 4px; }
#tip { position: fixed; pointer-events: none; z-index: 10; background: var(--surface); color: var(--ink);
  border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font-size: 12px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12); max-width: 260px; }
#tip b { display: block; font-size: 15px; }
#tip span { color: var(--ink-2); }
.refreshing main { opacity: 0.6; transition: opacity 0.2s; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <h1>Early Talent Pulse</h1>
      <p class="sub" id="sub">Live, anonymized signals from co-op and new-grad students.</p>
    </div>
    <div class="live" id="live"><span class="dot"></span><span id="updated">Loading…</span></div>
  </header>

  <main>
    <section class="grid kpis" id="kpis" aria-label="Key numbers"></section>

    <section class="card">
      <h2>Recommended actions</h2>
      <p class="note">Generated from this term's aggregated signals.</p>
      <ul class="actions" id="actions"></ul>
    </section>

    <section class="card" style="margin-top:16px">
      <h2>What students are asking about, by week</h2>
      <p class="note">Number of students who chose to share each topic anonymously. Hatched cells hide groups under <span class="min"></span> to protect anonymity.</p>
      <div class="scroll"><table class="heat" id="heat"></table></div>
      <div class="scale" id="scale"></div>
    </section>

    <div class="grid two">
      <section class="card">
        <h2>This week vs last week</h2>
        <p class="note">Rising risk topics are early signs a student may leave.</p>
        <table class="list" id="movers"></table>
      </section>
      <section class="card">
        <h2>Asks by hub, this week</h2>
        <p class="note">Bar = number of asks. % = share that are risk topics.</p>
        <div class="bars" id="hubs"></div>
        <div class="hidden-note" id="hubs-hidden"></div>
      </section>
    </div>

    <div class="grid two">
      <section class="card">
        <h2>Students with no work, by group</h2>
        <p class="note">Flagged privately to the bot this term. Managers can add stretch projects.</p>
        <div class="bars" id="capacity"></div>
        <div class="hidden-note" id="capacity-hidden"></div>
      </section>
      <section class="card">
        <h2>Follow-up requests</h2>
        <p class="note">Students who asked Early Talent to contact them. Named only because they chose to be.</p>
        <table class="list" id="followups"></table>
      </section>
    </div>
  </main>

  <footer>
    <div>Privacy: chats are private by default. Anonymous shares contain only a topic, week and hub. Groups under <span class="min"></span> are never shown.</div>
    <div>Sample cohort data is seeded for the demo; live Slack activity is added on top.</div>
  </footer>
</div>
<div id="tip" hidden></div>

<script>
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = String(text); return e; };
const STATUS = {
  critical: { label: "Act now", color: "var(--critical)" },
  serious: { label: "Risk", color: "var(--serious)" },
  warning: { label: "Watch", color: "var(--warning)" },
  good: { label: "Working", color: "var(--good)" },
};
const SEQ = ["--seq-1", "--seq-2", "--seq-3", "--seq-4", "--seq-5", "--seq-6"];

// Tooltip: shared by heat cells and bars (hover + keyboard focus).
const tip = $("tip");
function showTip(target, value, label) {
  tip.replaceChildren(el("b", null, value), el("span", null, label));
  tip.hidden = false;
  const r = target.getBoundingClientRect();
  const x = Math.min(window.innerWidth - tip.offsetWidth - 8, Math.max(8, r.left + r.width / 2 - tip.offsetWidth / 2));
  const y = r.top - tip.offsetHeight - 8 < 8 ? r.bottom + 8 : r.top - tip.offsetHeight - 8;
  tip.style.left = x + "px"; tip.style.top = y + "px";
}
function hideTip() { tip.hidden = true; }
function hoverable(node, value, label) {
  node.tabIndex = 0;
  node.setAttribute("aria-label", label + ": " + value);
  node.addEventListener("pointerenter", () => showTip(node, value, label));
  node.addEventListener("pointerleave", hideTip);
  node.addEventListener("focus", () => showTip(node, value, label));
  node.addEventListener("blur", hideTip);
}

function tile(label, value, meta) {
  const t = el("div", "card tile");
  t.append(el("div", "label", label), el("div", "value", value));
  if (meta) t.append(meta);
  return t;
}

function renderKpis(k, week) {
  const reachedMeta = el("div", "meta", Math.round((k.reached / k.cohort) * 100) + "% of the " + k.cohort + "-student cohort");
  const activeMeta = el("div", "meta");
  if (k.activeDelta != null) {
    const d = el("b", k.activeDelta >= 0 ? "up" : "down", (k.activeDelta >= 0 ? "▲ " : "▼ ") + Math.abs(k.activeDelta));
    activeMeta.append(d, document.createTextNode(" vs week " + (week - 1)));
  }
  const sigMeta = el("div", "meta", k.signalsTotal + " shared this term");
  const fuMeta = el("div", "meta", k.idleFlagged + " no-work flags this term");
  $("kpis").replaceChildren(
    tile("Students reached", k.reached, reachedMeta),
    tile("Active this week", k.activeThisWeek, activeMeta),
    tile("Anonymous shares this week", k.signalsThisWeek, sigMeta),
    tile("Waiting for follow-up", k.followUps, fuMeta),
  );
}

function renderActions(actions) {
  const ul = $("actions");
  if (!actions.length) { ul.replaceChildren(el("li", "empty", "Nothing needs attention right now.")); return; }
  ul.replaceChildren(...actions.map((a) => {
    const li = el("li");
    const s = STATUS[a.level];
    const badge = el("span", "badge");
    const sw = el("i"); sw.style.background = s.color;
    badge.append(sw, document.createTextNode(s.label));
    li.append(badge, el("div", "t", a.title), el("div", "d", a.detail));
    return li;
  }));
}

function renderHeat(d) {
  const max = Math.max(1, ...d.heatmap.flatMap((r) => r.counts.filter((c) => c != null)));
  const table = $("heat");
  const head = el("tr"); head.append(el("th"));
  d.weeks.forEach((w) => head.append(el("th", null, w === d.week ? "Wk " + w + " (now)" : "Wk " + w)));
  const rows = d.heatmap.map((r) => {
    const tr = el("tr");
    const th = el("th", "row", r.label);
    if (r.risk) th.append(el("span", "risk-tag", "risk"));
    tr.append(th);
    r.counts.forEach((c, i) => {
      const td = el("td");
      const label = r.label + ", week " + d.weeks[i];
      if (c == null) { td.className = "sup"; td.textContent = "<" + d.minGroup; hoverable(td, "Fewer than " + d.minGroup, label + " (hidden for anonymity)"); }
      else {
        const step = Math.min(SEQ.length - 1, Math.floor((c / max) * SEQ.length));
        td.style.background = "var(" + SEQ[step] + ")";
        // Dark mode: fills 1-4 are dark (white ink); 5-6 are light (dark ink).
        td.style.color = step >= 3 ? "var(--seq-ink-high)" : "var(--seq-ink-low)";
        td.textContent = c;
        hoverable(td, c + " students", label);
      }
      tr.append(td);
    });
    return tr;
  });
  table.replaceChildren(head, ...rows);
  const scale = $("scale");
  scale.replaceChildren(el("span", null, "Fewer"));
  SEQ.forEach((v) => { const s = el("span", "sw"); s.style.background = "var(" + v + ")"; scale.append(s); });
  scale.append(el("span", null, "More students"));
}

function renderMovers(d) {
  const t = $("movers");
  const head = el("tr");
  head.append(el("th", null, "Topic"), el("th", "num", "Wk " + (d.week - 1)), el("th", "num", "Wk " + d.week), el("th", "num", "Change"));
  const rows = d.movers.map((m) => {
    const tr = el("tr");
    const name = el("td", null, m.label);
    if (m.risk) name.append(el("span", "risk-tag", "risk"));
    const fmt = (v) => (v == null ? "<" + d.minGroup : v);
    const delta = el("td", "num");
    if (m.delta == null || m.delta === 0) delta.textContent = m.delta === 0 ? "0" : "—";
    else {
      // For problems, going DOWN is good.
      const good = m.delta < 0;
      delta.append(el("span", good ? "up" : (m.risk ? "down" : ""), (m.delta > 0 ? "▲ " : "▼ ") + Math.abs(m.delta)));
    }
    tr.append(name, el("td", "num", fmt(m.lastWeek)), el("td", "num", fmt(m.thisWeek)), delta);
    return tr;
  });
  t.replaceChildren(head, ...rows);
}

function renderBars(containerId, hiddenId, items, nameKey, extra) {
  const shown = items.filter((i) => i.count != null);
  const hidden = items.length - shown.length;
  const max = Math.max(1, ...shown.map((i) => i.count));
  const c = $(containerId);
  if (!shown.length) c.replaceChildren(el("div", "empty", "No groups large enough to show yet."));
  else c.replaceChildren(...shown.map((i) => {
    const row = el("div", "bar-row");
    const track = el("div", "track");
    const bar = el("div", "bar"); bar.style.width = (i.count / max) * 75 + "%";
    const v = el("span", "v", i.count);
    if (extra) { const x = extra(i); if (x) v.append(el("small", null, "  " + x)); }
    track.append(bar, v);
    row.append(el("div", "name", i[nameKey]), track);
    hoverable(row, i.count + " students", i[nameKey] + (extra && extra(i) ? " · " + extra(i) : ""));
    return row;
  }));
  $(hiddenId).textContent = hidden ? hidden + " group" + (hidden === 1 ? "" : "s") + " hidden (fewer than " + window.__min + ")" : "";
}

function renderFollowUps(list) {
  const t = $("followups");
  if (!list.length) { t.replaceChildren(el("tr", null)); t.firstChild.append(el("td", "empty", "No requests yet.")); return; }
  const head = el("tr");
  head.append(el("th", null, "Student"), el("th", null, "Topic"), el("th", null, "Hub"), el("th", "num", "Week"));
  t.replaceChildren(head, ...list.map((f) => {
    const tr = el("tr");
    tr.append(el("td", null, f.who), el("td", null, f.theme), el("td", null, f.hub), el("td", "num", f.week));
    return tr;
  }));
}

let last = 0;
async function load() {
  document.body.classList.add("refreshing");
  try {
    const url = new URL(location.href); url.searchParams.set("format", "json");
    const d = await (await fetch(url, { cache: "no-store" })).json();
    window.__min = d.minGroup;
    document.querySelectorAll(".min").forEach((n) => (n.textContent = d.minGroup));
    $("sub").textContent = "Week " + d.week + " of the term · live, anonymized signals from co-op and new-grad students.";
    renderKpis(d.kpis, d.week);
    renderActions(d.actions);
    renderHeat(d);
    renderMovers(d);
    renderBars("hubs", "hubs-hidden", d.hubs, "hub", (h) => (h.riskShare != null ? h.riskShare + "% risk" : ""));
    renderBars("capacity", "capacity-hidden", d.capacity, "group");
    renderFollowUps(d.followUps);
    last = Date.now();
    $("live").classList.remove("stale");
    $("updated").textContent = "Live · updated " + new Date(d.generatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
  } catch (e) {
    $("live").classList.add("stale");
    $("updated").textContent = "Can't reach the bot server — showing last data";
  } finally {
    document.body.classList.remove("refreshing");
  }
}
load();
setInterval(load, 10000);
</script>
</body>
</html>`;
