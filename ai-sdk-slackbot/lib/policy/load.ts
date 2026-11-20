import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  opaPolicy,
  httpPolicyClient,
  wasmPolicyClient,
  normalizeOpaDecision,
  type PolicyClient,
  type PolicyDecision,
} from "@ai-sdk/policy-opa";

const POLICY_PATH = "agent/call/decision";

// Resolved relative to this file so it works regardless of process cwd.
const DEFAULT_WASM_PATH = path.resolve(__dirname, "../../policies/policy.wasm");

let cachedClient: Promise<PolicyClient> | undefined;
let cachedApproval: Promise<any> | undefined;

function getClient(): Promise<PolicyClient> {
  if (!cachedClient) {
    cachedClient = buildClient();
    // Don't cache a rejection (e.g. missing policy.wasm): reset so the next
    // request retries instead of failing for the process lifetime.
    cachedClient.catch(() => {
      cachedClient = undefined;
    });
  }
  return cachedClient;
}

/** Tool-call gate for generateText (every model tool call is checked). */
export function loadToolApproval(): Promise<any> {
  if (!cachedApproval) {
    cachedApproval = getClient().then((client) =>
      opaPolicy({ client, path: POLICY_PATH, toInput }),
    );
    cachedApproval.catch(() => {
      cachedApproval = undefined;
    });
  }
  return cachedApproval;
}

/**
 * Evaluate the same policy for a non-model action (e.g. a consent-button
 * click). Same input shape as tool calls: { tool: {name}, args, runtimeContext }.
 */
export async function evaluatePolicy(input: {
  tool: { name: string };
  args: unknown;
  runtimeContext: unknown;
}): Promise<PolicyDecision> {
  const client = await getClient();
  return normalizeOpaDecision(await client.evaluate(POLICY_PATH, input));
}

async function buildClient(): Promise<PolicyClient> {
  // Default to WASM (in-process, no extra server). Set POLICY_MODE=http with
  // a running `opa run --server :8181` for live policy reloads during dev.
  if ((process.env.POLICY_MODE ?? "wasm") === "http") {
    return httpPolicyClient({
      url: process.env.OPA_URL ?? "http://localhost:8181",
    });
  }
  const wasm = await readFile(process.env.POLICY_WASM_PATH ?? DEFAULT_WASM_PATH);
  return wasmPolicyClient({ wasm });
}

// Default OPA input shape (mirrors @ai-sdk/policy-opa's DefaultOpaInput).
function toInput(args: {
  toolCall: { toolName: string; input: unknown };
  runtimeContext: unknown;
  messages: unknown;
}) {
  const { toolCall, runtimeContext, messages } = args;
  return {
    tool: { name: toolCall.toolName },
    args: toolCall.input,
    messages,
    runtimeContext,
  };
}
