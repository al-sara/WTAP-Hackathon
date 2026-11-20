import type { SlackEvent } from "@slack/web-api";
import {
  assistantThreadMessage,
  handleNewAssistantMessage,
} from "../lib/handle-messages";
import { waitUntil } from "@vercel/functions";
import { handleNewAppMention } from "../lib/handle-app-mention";
import { isValidSlackRequest, getBotId } from "../lib/slack-utils";
import { handleConsentAction } from "../lib/consent";
import { publishHome } from "../lib/app-home";

/**
 * Single endpoint for Slack Events AND Interactivity (point both Request URLs
 * at /api/events). Keeping them in one function means button clicks and the
 * App Home dashboard share the same in-memory store in the MVP.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  // Interactivity payloads arrive form-encoded as `payload=<json>`.
  const isInteraction = (request.headers.get("content-type") ?? "").includes(
    "application/x-www-form-urlencoded",
  );
  const payload = isInteraction
    ? JSON.parse(new URLSearchParams(rawBody).get("payload") ?? "{}")
    : JSON.parse(rawBody);

  // See https://api.slack.com/events/url_verification
  if (payload.type === "url_verification") {
    return new Response(payload.challenge, { status: 200 });
  }

  if (!(await isValidSlackRequest({ request, rawBody }))) {
    return new Response("Invalid request", { status: 400 });
  }

  try {
    if (isInteraction) {
      if (payload.type === "block_actions") {
        waitUntil(handleConsentAction(payload));
      }
      return new Response("", { status: 200 });
    }

    if (payload.type !== "event_callback") {
      return new Response("Ignored", { status: 200 });
    }

    // Slack retries if we're slow (cold start); the first delivery is already
    // being handled, so don't answer twice.
    if (request.headers.get("x-slack-retry-num")) {
      return new Response("Retry ignored", { status: 200 });
    }

    const botUserId = await getBotId();
    const event = payload.event as SlackEvent;

    if (event.type === "app_mention") {
      waitUntil(handleNewAppMention(event, botUserId));
    }

    if (event.type === "assistant_thread_started") {
      waitUntil(assistantThreadMessage(event));
    }

    if (event.type === "app_home_opened" && event.tab === "home") {
      waitUntil(publishHome(event.user));
    }

    if (
      event.type === "message" &&
      !event.subtype &&
      event.channel_type === "im" &&
      !event.bot_id &&
      !event.bot_profile &&
      event.bot_id !== botUserId
    ) {
      waitUntil(handleNewAssistantMessage(event, botUserId));
    }

    return new Response("Success!", { status: 200 });
  } catch (error) {
    console.error("Error handling Slack request", error);
    return new Response("Error handling request", { status: 500 });
  }
}
