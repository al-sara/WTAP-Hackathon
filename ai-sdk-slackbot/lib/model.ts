import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { ollama } from "ai-sdk-ollama";
import type { LanguageModel } from "ai";

/**
 * The chat model the bot uses.
 *
 * Default: Google Gemini via the native AI SDK provider. The key is read from
 * `OPENAI_API_KEY` (it holds a Gemini key — the name is kept so the Vercel
 * template env stays the same). In production this would point at RBC's
 * in-house LLM platform instead.
 *
 * Native provider (not Gemini's OpenAI-compatible endpoint) because Gemini 3
 * models require "thought signatures" to be echoed back on tool calls, which
 * the OpenAI-compat path drops (→ 400 on the second step).
 *
 * Set `MODEL_PROVIDER=ollama` to run a local model instead (local dev only).
 */
const google = createGoogleGenerativeAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const model: LanguageModel =
  process.env.MODEL_PROVIDER === "ollama"
    ? ollama(process.env.OLLAMA_MODEL ?? "llama3.1")
    : google(process.env.OPENAI_MODEL ?? "gemini-3.1-flash-lite");

/**
 * Used when the primary model is overloaded (Gemini 503 "high demand") so a
 * live demo doesn't die on a provider blip.
 */
export const fallbackModel: LanguageModel | undefined =
  process.env.MODEL_PROVIDER === "ollama"
    ? undefined
    : google(process.env.OPENAI_FALLBACK_MODEL ?? "gemini-3.5-flash-lite");
