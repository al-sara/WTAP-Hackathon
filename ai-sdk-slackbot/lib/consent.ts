import type { KnownBlock } from "@slack/web-api";
import { client } from "./slack-utils";
import { THEME_LABELS, defaultStudentProfile, type Theme } from "./data/seed";
import { evaluatePolicy } from "./policy/load";
import { currentWeek, recordFollowUp, recordSignal } from "./store";

/**
 * Consent gate. Default is private: nothing leaves the chat unless the student
 * clicks. "Share anonymously" stores ONLY theme + week + hub. "Follow up"
 * shares their name with Early Talent because they asked for it.
 */

export const CONSENT_ACTIONS = {
  private: "consent_private",
  anonymous: "consent_anonymous",
  followUp: "consent_follow_up",
} as const;

interface ButtonValue {
  t: Theme; // theme
  u: string; // the student who asked — only they can choose
}

export function consentBlocks(theme: Theme, userId: string): KnownBlock[] {
  const value = JSON.stringify({ t: theme, u: userId } satisfies ButtonValue);
  return [
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `🔒 This chat is private by default. Want to help fix *${THEME_LABELS[theme].toLowerCase()}* for every student?`,
        },
      ],
    },
    {
      type: "actions",
      block_id: "consent",
      elements: [
        {
          type: "button",
          action_id: CONSENT_ACTIONS.private,
          text: { type: "plain_text", text: "Keep private" },
          value,
        },
        {
          type: "button",
          action_id: CONSENT_ACTIONS.anonymous,
          style: "primary",
          text: { type: "plain_text", text: "Share anonymously" },
          value,
        },
        {
          type: "button",
          action_id: CONSENT_ACTIONS.followUp,
          text: { type: "plain_text", text: "Ask Early Talent to follow up" },
          value,
        },
      ],
    },
  ];
}

/** Handles a click on one of the consent buttons (Slack block_actions payload). */
export async function handleConsentAction(payload: any) {
  const action = payload.actions?.[0];
  if (!action || !Object.values(CONSENT_ACTIONS).includes(action.action_id)) return;

  const clicker: string = payload.user?.id;
  const channel: string = payload.channel?.id ?? payload.container?.channel_id;
  const ts: string = payload.container?.message_ts ?? payload.message?.ts;

  let value: ButtonValue;
  try {
    value = JSON.parse(action.value);
  } catch {
    return;
  }

  // Only the student who asked can decide what happens to their question.
  if (clicker !== value.u) {
    await client.chat.postEphemeral({
      channel,
      user: clicker,
      text: "Only the person who asked can choose how this is shared.",
    });
    return;
  }

  const week = currentWeek();
  const hub = defaultStudentProfile.hub;
  const label = THEME_LABELS[value.t] ?? value.t;
  let note: string;

  if (action.action_id === CONSENT_ACTIONS.private) {
    note = "🔒 Kept private — nothing left this chat.";
  } else {
    const mode = action.action_id === CONSENT_ACTIONS.anonymous ? "anonymous" : "follow-up";
    // Exactly what will be stored. The policy rejects anything else (e.g. free
    // text, names in anonymous mode, or an unknown theme).
    const args =
      mode === "anonymous"
        ? { mode, theme: value.t, week, hub }
        : { mode, theme: value.t, week, hub, followUpWith: "early-talent" };

    const decision = await evaluatePolicy({
      tool: { name: "shareSignal" },
      args,
      runtimeContext: { channelId: channel, userId: clicker },
    });

    if (decision.type !== "approved") {
      note = `⛔ Not shared: ${"reason" in decision && decision.reason ? decision.reason : "blocked by policy."}`;
    } else if (mode === "anonymous") {
      recordSignal({ theme: value.t, week, hub });
      note = `📊 Shared anonymously with Early Talent: *${label}* · week ${week} · ${hub}. No name, no message text.`;
    } else {
      recordFollowUp({ userId: clicker, theme: value.t, week, hub });
      note = `🙋 Early Talent will reach out about *${label}*. Only they see your name — your manager doesn't.`;
    }
  }

  // Replace the buttons with the outcome so the choice is visible and final.
  const original: KnownBlock[] = payload.message?.blocks ?? [];
  const kept = original.filter(
    (b: any) => b.block_id !== "consent" && !(b.type === "context" && JSON.stringify(b).includes("private by default")),
  );
  await client.chat.update({
    channel,
    ts,
    text: payload.message?.text ?? note,
    blocks: [...kept, { type: "context", elements: [{ type: "mrkdwn", text: note }] }],
  });
}
