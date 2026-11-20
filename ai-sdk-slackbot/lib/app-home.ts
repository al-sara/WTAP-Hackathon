import type { KnownBlock } from "@slack/web-api";
import { client } from "./slack-utils";
import { THEMES, THEME_LABELS } from "./data/seed";
import {
  MIN_GROUP_SIZE,
  currentWeek,
  getCapacity,
  getFollowUps,
  getSignals,
} from "./store";

/**
 * App Home tab. Early Talent staff (EARLY_TALENT_USER_IDS) see the trend
 * dashboard; students see what the bot does and how their data is handled.
 * If EARLY_TALENT_USER_IDS is unset, everyone sees the dashboard (demo mode).
 */

const hrIds = (process.env.EARLY_TALENT_USER_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export async function publishHome(userId: string) {
  const isHr = hrIds.length === 0 || hrIds.includes(userId);
  await client.views.publish({
    user_id: userId,
    view: { type: "home", blocks: isHr ? dashboardBlocks() : studentBlocks() },
  });
}

const cell = (n: number) => (n === 0 ? "·" : n < MIN_GROUP_SIZE ? `<${MIN_GROUP_SIZE}` : String(n));
const bar = (n: number, max: number) => "█".repeat(Math.max(1, Math.round((n / max) * 12)));
const md = (text: string): KnownBlock => ({ type: "section", text: { type: "mrkdwn", text } });
const divider: KnownBlock = { type: "divider" };

function countBy<T>(items: T[], key: (t: T) => string) {
  const m = new Map<string, number>();
  for (const i of items) m.set(key(i), (m.get(key(i)) ?? 0) + 1);
  return m;
}

export function dashboardBlocks(): KnownBlock[] {
  const now = currentWeek();
  const signals = getSignals();
  const weeks = Array.from({ length: Math.min(now, 8) }, (_, i) => i + 1);

  // --- 1. Blockers by week -------------------------------------------------
  const byThemeWeek = countBy(signals, (s) => `${s.theme}|${s.week}`);
  const rows = THEMES.map((t) => ({
    t,
    counts: weeks.map((w) => byThemeWeek.get(`${t}|${w}`) ?? 0),
  })).sort((a, b) => b.counts.reduce((x, y) => x + y) - a.counts.reduce((x, y) => x + y));

  const table = [
    "Theme".padEnd(24) + weeks.map((w) => `W${w}`.padStart(5)).join(""),
    ...rows.map((r) => THEME_LABELS[r.t].padEnd(24) + r.counts.map((c) => cell(c).padStart(5)).join("")),
  ].join("\n");

  // Headline: the biggest theme in each week so far.
  const peaks = weeks
    .map((w) => {
      const top = rows.map((r) => ({ t: r.t, n: r.counts[w - 1] })).sort((a, b) => b.n - a.n)[0];
      return top && top.n >= MIN_GROUP_SIZE ? `Week ${w}: *${THEME_LABELS[top.t]}* (${top.n} students)` : null;
    })
    .filter(Boolean);

  // --- 2. Capacity & idle ------------------------------------------------------
  const cap = [...countBy(getCapacity(), (c) => c.group)].sort((a, b) => b[1] - a[1]);
  const capMax = Math.max(1, ...cap.map(([, n]) => n));
  const capShown = cap.filter(([, n]) => n >= MIN_GROUP_SIZE);
  const capHidden = cap.length - capShown.length;

  // --- 3. Unmet asks by hub (current week) -------------------------------------
  const thisWeek = signals.filter((s) => s.week === now);
  const hubs = [...countBy(thisWeek, (s) => s.hub)].sort((a, b) => b[1] - a[1]);
  const hubMax = Math.max(1, ...hubs.map(([, n]) => n));

  const followUps = getFollowUps().slice(-8).reverse();

  return [
    { type: "header", text: { type: "plain_text", text: `🧭 Early Talent Pulse — week ${now}` } },
    md(
      `Live, anonymized themes from students who chose to share. Groups under ${MIN_GROUP_SIZE} are hidden. *${signals.length}* signals this term.`,
    ),
    divider,
    md("*📈 Blockers by week*\n" + peaks.join("\n")),
    md("```" + table + "```"),
    divider,
    md(
      "*💤 Capacity & idle projects* — students who flagged no work, by group\n" +
        (capShown.map(([g, n]) => `\`${bar(n, capMax)}\` ${n}  ${g}`).join("\n") || "_None yet_") +
        (capHidden ? `\n_${capHidden} group(s) hidden (fewer than ${MIN_GROUP_SIZE})_` : ""),
    ),
    divider,
    md(
      `*📍 Asks by hub — week ${now}*\n` +
        hubs
          .map(([h, n]) =>
            n >= MIN_GROUP_SIZE ? `\`${bar(n, hubMax)}\` ${n}  ${h}` : `\`·\` <${MIN_GROUP_SIZE}  ${h} _(hidden)_`,
          )
          .join("\n"),
    ),
    divider,
    md(
      "*🙋 Follow-up requests* — students asked to be contacted (named with consent)\n" +
        (followUps
          .map(
            (f) =>
              `• ${f.userId.startsWith("U_SEED") ? "A student (demo)" : `<@${f.userId}>`} — ${THEME_LABELS[f.theme]}, week ${f.week}, ${f.hub}`,
          )
          .join("\n") || "_None_"),
    ),
    divider,
    md(
      "*🧾 Receipts — you told us → we changed*\n" +
        "• _Tooling access_ peaked in week 2 → LLM sandbox access is now requested on day 1 for AI co-ops\n" +
        "• _Scope unclear_ in week 1 → managers get a project-planning prompt 4 weeks before the cohort starts",
    ),
  ];
}

function studentBlocks(): KnownBlock[] {
  return [
    { type: "header", text: { type: "plain_text", text: "🧭 Compass — your first-line mentor" } },
    md(
      "DM me anytime:\n• *I'm stuck on X* → the right support channel, code owner, a similar past project, or a peer with capacity\n• *I have nothing to do* → where your skills are needed + upskilling\n• *Who can I grab lunch with?* → students who share your interests\n• *Is this what I signed up for?* → compare your work to your job description",
    ),
    divider,
    md(
      "*🔒 Your data*\n• Chats are *private by default*.\n• *Share anonymously* sends only a topic + week + hub — no name, no message.\n• *Ask for follow-up* shares your name with Early Talent only.\n• I never message anyone on your behalf.",
    ),
  ];
}
