# RBC Polaris

**A Slack bot that acts as a first-line mentor for RBC early talent, and turns what students ask into anonymized program insight.**

## Why

- **Students** (co-ops and new grads, usually in their first job) get stuck and stay silent.
- **Mentors and managers** have no time: ~30–40 mentor spots for ~700 TNO students.
- **Early Talent / HR** hears about problems late, through surveys, midterms and manager anecdotes, often only at two weeks' notice.

## What it does

Students DM the bot, @mention it, or open it in Slack's AI-assistant side panel. The LLM picks one of four tools:

| Tool | Student says | What happens |
|---|---|---|
| `findHelp` | "I'm stuck on X" | Points to the right support-channel thread, GitHub code owner, past project with the same stack, or a peer. Target: 30 min → 30 sec to first lead. |
| `logCapacity` | "I have nothing to do" | Logs capacity and suggests peers who need help (both managers approve any pairing) and relevant workshops |
| `findPeers` | "Who can I talk to about Y?" | Matches students with shared interests across teams |
| `compareToJD` | "Is this what I signed up for?" | Compares actual work to the Quest job description for the role |

What students choose to share feeds three loops:

- **Early Talent dashboard**: blockers by week, idle projects, and unmet mentorship asks by hub. Trends only, no names.
- **Manager digest**: an intern's top questions of the week (opt-in), plus a nudge before each cohort, e.g. "last term's interns ran out of work in week 6."
- **JD rewrite**: end-of-term "expected vs. actual" per role per team, used to update next year's job descriptions.

## How it works

```
Slack (DM · @mention · assistant panel · App Home)
        │
        ▼
Vercel AI SDK agent loop ── LLM picks a tool + labels the topic
        │
        ▼
Open Policy Agent ── every tool call and consent button is checked
        │
        ▼
findHelp · logCapacity · findPeers · compareToJD
        │   (deterministic lookups)
        ▼
Slack · GitHub · project briefs · RBC Connect · Quest JDs
```

The LLM only classifies and routes. Answers come from deterministic lookups over RBC's own sources, which keeps it cheap and means it never invents who owns a tool.

## Tech stack

| Layer | MVP (running now) | At RBC |
|---|---|---|
| Interface | Slack bot: DMs, @mentions, AI-assistant side panel, App Home tab, Block Kit buttons | Same, in RBC's enterprise Slack |
| Runtime | TypeScript on Node.js | Same |
| Agent framework | Vercel AI SDK (`ai` v7): agent loop with tool calling | Same |
| LLM | Google Gemini (`gemini-3.1-flash-lite`, falling back to `gemini-3.5-flash-lite`) via `@ai-sdk/google` | Borealis / RBC's in-house LLM platform. One-line change in `lib/model.ts` |
| Tools | `findHelp`, `logCapacity`, `findPeers`, `compareToJD` | Same |
| Data | Live search of public Slack channels, plus mock data for support channels, GitHub code owners, past projects, peers, RBC Connect events and Quest JDs | Real Slack API, GitHub API, Confluence project briefs, RBC Connect, Quest |
| Policy / privacy | Open Policy Agent: Rego policy compiled to WASM, with 12 policy tests | Same, and Risk/Compliance can review the policy file |
| Storage | In-memory, seeded with a sample cohort | Redis or Postgres (only `lib/store.ts` changes) |
| Hosting | Local Node server + Cloudflare tunnel; Vercel-ready config | RBC internal cloud (Azure / OpenShift) |
| Tooling | pnpm, tsx, TypeScript strict mode, OPA CLI | Same |

### Why this stack

- **Slack:** students already live there, so there's no new platform to adopt.
- **Vercel AI SDK:** the model swaps without rewriting anything, so the move to Borealis is one line.
- **OPA:** privacy rules live in a policy file Compliance can audit, not buried in prompt text.
- **LLM as router only:** keeps it cheap and means it never makes up names.

## Privacy

Every tool call and consent button passes through the OPA policy.

- **Private by default.** Nothing leaves the chat unless the student chooses to share it.
- **Anonymous sharing** sends only the topic, week and hub. Groups under 5 are hidden.
- **Follow-up requests** go only to the person the student names.
- The bot never messages anyone on a student's behalf, and it reads only public channels and docs students can already see.

## Run it locally

```bash
pnpm install
pnpm dev        # starts the Node server and Cloudflare tunnel
```

You'll need a Slack app (bot token + signing secret) pointed at the tunnel URL, and a Google Gemini API key. To run the policy tests:

```bash
opa test policy/
```

## Rollout

1. **Pilot:** the new AI group, whose onboarding champion owns the bot.
2. **Phase 1:** `findHelp` over real support channels and GitHub.
3. **Phase 2:** peer matching and the dashboard.
4. **Phase 3:** the JD and project-planning loop across Tech@RBC.

## Success metrics

Time to first lead on a blocker · % of interns reporting idle time · mentorship asks met · issues caught before midterm · return-offer acceptance and early attrition
