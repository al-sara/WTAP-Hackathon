import { ModelMessage } from "ai";
import type { KnownBlock } from "@slack/web-api";
import { loadToolApproval } from "./policy/load";
import { runAgent, type ToolOutcome } from "./run-agent";
import { SlackRuntimeContext } from "./policy/runtime-context";
import { consentBlocks } from "./consent";

export interface BotReply {
  text: string;
  blocks: KnownBlock[];
}

export const generateResponse = async (
  messages: ModelMessage[],
  runtimeContext: SlackRuntimeContext,
  updateStatus?: (status: string) => void,
): Promise<BotReply> => {
  const toolApproval = await loadToolApproval();

  const { text, outcomes, themes } = await runAgent({
    messages,
    runtimeContext,
    toolApproval,
    updateStatus,
  });

  // Small "sources" footer so it's always visible which RBC sources answered.
  const footer =
    outcomes.length > 0
      ? `\n\n_🔎 ${[...new Set(outcomes.map(toolLabel))].join(", ")}_`
      : "";

  // Convert markdown to Slack mrkdwn format.
  const answer = text
    .replace(/\[(.*?)\]\((.*?)\)/g, "<$2|$1>")
    .replace(/\*\*/g, "*");

  // Policy denials / tool errors: surface the reason verbatim in the body.
  const problemNotes = outcomes
    .filter((o) => o.status !== "used")
    .map((o) => o.reason ?? `${o.toolName} ${o.status}`);
  const anySuccess = outcomes.some((o) => o.status === "used");

  let body: string;
  if (problemNotes.length > 0 && !anySuccess) {
    // Nothing ran → show only the reason(s), never possibly-confabulated text.
    body = problemNotes.join("\n");
  } else if (problemNotes.length > 0) {
    body = [answer, ...problemNotes].join("\n\n");
  } else {
    body = answer || "Sorry, I couldn't come up with an answer — try rephrasing?";
  }
  body += footer;

  const blocks: KnownBlock[] = [
    // Section text is capped at 3000 chars by Slack.
    { type: "section", text: { type: "mrkdwn", text: body.slice(0, 2990) } },
  ];
  // Consent gate: only offered when a tool actually ran and classified a need.
  if (themes.length > 0 && runtimeContext.userId) {
    blocks.push(...consentBlocks(themes[0], runtimeContext.userId));
  }

  return { text: body, blocks };
};

function toolLabel(outcome: ToolOutcome): string {
  if (outcome.status === "used") return outcome.toolName;
  const suffix = outcome.status === "denied" ? "blocked by policy" : "failed";
  return `${outcome.toolName} (${suffix})`;
}
