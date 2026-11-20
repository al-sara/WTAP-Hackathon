# Policy for Compass, the early-talent Slack bot.
#
# Two kinds of actions go through this one decision:
#   1. Every tool call the LLM makes (findHelp, findPeers, logCapacity,
#      compareToJD) — via the AI SDK's @ai-sdk/policy-opa adapter.
#   2. The consent gate ("shareSignal") — evaluated directly by lib/consent.ts
#      when a student clicks "Share anonymously" / "Ask Early Talent to follow up".
#
# Compiled to WASM with:  pnpm policy:build     Tests:  pnpm policy:test
#
# Input shape:
#   {
#     "tool":    { "name": <string> },
#     "args":    <tool input>,
#     "messages":[...],                              # tool calls only
#     "runtimeContext": { "channelId", "userId" }
#   }
#
# Decision shape: { "decision": "allow" | "deny", "reason": <optional string> }

package agent.call

import rego.v1

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Must match THEMES in lib/data/seed.ts. Anonymous sharing can only ever carry
# one of these labels — never free text.
allowed_themes := {
	"tooling-access", "scope-unclear", "who-to-ask", "no-work-idle",
	"role-mismatch", "social-connection", "career-growth", "onboarding",
}

# The ONLY fields an anonymous share may contain. No names, no message text.
anonymous_fields := {"mode", "theme", "week", "hub"}

# Follow-up adds who the student chose to be contacted by.
follow_up_fields := anonymous_fields | {"followUpWith"}

follow_up_recipients := {"early-talent", "mentor", "manager"}

# Read-only lookups over sources students can already see.
read_only_tools := {"findHelp", "findPeers", "compareToJD"}

# ---------------------------------------------------------------------------
# Top-level entrypoint. Default-deny: any tool without a rule below is denied.
# In particular, there is deliberately NO tool that sends messages to other
# people — the bot never contacts anyone on a student's behalf.
# ---------------------------------------------------------------------------

default decision := {"decision": "deny", "reason": "This action is not permitted by policy."}

decision := {"decision": "allow"} if input.tool.name in read_only_tools

decision := log_capacity_decision if input.tool.name == "logCapacity"

decision := share_signal_decision if input.tool.name == "shareSignal"

# ---------------------------------------------------------------------------
# logCapacity: "I have nothing to do" is sensitive — only record it from a
# private DM with the bot, never from a public channel mention.
# Slack DM channel IDs start with "D".
# ---------------------------------------------------------------------------

log_capacity_decision := {"decision": "allow"} if {
	startswith(input.runtimeContext.channelId, "D")
} else := {
	"decision": "deny",
	"reason": "To protect your privacy I only log capacity in a direct message with me — DM me and I'll help find work that fits your skills.",
}

# ---------------------------------------------------------------------------
# shareSignal (consent gate)
# ---------------------------------------------------------------------------

share_signal_decision := {"decision": "allow"} if {
	input.args.mode == "anonymous"
	valid_common
	object_keys(input.args) - anonymous_fields == set()
} else := {"decision": "allow"} if {
	input.args.mode == "follow-up"
	valid_common
	object_keys(input.args) - follow_up_fields == set()
	input.args.followUpWith in follow_up_recipients
} else := {
	"decision": "deny",
	"reason": "Only a topic, week and hub can be shared — nothing else leaves your chat.",
}

valid_common if {
	input.args.theme in allowed_themes
	is_number(input.args.week)
	is_string(input.args.hub)
}

object_keys(o) := {k | some k, _ in o}
