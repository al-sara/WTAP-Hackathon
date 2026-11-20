import { tool } from "ai";
import { z } from "zod";
import {
  THEMES,
  type Theme,
  codeOwners,
  defaultStudentProfile,
  events,
  jobDescriptions,
  pastProjects,
  peers,
  supportChannels,
} from "./data/seed";
import { currentWeek, recordCapacity } from "./store";
import { searchSlack } from "./slack-search";

/**
 * The four intents from the pitch. The LLM only picks the tool, extracts
 * keywords and classifies the `theme`; every name/channel/doc in the answer
 * comes from these deterministic lookups over RBC-owned sources, so the bot
 * can't hallucinate "who owns this tool".
 *
 * Every tool call is gated by OPA (policies/decision.rego) before it runs.
 */

const themeSchema = z
  .enum(THEMES)
  .describe(
    "Classify the student's underlying need. Used ONLY if the student later chooses to share anonymously.",
  );

const keywordsSchema = z
  .array(z.string())
  .describe("Lowercase technical keywords / interests from the request, e.g. ['llm','azure'] or ['matcha'].");

function score(keywords: string[], haystack: string[]): number {
  const hay = haystack.map((h) => h.toLowerCase());
  return keywords.reduce((n, k) => {
    const kw = k.toLowerCase().trim();
    return n + (hay.some((h) => h.includes(kw) || kw.includes(h)) ? 1 : 0);
  }, 0);
}

function topBy<T>(items: T[], fields: (t: T) => string[], keywords: string[], n: number) {
  return items
    .map((item) => ({ item, s: score(keywords, fields(item)) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.item);
}

function publicPeer(p: (typeof peers)[number]) {
  const { optedIn, ...rest } = p;
  return rest;
}

export function buildTools(
  updateStatus?: (s: string) => void,
  // Called only when a tool actually runs (i.e. OPA allowed it), so the
  // consent buttons only appear for real, classified needs.
  onTheme?: (theme: Theme) => void,
) {
  return {
    // Intent 1 — "I'm stuck on X"
    findHelp: tool({
      description:
        "Student is stuck/blocked on a tool, access, codebase or task. Returns support channels (with owners), current code owners, similar past intern projects, opted-in peers who have capacity, and people in public Slack channels who have talked about the topic (`fromSlack`, self-declared experts first).",
      inputSchema: z.object({ keywords: keywordsSchema, theme: themeSchema }),
      execute: async ({ keywords, theme }) => {
        onTheme?.(theme);
        updateStatus?.("is searching Slack, support channels, repos and past projects...");
        const fromSlack = await searchSlack(keywords);
        const channels = topBy(supportChannels, (c) => [...c.topics, c.channel], keywords, 2);
        const owners = topBy(codeOwners, (r) => [...r.topics, r.repo], keywords, 3);
        return {
          theme,
          supportChannels: channels,
          codeOwners: owners
            .filter((r) => r.stillHere)
            .map(({ repo, owners, lastCommit }) => ({ repo, owners, lastCommit })),
          filteredOut: owners.filter((r) => !r.stillHere).map((r) => `${r.repo} (owner left the company)`),
          similarPastProjects: topBy(pastProjects, (p) => p.stack, keywords, 2),
          peersWithCapacity: topBy(
            peers.filter((p) => p.optedIn && p.hasCapacity),
            (p) => p.skills,
            keywords,
            2,
          ).map(publicPeer),
          relatedEvents: topBy(events, (e) => e.topics, keywords, 1),
          fromSlack,
        };
      },
    }),

    // Intent 2 — "I have nothing to do"
    logCapacity: tool({
      description:
        "Student says they have no work, are idle, or have spare capacity. Records an anonymous capacity flag for their group and returns ways to use the time: peers who need help in their skills, and upskilling events.",
      inputSchema: z.object({
        skills: keywordsSchema,
        theme: themeSchema,
      }),
      execute: async ({ skills, theme }) => {
        onTheme?.(theme);
        updateStatus?.("is finding where your skills are needed...");
        recordCapacity({ group: defaultStudentProfile.team, week: currentWeek() });
        const needingHelp = topBy(
          peers.filter((p) => p.optedIn && !p.hasCapacity),
          (p) => p.skills,
          skills,
          2,
        ).map(publicPeer);
        return {
          theme,
          capacityLogged: `Anonymous capacity flag added for ${defaultStudentProfile.team} (week ${currentWeek()}).`,
          peersWhoCouldUseHelp: needingHelp,
          upskilling: events.filter((e) => e.topics.includes("career-growth")),
          note: "Any pairing needs both managers to approve — suggest the student mention it in their next 1:1.",
        };
      },
    }),

    // Intent 3 — "Who can I talk to about Y / lunch?"
    findPeers: tool({
      description:
        "Student wants to meet people, find a lunch/coffee buddy, or someone with a shared interest or skill. Returns opted-in peers, social events, and people in public Slack channels who have talked about the topic (`fromSlack`).",
      inputSchema: z.object({ keywords: keywordsSchema, theme: themeSchema }),
      execute: async ({ keywords, theme }) => {
        onTheme?.(theme);
        updateStatus?.("is finding people you might click with...");
        const fromSlack = await searchSlack(keywords);
        const matches = topBy(
          peers.filter((p) => p.optedIn),
          (p) => [...p.interests, ...p.skills],
          keywords,
          3,
        );
        return {
          theme,
          peers: matches.map(publicPeer),
          events: topBy(events, (e) => e.topics, [...keywords, "social"], 2),
          sameHub: defaultStudentProfile.hub,
          fromSlack,
        };
      },
    }),

    // Intent 4 — "Is this what I signed up for?"
    compareToJD: tool({
      description:
        "Student wonders if their work matches their role/job description, or asks about career direction. Returns the Quest JD's expected tasks for their role plus what past students in that role reported.",
      inputSchema: z.object({
        role: z
          .string()
          .nullable()
          .describe("Role title if the student said it, else null to use their profile."),
        actualTasks: z.array(z.string()).describe("What the student says they are actually doing."),
        theme: themeSchema,
      }),
      execute: async ({ role, actualTasks, theme }) => {
        onTheme?.(theme);
        updateStatus?.("is comparing your work to your job description...");
        const wanted = (role ?? defaultStudentProfile.role).toLowerCase();
        const jd =
          jobDescriptions.find((j) => j.role.toLowerCase() === wanted) ??
          jobDescriptions.find((j) => wanted.includes(j.role.toLowerCase().split(" ")[0])) ??
          jobDescriptions.find((j) => j.role === defaultStudentProfile.role)!;
        return {
          theme,
          role: jd.role,
          expectedFromJD: jd.expected,
          actualTasks,
          whatPastStudentsSaid: jd.whatPastStudentsSaid,
          suggestedEvent: events.find((e) => e.topics.includes("role-mismatch")),
        };
      },
    }),
  };
}
