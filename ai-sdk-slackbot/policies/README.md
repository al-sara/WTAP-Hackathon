# Slackbot policies

This directory holds the Rego policies that decide whether the bot is allowed
to run a given tool call. You can edit `decision.rego` without touching any
TypeScript — the bot loads it on each request (dev) or as a compiled WASM
bundle (prod).

## Input shape

Every tool call is evaluated as a separate decision. The `input` document
the policy sees looks like this:

```jsonc
{
  "tool":    { "name": "findHelp" },         // tool the model wants to run
  "args":    { "keywords": ["llm"], "theme": "tooling-access" },
  "messages":[                                // full chat history so far
    { "role": "user", "content": "..." }
  ],
  "runtimeContext": {                         // set by the bot per request
    "channelId":   "C0B6YBUHMME",             // raw Slack channel ID
    "userId":      "U0123ABCD"
  }
}
```

`logCapacity` gates on the immutable `channelId` (DMs start with `D`). The
consent gate (`shareSignal`) is evaluated with the same input shape by
`lib/consent.ts` when a student clicks a sharing button.

Return one of:

| decision              | effect                                                |
|-----------------------|-------------------------------------------------------|
| `allow`               | tool executes                                         |
| `deny`                | tool is blocked; `reason` shown to the model & user   |
| `requires-approval`   | bot pauses for a human (not wired up in this repo)    |
| `not-applicable`      | rule has no opinion; falls through to allow           |

## Adding a new rule

Copy this skeleton into `decision.rego`:

```rego
decision := {
    "decision": "deny",
    "reason":   "short user-facing message"
} if {
    input.tool.name == "yourToolName"
    # ...your condition here...
}
```

Pair it with an allow rule (or rely on the `not-applicable` default).

## Running tests

```sh
opa test policies/
```

Each rule should have at least one positive and one negative test in
`decision_test.rego`. Tests are pure Rego — no Node, no bot, no network.

## Modes

| `POLICY_MODE` | client                 | source of truth                 | reload    |
|---------------|------------------------|---------------------------------|-----------|
| `wasm` (default) | `wasmPolicyClient`  | `policies/policy.wasm`          | rebuild   |
| `http`        | `httpPolicyClient`     | OPA server reading `./policies` | live      |

### wasm (default — no extra process)

```sh
pnpm policy:build       # opa build -t wasm -e agent/call/decision -> policies/policy.wasm
# start the bot — POLICY_MODE doesn't need to be set
```

`pnpm build` runs `policy:build` automatically, so this is the no-config path.
After editing `decision.rego`, run `pnpm policy:build` and restart.

### http (live policy reload during iteration)

```sh
opa run --server --addr :8181 ./policies
POLICY_MODE=http pnpm dev
```

Edit `decision.rego`. The next tool call uses the new rule — no rebuild,
no restart.

## Limitations

These policies gate **tool calls** — whether a tool runs and with what input —
not the model's free-text output. A rule like `searchWeb` (only `vercel.com`)
guarantees the *search* is scoped, but it cannot stop the model from answering
from its own training knowledge if the scoped search returns nothing. The system
prompt asks the model to answer only from tool results; that's best-effort, not
enforced. A hard "only answer from allowed sources" guarantee needs output-side
validation (verifying the answer is supported by the tool results), which lives
above the policy layer.

In short: this pattern is a strong fit for **deterministic, inspectable tool
calls** — `git`/`bash`, file writes, Slack/MCP actions — where allowing the call
fully bounds the effect. It's a weaker fit for **content-oriented tools** (web
search and similar) where the risk is in the nuanced text the model produces, not
in the call itself.
