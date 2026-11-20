# Compass — early-talent Slack bot (WTAP 2026 MVP)

An always-on first-line mentor in Slack for co-ops and new grads. It turns what students ask into **anonymized, consented** program insight for Early Talent.

| Student says | Tool | Answers from |
|---|---|---|
| "I'm stuck on X" | `findHelp` | support channels + owners, GitHub code owners (filters out people who left), past intern projects, peers with capacity |
| "I have nothing to do" | `logCapacity` | anonymous capacity flag + peers who need help + upskilling events (**DM only**, enforced by policy) |
| "Who can I grab lunch with?" | `findPeers` | opt-in peer index by interests/skills, social events |
| "Is this what I signed up for?" | `compareToJD` | Quest JD expected tasks + what past students in the role said |

The LLM only **picks the tool, extracts keywords and classifies a theme**. Every name, channel and doc in a reply comes from the data in [lib/data/seed.ts](lib/data/seed.ts), which is mock data for the MVP.

**Consent gate.** Each reply that used a tool gets three buttons: *Keep private* (default), *Share anonymously* (stores only theme + week + hub), and *Ask Early Talent to follow up* (named, with consent). An OPA policy enforces exactly which fields can leave the chat. See [policies/decision.rego](policies/decision.rego).

**Early Talent dashboard.** Shown in the bot's **App Home** tab: blockers by week, capacity/idle by group, asks by hub, follow-up requests and receipts. Groups smaller than 5 are hidden.

## Code map

- [lib/run-agent.ts](lib/run-agent.ts): system prompt and agent loop
- [lib/tools.ts](lib/tools.ts): the 4 intents (deterministic lookups)
- [lib/data/seed.ts](lib/data/seed.ts): mock RBC sources (edit this to change the demo)
- [lib/store.ts](lib/store.ts): in-memory store, seeded with a cohort; `COHORT_START` sets "week N"
- [lib/consent.ts](lib/consent.ts): consent buttons and click handler (policy-checked)
- [lib/app-home.ts](lib/app-home.ts): App Home dashboard
- [api/events.ts](api/events.ts): one endpoint for Slack events **and** interactivity
- [policies/](policies/): Rego policy. Run `pnpm policy:test`, and `pnpm policy:build` after editing (needs `opa`)

## Setup

1. `pnpm install`
2. Go to https://api.slack.com/apps, then **Create New App**, then **From a manifest**, and paste [manifest.json](manifest.json). Replace `YOUR-DOMAIN` with your public URL; both Events and Interactivity point at `/api/events`.
3. Install the app to your workspace and set the env vars in `.env` (local) or in Vercel:

   ```
   SLACK_BOT_TOKEN=xoxb-...
   SLACK_SIGNING_SECRET=...
   OPENAI_API_KEY=<your Gemini API key>    # name kept from the template; it's a Gemini key
   # optional
   OPENAI_MODEL=gemini-3.1-flash-lite
   EARLY_TALENT_USER_IDS=U123,U456         # who sees the dashboard; unset = everyone (demo)
   COHORT_START=2026-10-26                 # week 1 of the term
   ```

4. Run it:
   - **Vercel:** `vercel deploy`, or
   - **Local:** `vercel dev` (port 3000) and expose it with `ngrok http 3000`, then use the ngrok URL in the manifest.

## MVP limitations

- Data is mock and lives in memory. A cold start resets anything recorded during the demo; the seeded cohort always comes back. Swap in Redis/Postgres in `lib/store.ts`.
- Every student gets the same demo profile (role/team/hub) from `defaultStudentProfile` in `seed.ts`.
- Pairing with manager approval (pitch step 3) isn't built. The bot suggests the peer, and the student reaches out themselves.
