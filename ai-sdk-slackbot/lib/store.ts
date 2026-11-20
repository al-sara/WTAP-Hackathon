import { THEMES, type Theme } from "./data/seed";

/**
 * MVP store: in-memory, seeded with a realistic cohort so the dashboard has
 * shape on first open. Lives for the lifetime of the (warm) server process —
 * swap these functions for Redis/Postgres later without touching callers.
 */

/** What "share anonymously" stores. No names, no free text — by design. */
export interface AnonSignal {
  theme: Theme;
  week: number;
  hub: string;
}

/** What "ask Early Talent to follow up" stores — the student chose to be named. */
export interface FollowUp {
  userId: string;
  theme: Theme;
  week: number;
  hub: string;
  at: string;
}

export interface CapacityFlag {
  group: string;
  week: number;
}

/** Groups smaller than this are hidden on the dashboard (k-anonymity). */
export const MIN_GROUP_SIZE = 5;

// Cohort start date → "week N" for every signal. Override with COHORT_START.
const COHORT_START = new Date(process.env.COHORT_START ?? "2026-10-26");

export function currentWeek(now = new Date()): number {
  const ms = now.getTime() - COHORT_START.getTime();
  return Math.max(1, Math.floor(ms / (7 * 24 * 3600 * 1000)) + 1);
}

const signals: AnonSignal[] = [];
const followUps: FollowUp[] = [];
const capacity: CapacityFlag[] = [];

export function recordSignal(s: AnonSignal) {
  signals.push(s);
}

export function recordFollowUp(f: Omit<FollowUp, "at">) {
  followUps.push({ ...f, at: new Date().toISOString() });
}

export function recordCapacity(c: CapacityFlag) {
  capacity.push(c);
}

export function getSignals() {
  return signals;
}
export function getFollowUps() {
  return followUps;
}
export function getCapacity() {
  return capacity;
}

// ---------------------------------------------------------------------------
// Seed: a believable cohort. "Tooling access" peaks in week 2 (~40 interns),
// "scope unclear" peaks in week 1 — the story told in the pitch.
// ---------------------------------------------------------------------------
const HUBS = ["Toronto – WaterPark Place", "Toronto – RBC Centre", "Montreal", "Halifax"];
const SEED: Partial<Record<Theme, number[]>> = {
  //                   week: 1   2   3   4
  "scope-unclear":     [31, 14,  6,  4],
  "tooling-access":    [18, 41, 12,  5],
  "who-to-ask":        [22, 17,  9,  6],
  "no-work-idle":      [ 2,  6, 11, 15],
  "social-connection": [12,  9,  7,  6],
  "role-mismatch":     [ 1,  4,  8,  9],
  onboarding:          [26,  8,  2,  1],
  "career-growth":     [ 3,  5,  7, 10],
};

(function seed() {
  let i = 0;
  for (const theme of THEMES) {
    (SEED[theme] ?? []).forEach((count, w) => {
      for (let n = 0; n < count; n++) {
        // Skew toward Toronto hubs; Halifax stays small so it gets suppressed.
        const hub = HUBS[[0, 0, 1, 1, 0, 1, 2, 0, 1, 3][i++ % 10]];
        signals.push({ theme, week: w + 1, hub });
      }
    });
  }
  const groups = { "Enterprise AI Group": 9, "Data Platform": 6, "Digital Banking": 3, "Risk Analytics": 7 };
  for (const [group, n] of Object.entries(groups)) {
    for (let k = 0; k < n; k++) capacity.push({ group, week: 2 + (k % 2) });
  }
  const seededAsks: Array<[string, Theme]> = [
    ["U_SEED_1", "who-to-ask"],
    ["U_SEED_2", "role-mismatch"],
  ];
  for (const [userId, theme] of seededAsks) {
    followUps.push({ userId, theme, week: 2, hub: "Montreal", at: new Date().toISOString() });
  }
})();
