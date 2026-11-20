import { THEMES, THEME_LABELS, type Theme } from "./data/seed";
import {
  MIN_GROUP_SIZE,
  activeCount,
  currentWeek,
  getCapacity,
  getFollowUps,
  getSignals,
  reachedCount,
} from "./store";
import { nameOf } from "./slack-search";

/**
 * Everything the HR dashboard shows, computed server-side. Suppression happens
 * HERE: any group smaller than MIN_GROUP_SIZE is replaced by `null` before it
 * leaves the server, so small counts never reach a browser.
 */

export const COHORT_SIZE = Number(process.env.COHORT_SIZE ?? 700);

// Themes that, rising together, are early signs a student may leave.
const RISK_THEMES: Theme[] = ["no-work-idle", "role-mismatch", "social-connection"];

// What Early Talent can do about each theme — drives "Recommended actions".
const PLAYBOOK: Record<Theme, string> = {
  "tooling-access": "Pre-provision tool and LLM access before day 1 for affected roles.",
  "scope-unclear": "Send managers a project-scoping template; ask for a written week-1 plan.",
  "who-to-ask": "Post a 'who owns what' map per team in onboarding.",
  "no-work-idle": "Ask managers in affected groups to add a stretch project; match idle students with peers who need help.",
  "role-mismatch": "Review these roles' job descriptions with hiring managers; offer a career check-in.",
  "social-connection": "Run a cross-team social at the affected hubs.",
  "career-growth": "Promote upskilling sessions and the mentorship huddle.",
  onboarding: "Refresh the Welcome to Tech session content.",
};

export type Level = "critical" | "serious" | "warning" | "good";

const sup = (n: number) => (n >= MIN_GROUP_SIZE ? n : null);

function countBy<T>(items: T[], key: (t: T) => string) {
  const m = new Map<string, number>();
  for (const i of items) m.set(key(i), (m.get(key(i)) ?? 0) + 1);
  return m;
}

export async function dashboardData() {
  const week = currentWeek();
  const weeks = Array.from({ length: Math.min(week, 12) }, (_, i) => i + 1);
  const signals = getSignals();
  const byThemeWeek = countBy(signals, (s) => `${s.theme}|${s.week}`);
  const tw = (t: Theme, w: number) => byThemeWeek.get(`${t}|${w}`) ?? 0;

  // --- Heatmap: theme × week ---------------------------------------------------
  const heatmap = THEMES.map((t) => ({
    theme: t,
    label: THEME_LABELS[t],
    risk: RISK_THEMES.includes(t),
    total: weeks.reduce((n, w) => n + tw(t, w), 0),
    counts: weeks.map((w) => sup(tw(t, w))),
  })).sort((a, b) => b.total - a.total);

  // --- Movers: this week vs last ------------------------------------------------
  const movers = THEMES.map((t) => {
    const now = tw(t, week);
    const prev = tw(t, week - 1);
    return {
      theme: t,
      label: THEME_LABELS[t],
      risk: RISK_THEMES.includes(t),
      thisWeek: sup(now),
      lastWeek: sup(prev),
      // Only show a delta when both sides are publishable.
      delta: sup(now) !== null && sup(prev) !== null ? now - prev : null,
    };
  }).sort((a, b) => (b.thisWeek ?? 0) - (a.thisWeek ?? 0));

  // --- Hubs (this week) ----------------------------------------------------------
  const thisWeek = signals.filter((s) => s.week === week);
  const hubs = [...countBy(thisWeek, (s) => s.hub)]
    .map(([hub, n]) => {
      const risky = thisWeek.filter((s) => s.hub === hub && RISK_THEMES.includes(s.theme)).length;
      return {
        hub,
        count: sup(n),
        riskShare: sup(n) !== null ? Math.round((risky / n) * 100) : null,
      };
    })
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));

  // --- Capacity / idle by group (this term) ---------------------------------------
  const capacityAll = [...countBy(getCapacity(), (c) => c.group)];
  const capacity = capacityAll
    .map(([group, n]) => ({ group, count: sup(n) }))
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));

  // --- Follow-ups (students chose to be named) ------------------------------------
  const followUps = await Promise.all(
    getFollowUps()
      .slice()
      .reverse()
      .map(async (f) => ({
        who: f.userId.startsWith("U_SEED") ? "Student (demo)" : await nameOf(f.userId),
        theme: THEME_LABELS[f.theme],
        week: f.week,
        hub: f.hub,
        at: f.at,
      })),
  );

  // --- KPIs ------------------------------------------------------------------------
  const activeNow = activeCount(week);
  const activePrev = activeCount(week - 1);
  const kpis = {
    reached: reachedCount(),
    cohort: COHORT_SIZE,
    activeThisWeek: activeNow,
    activeDelta: week > 1 ? activeNow - activePrev : null,
    signalsThisWeek: thisWeek.length,
    signalsTotal: signals.length,
    followUps: followUps.length,
    idleFlagged: getCapacity().length,
  };

  // --- Recommended actions (rules over the aggregates) -----------------------------
  const actions: { level: Level; title: string; detail: string }[] = [];
  const top = movers[0];
  if (top?.thisWeek) {
    actions.push({
      level: top.risk ? "serious" : "warning",
      title: `Top issue this week: ${top.label} (${top.thisWeek} students)`,
      detail: PLAYBOOK[top.theme],
    });
  }
  for (const m of movers) {
    if (m.risk && m.delta !== null && m.delta >= 2 && m !== top) {
      actions.push({
        level: "serious",
        title: `${m.label} is rising: ${m.lastWeek} → ${m.thisWeek} students`,
        detail: `${PLAYBOOK[m.theme]} Rising idle time and role mismatch are early signs a student may leave.`,
      });
    }
  }
  // Flag hubs whose risk share stands out from the overall mix (≥10 pts above).
  const overallRisk = thisWeek.length
    ? Math.round((thisWeek.filter((x) => RISK_THEMES.includes(x.theme)).length / thisWeek.length) * 100)
    : 0;
  for (const h of hubs) {
    if (h.riskShare !== null && h.riskShare >= overallRisk + 10) {
      actions.push({
        level: "serious",
        title: `${h.hub}: ${h.riskShare}% of this week's asks are risk topics (vs ${overallRisk}% overall)`,
        detail: "Check in with this hub's students and managers before midterm evaluations.",
      });
    }
  }
  // Students going quiet is itself a signal.
  if (kpis.activeDelta !== null && kpis.activeDelta <= -15) {
    actions.push({
      level: "warning",
      title: `${-kpis.activeDelta} fewer students used Compass than last week`,
      detail: "Students who go quiet may be stuck or disengaged. Nudge them about the next co-op event.",
    });
  }
  const idleGroups = capacity.filter((c) => c.count !== null);
  if (idleGroups.length) {
    const g = idleGroups[0];
    actions.push({
      level: "warning",
      title: `${g.count} students in ${g.group} flagged they have no work`,
      detail: PLAYBOOK["no-work-idle"],
    });
  }
  if (followUps.length) {
    actions.push({
      level: "critical",
      title: `${followUps.length} student${followUps.length === 1 ? "" : "s"} asked Early Talent to reach out`,
      detail: "They chose to be named. Reply within 2 business days.",
    });
  }
  const falling = movers.find((m) => m.delta !== null && m.delta <= -10);
  if (falling) {
    actions.push({
      level: "good",
      title: `${falling.label} is down ${-falling.delta!} from last week`,
      detail: "Last change is working. Add it to the receipts so students see it.",
    });
  }
  const order: Record<Level, number> = { critical: 0, serious: 1, warning: 2, good: 3 };
  actions.sort((a, b) => order[a.level] - order[b.level]);

  return {
    generatedAt: new Date().toISOString(),
    week,
    weeks,
    minGroup: MIN_GROUP_SIZE,
    kpis,
    actions,
    heatmap,
    movers,
    hubs,
    capacity,
    followUps,
  };
}

export type DashboardData = Awaited<ReturnType<typeof dashboardData>>;
