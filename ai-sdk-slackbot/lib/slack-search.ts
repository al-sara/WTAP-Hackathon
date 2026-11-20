import { client } from "./slack-utils";

/**
 * Searches recent messages in the workspace's PUBLIC channels for people who
 * talk about a topic — ranking self-declared expertise ("I'm an expert in X",
 * "happy to help with X", "ask me about X") highest.
 *
 * Bot tokens can't use Slack's search API, so we keep a small in-memory index:
 * list public channels, auto-join them, pull recent history, refresh every
 * couple of minutes. Public channels only — never DMs or private channels.
 *
 * Needs bot scopes: channels:read, channels:join, channels:history, users:read.
 * If any are missing this returns [] and the bot answers from seed data only.
 */

const LOOKBACK_DAYS = 90;
const MAX_CHANNELS = 50;
const PER_CHANNEL = 200;
const TTL_MS = 2 * 60 * 1000;

interface IndexedMessage {
  channel: string; // "#name"
  userId: string;
  text: string;
  ts: string;
}

export interface SlackHit {
  who: string;
  channel: string;
  date: string;
  snippet: string;
  /** The person said they know this topic / offered help. */
  claimsExpertise: boolean;
}

// Phrases that signal "I know this / I can help" — weighted heavily.
const EXPERTISE =
  /\b(i'?m (an? )?(expert|pro|specialist)|expert (in|at|on|with)|i know (a lot|my way|how)|years? of experience|experience (with|in)|i'?ve (worked|built|used|done)|happy to help|ask me|dm me|ping me|reach out|i can help|feel free to (ask|reach|dm|ping)|i specialize|my (specialty|expertise))\b/i;

let index: { at: number; messages: IndexedMessage[] } | undefined;
let building: Promise<IndexedMessage[]> | undefined;
// After a missing-scope error, wait before retrying (picks up a reinstall).
let disabledUntil = 0;
const names = new Map<string, string>();

async function buildIndex(): Promise<IndexedMessage[]> {
  const { user_id: botUserId } = await client.auth.test();
  const list = await client.conversations.list({
    types: "public_channel",
    exclude_archived: true,
    limit: 200,
  });
  const channels = (list.channels ?? []).slice(0, MAX_CHANNELS);
  const oldest = String(Date.now() / 1000 - LOOKBACK_DAYS * 86400);

  const perChannel = await Promise.all(
    channels.map(async (c) => {
      try {
        if (!c.is_member) await client.conversations.join({ channel: c.id! });
        const h = await client.conversations.history({ channel: c.id!, limit: PER_CHANNEL, oldest });
        return (h.messages ?? [])
          .filter((m) => m.user && m.text && !m.bot_id && !m.subtype && m.user !== botUserId)
          .map((m) => ({ channel: `#${c.name}`, userId: m.user!, text: m.text!, ts: m.ts! }));
      } catch (e) {
        console.warn(`slack-search: skipping #${c.name}:`, (e as any)?.data?.error ?? e);
        return [];
      }
    }),
  );
  return perChannel.flat();
}

async function getIndex(): Promise<IndexedMessage[]> {
  if (Date.now() < disabledUntil) return [];
  if (index && Date.now() - index.at < TTL_MS) return index.messages;
  if (!building) {
    building = buildIndex()
      .then((messages) => {
        index = { at: Date.now(), messages };
        return messages;
      })
      .catch((e) => {
        const err = (e as any)?.data;
        if (err?.error === "missing_scope") {
          disabledUntil = Date.now() + 60_000;
          console.warn(`slack-search paused: missing scope ${err.needed}. Add it in OAuth & Permissions and reinstall.`);
        } else {
          console.warn("slack-search: index build failed:", err?.error ?? e);
        }
        return index?.messages ?? [];
      })
      .finally(() => {
        building = undefined;
      });
  }
  return building;
}

async function nameOf(userId: string): Promise<string> {
  if (names.has(userId)) return names.get(userId)!;
  try {
    const { user } = await client.users.info({ user: userId });
    const n = user?.profile?.display_name || user?.real_name || user?.name || "a teammate";
    names.set(userId, n);
    return n;
  } catch {
    return "a teammate";
  }
}

/** Plain text for the model: strip Slack markup like <@U123>, <#C1|name>, <url|label>. */
function clean(text: string): string {
  return text
    .replace(/<@[A-Z0-9]+>/g, "@someone")
    .replace(/<#[A-Z0-9]+\|([^>]+)>/g, "#$1")
    .replace(/<(https?:[^|>]+)\|([^>]+)>/g, "$2")
    .replace(/<(https?:[^>]+)>/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function searchSlack(keywords: string[], limit = 4): Promise<SlackHit[]> {
  const kws = keywords.map((k) => k.toLowerCase().trim()).filter((k) => k.length > 1);
  if (kws.length === 0) return [];
  const messages = await getIndex();

  // Match whole-ish words so "c" doesn't hit everything but "c++" still works.
  const patterns = kws.map((k) => new RegExp(`(^|[^a-z0-9])${escapeRe(k)}($|[^a-z0-9])`, "i"));

  const scored = messages
    .map((m) => {
      const hits = patterns.filter((p) => p.test(m.text)).length;
      if (hits === 0) return null;
      const expert = EXPERTISE.test(m.text);
      return { m, expert, score: hits + (expert ? 3 : 0) + Number(m.ts) / 1e12 };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.score - a.score);

  // One hit per person, best first.
  const seen = new Set<string>();
  const top = scored.filter(({ m }) => !seen.has(m.userId) && seen.add(m.userId)).slice(0, limit);

  return Promise.all(
    top.map(async ({ m, expert }) => ({
      who: await nameOf(m.userId),
      channel: m.channel,
      date: new Date(Number(m.ts) * 1000).toISOString().slice(0, 10),
      snippet: clean(m.text).slice(0, 220),
      claimsExpertise: expert,
    })),
  );
}
