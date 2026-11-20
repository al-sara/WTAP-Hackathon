import { generateText, stepCountIs, type ModelMessage } from "ai";
import { fallbackModel, model } from "./model";
import { buildTools } from "./tools";
import type { Theme } from "./data/seed";

export type ToolStatus = "used" | "denied" | "failed";

export interface ToolOutcome {
  toolName: string;
  status: ToolStatus;
  /** Policy reason (denied) or error text (failed). */
  reason?: string;
}

export interface AgentResult {
  text: string;
  /** One entry per tool call, in order, with its outcome. */
  outcomes: ToolOutcome[];
  /** Themes of the tools that actually ran — drives the consent buttons. */
  themes: Theme[];
}

export async function runAgent(opts: {
  messages: ModelMessage[];
  runtimeContext: unknown;
  // The OPA-backed approval fn is loaded dynamically (lib/policy/load.ts), so
  // it's untyped at this boundary; generateText expects ToolApprovalConfiguration.
  toolApproval: any;
  updateStatus?: (status: string) => void;
}): Promise<AgentResult> {
  const { messages, runtimeContext, toolApproval, updateStatus } = opts;
  const themes = new Set<Theme>();

  const run = (m: typeof model, timeoutMs: number) => generateText({
    model: m,
    system: `You are Compass, an always-on first-line mentor in Slack for RBC Tech & Operations early talent (co-ops and new grads, usually in their first job). Mentors and managers have little time; you help students get unstuck, connect with each other, and make sure their voice reaches the Early Talent team.

How to respond:
- Warm, encouraging, concise. Slack formatting: short bullets, *bold* sparingly. No headings.
- For greetings/small talk, reply briefly and offer what you can help with — no tool.
- Otherwise pick exactly the tool that fits the intent:
  - findHelp: stuck/blocked on a tool, access, codebase, task, or "who owns X".
  - logCapacity: idle, nothing to do, waiting on work, spare time.
  - findPeers: wants to meet people, lunch/coffee buddy, someone who shares an interest/skill.
  - compareToJD: "is this what I signed up for?", work doesn't match the role, career direction.
- Always set the tool's \`theme\` to the best-fitting category.
- \`fromSlack\` results are real public Slack messages. Lead with people where \`claimsExpertise\` is true (e.g. "Alex said in #cpp-help they're happy to help with C++"), cite the channel and date, and briefly quote what they said. Prefer them over generic suggestions when relevant.
- ONLY name people, channels, repos, docs and events that appear in tool results. Never invent any. If results are empty, say so and suggest #early-talent-help.
- Give a concrete first step (e.g. which channel to post in and a one-line draft message they can send).
- You never message anyone on the student's behalf — the student reaches out themselves. Pairings need both managers to approve.
- Do not tag users.
- If a tool call is denied by policy, relay the reason verbatim and do not substitute your own answer.
- Current date: ${new Date().toISOString().split("T")[0]}.`,
    messages,
    stopWhen: stepCountIs(5),
    // Two attempts of 55s fit inside maxDuration (120s, vercel.json); fail fast instead of retrying
    // through a long provider outage (Gemini returns 503 under load).
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(timeoutMs),
    runtimeContext,
    toolApproval,
    tools: buildTools(updateStatus, (t) => themes.add(t)),
  });

  let result: Awaited<ReturnType<typeof run>>;
  try {
    result = await run(model, 55_000);
  } catch (error) {
    if (!fallbackModel) throw error;
    console.warn("Primary model failed, trying fallback:", (error as Error).message);
    themes.clear();
    result = await run(fallbackModel, 55_000);
  }

  // Classify every tool outcome across all steps. We walk `step.content` (the
  // complete per-step part list) rather than `result.response.messages`, which
  // only holds the final step's text. The shapes differ by outcome:
  //   - success: a `tool-result` part (output.type json/text/...)
  //   - tool error: a `tool-result` part with output.type error-text/error-json
  //   - policy denial: a `tool-approval-response` part with approved === false
  //     (no tool-result is produced) — carries the policy reason.
  const outcomes: ToolOutcome[] = [];
  for (const step of result.steps ?? []) {
    for (const part of (step.content ?? []) as any[]) {
      if (part?.type === "tool-result") {
        const outputType = part.output?.type;
        if (outputType === "error-text" || outputType === "error-json") {
          const value = part.output.value ?? "unknown error";
          outcomes.push({
            toolName: part.toolName,
            status: "failed",
            reason: typeof value === "string" ? value : JSON.stringify(value),
          });
        } else {
          outcomes.push({ toolName: part.toolName, status: "used" });
        }
      } else if (part?.type === "tool-approval-response" && part.approved === false) {
        outcomes.push({
          toolName: part.toolCall?.toolName ?? "tool",
          status: "denied",
          reason: part.reason,
        });
      }
    }
  }

  return { text: result.text, outcomes, themes: [...themes] };
}
