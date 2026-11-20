# RBC Compass

**A Slack bot that acts as a first-line mentor for RBC early talent, and turns what students ask into anonymized program insight.**

## Why

- **Students** (co-ops and new grads, usually in their first job) get stuck and stay silent.
- **Mentors and managers** have no time: ~30–40 mentor spots for ~700 TNO students.
- **Early Talent / HR** hears about problems late, through surveys, midterms and manager anecdotes, often only at two weeks' notice.

## What it does

Students DM the bot. It routes each message to one of four flows:

- **"I'm stuck on X"**: points to the right support-channel thread, GitHub code owner, past project with the same stack, or a peer. Target: 30 min → 30 sec to first lead.
- **"I have nothing to do"**: logs capacity, pairs the student with peers who need help (both managers approve), and suggests workshops.
- **"Who can I talk to about Y?"**: matches students with shared interests across teams.
- **"Is this what I signed up for?"**: compares actual work to the Quest job description.

What students choose to share feeds three loops:

- **Early Talent dashboard**: blockers by week, idle projects, and unmet mentorship asks by hub. Trends only, no names.
- **Manager digest**: an intern's top questions of the week (opt-in), plus a nudge before each cohort, e.g. "last term's interns ran out of work in week 6."
- **JD rewrite**: end-of-term "expected vs. actual" per role per team, used to update next year's job descriptions.

## How it works

```
Student ──▶ Slack bot ──▶ Intent classifier (RBC in-house LLM)
                               │
        Support channels · GitHub · project briefs · RBC Connect · Quest JDs
                               │
              Consent gate (private / anonymous / follow-up)
                               │
              Early Talent dashboard ──▶ JD + project-planning loop
```

The LLM only classifies and ranks. Answers come from RBC's own sources, so it never invents who owns a tool.

## Privacy

- **Private by default.** Nothing leaves the chat unless the student chooses to share it.
- **Anonymous sharing** sends only the theme, week and hub. Groups under ~5 are suppressed.
- **Follow-up requests** go only to the person the student names.
- The bot never messages anyone on a student's behalf, and it reads only public channels and docs students can already see.

## Rollout

1. **Pilot:** the new AI group, whose onboarding champion owns the bot.
2. **Phase 1:** Slack bot with support-channel and GitHub search.
3. **Phase 2:** peer matching and the dashboard.
4. **Phase 3:** the JD and project-planning loop across Tech@RBC.

It runs on Slack, RBC's existing LLM platform and a small search index, with no new vendor.

## Success metrics

Time to first lead on a blocker · % of interns reporting idle time · mentorship asks met · issues caught before midterm · return-offer acceptance and early attrition
