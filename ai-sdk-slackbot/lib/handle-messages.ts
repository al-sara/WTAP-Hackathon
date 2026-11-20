import type {
  AssistantThreadStartedEvent,
  GenericMessageEvent,
} from "@slack/web-api";
import type { KnownBlock } from "@slack/web-api";
import { client, getDmHistory, getThread, updateStatusUtil } from "./slack-utils";
import { generateResponse } from "./generate-response";
import { runtimeContextFromEvent } from "./policy/runtime-context";

export async function assistantThreadMessage(
  event: AssistantThreadStartedEvent,
) {
  const { channel_id, thread_ts } = event.assistant_thread;
  console.log(`Thread started: ${channel_id} ${thread_ts}`);

  await client.chat.postMessage({
    channel: channel_id,
    thread_ts: thread_ts,
    text: "Hi! I'm Compass 🧭 — your first-line mentor. Ask me anything you'd normally save for a 1:1. Chats are private unless you choose to share.",
  });

  await client.assistant.threads.setSuggestedPrompts({
    channel_id: channel_id,
    thread_ts: thread_ts,
    prompts: [
      {
        title: "I'm stuck",
        message:
          "My AI project needs an LLM API but my team only has old Copilot. Who can help?",
      },
      {
        title: "I have nothing to do",
        message: "I finished my tasks and have nothing to do this week. I know Python and SQL.",
      },
      {
        title: "Find a lunch buddy",
        message: "Anyone around WaterPark who likes matcha and wants to grab lunch?",
      },
      {
        title: "Is this my job?",
        message:
          "I'm an AI/ML co-op but I've mostly been updating Excel reports. Is this what I signed up for?",
      },
    ],
  });
}

export async function handleNewAssistantMessage(
  event: GenericMessageEvent,
  botUserId: string,
) {
  if (event.bot_id || event.bot_id === botUserId || event.bot_profile) return;

  // Plain DM in the Messages tab (not the AI-assistant pane): no thread.
  if (!event.thread_ts) return handlePlainDm(event, botUserId);

  const { thread_ts, channel } = event;
  const updateStatus = updateStatusUtil(channel, thread_ts);
  const runtimeContext = runtimeContextFromEvent({ channel, user: event.user });
  await updateStatus("is thinking...");
  try {
    const messages = await getThread(channel, thread_ts, botUserId);
    const { text, blocks } = await generateResponse(messages, runtimeContext, updateStatus);

    await client.chat.postMessage({
      channel: channel,
      thread_ts: thread_ts,
      text,
      unfurl_links: false,
      blocks,
    });
  } catch (error) {
    console.error("Error handling assistant message", error);
    await client.chat.postMessage({
      channel,
      thread_ts,
      text: "⚠️ I couldn't answer that just now (the AI service may be busy). Please try again in a moment.",
    });
  } finally {
    // Always clear the "is thinking..." status, even on failure.
    await updateStatus("");
  }
}

/**
 * A normal DM (Messages tab). Posts a placeholder, then edits it into the
 * answer. Uses the last few DM messages as context.
 */
async function handlePlainDm(event: GenericMessageEvent, botUserId: string) {
  const { channel } = event;
  const runtimeContext = runtimeContextFromEvent({ channel, user: event.user });
  const placeholder = await client.chat.postMessage({ channel, text: "_🧭 thinking..._" });
  const ts = placeholder.ts as string;
  const update = (text: string, blocks?: KnownBlock[]) =>
    client.chat.update({ channel, ts, text, ...(blocks ? { blocks } : {}) });

  try {
    const messages = await getDmHistory(channel, botUserId, ts);
    const { text, blocks } = await generateResponse(messages, runtimeContext, (s) =>
      update(`_🧭 ${s}_`).then(() => undefined),
    );
    await update(text, blocks);
  } catch (error) {
    console.error("Error handling DM", error);
    await update(
      "⚠️ I couldn't answer that just now (the AI service may be busy). Please try again in a moment.",
    );
  }
}
