/**
 * Local dev server: runs the same handler Vercel runs (api/events.ts) on
 * http://localhost:3000/api/events, so you can test without deploying.
 *
 *   pnpm dev                                   # loads .env
 *   cloudflared tunnel --url http://localhost:3000   # public URL for Slack
 *
 * Outside Vercel, `waitUntil` is a no-op — fine here, because this process
 * stays alive and the background work just keeps running.
 */
import { createServer } from "node:http";
import { GET, POST } from "../api/events";

const PORT = Number(process.env.PORT ?? 3000);

createServer(async (req, res) => {
  // HR dashboard: /dashboard (page) and /dashboard?format=json (data).
  if (req.method === "GET" && req.url?.startsWith("/dashboard")) {
    const response = await GET(new Request(`http://localhost:${PORT}${req.url}`));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
    return;
  }
  if (req.method !== "POST" || !req.url?.startsWith("/api/events")) {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("Compass dev server is running. Slack → /api/events · HR dashboard → /dashboard");
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = Buffer.concat(chunks).toString("utf8");

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === "string") headers.set(k, v);
  }

  const started = Date.now();
  try {
    const response = await POST(
      new Request(`http://localhost:${PORT}${req.url}`, { method: "POST", headers, body }),
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
    console.log(`POST ${req.url} [${describe(body)}] → ${response.status} (${Date.now() - started}ms)`);
  } catch (error) {
    console.error("Handler crashed:", error);
    res.writeHead(500);
    res.end("error");
  }
}).listen(PORT, () => {
  console.log(`Compass listening on http://localhost:${PORT}/api/events`);
  console.log(`HR dashboard:        http://localhost:${PORT}/dashboard`);
});

/** "event_callback:message" / "block_actions" / "url_verification" for the log. */
function describe(body: string): string {
  try {
    const p = body.startsWith("payload=")
      ? JSON.parse(new URLSearchParams(body).get("payload") ?? "{}")
      : JSON.parse(body);
    const e = p.event ?? {};
    const extra = [
      e.subtype && `subtype=${e.subtype}`,
      e.user && `user=${e.user}`,
      e.bot_id && `bot=${e.bot_id}`,
      e.channel && `ch=${e.channel}`,
      e.thread_ts && "threaded",
      typeof e.text === "string" && `text="${e.text.slice(0, 30)}"`,
    ].filter(Boolean);
    return [p.type, e.type, e.channel_type].filter(Boolean).join(":") + (extra.length ? " " + extra.join(" ") : "");
  } catch {
    return "?";
  }
}
