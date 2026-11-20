package agent.call_test

import rego.v1

import data.agent.call

# ---------- read-only tools ----------

test_find_help_allowed if {
	call.decision.decision == "allow" with input as {
		"tool": {"name": "findHelp"},
		"args": {"keywords": ["llm"], "theme": "tooling-access"},
		"runtimeContext": {"channelId": "C123", "userId": "U1"},
	}
}

test_find_peers_allowed if {
	call.decision.decision == "allow" with input as {"tool": {"name": "findPeers"}, "args": {}}
}

test_compare_jd_allowed if {
	call.decision.decision == "allow" with input as {"tool": {"name": "compareToJD"}, "args": {}}
}

# ---------- logCapacity: DM only ----------

test_log_capacity_allowed_in_dm if {
	call.decision.decision == "allow" with input as {
		"tool": {"name": "logCapacity"},
		"args": {"skills": ["python"], "theme": "no-work-idle"},
		"runtimeContext": {"channelId": "D0ABC", "userId": "U1"},
	}
}

test_log_capacity_denied_in_channel if {
	d := call.decision with input as {
		"tool": {"name": "logCapacity"},
		"args": {"skills": ["python"], "theme": "no-work-idle"},
		"runtimeContext": {"channelId": "C0ABC", "userId": "U1"},
	}
	d.decision == "deny"
	contains(d.reason, "direct message")
}

# ---------- default deny ----------

test_unknown_tool_denied if {
	call.decision.decision == "deny" with input as {"tool": {"name": "sendDirectMessage"}, "args": {}}
}

# ---------- shareSignal (consent gate) ----------

test_share_anonymous_allowed if {
	call.decision.decision == "allow" with input as {
		"tool": {"name": "shareSignal"},
		"args": {"mode": "anonymous", "theme": "tooling-access", "week": 2, "hub": "Toronto"},
	}
}

test_share_anonymous_with_name_denied if {
	d := call.decision with input as {
		"tool": {"name": "shareSignal"},
		"args": {"mode": "anonymous", "theme": "tooling-access", "week": 2, "hub": "Toronto", "userId": "U1"},
	}
	d.decision == "deny"
}

test_share_anonymous_free_text_theme_denied if {
	call.decision.decision == "deny" with input as {
		"tool": {"name": "shareSignal"},
		"args": {"mode": "anonymous", "theme": "my manager ignores me", "week": 2, "hub": "Toronto"},
	}
}

test_share_follow_up_allowed if {
	call.decision.decision == "allow" with input as {
		"tool": {"name": "shareSignal"},
		"args": {"mode": "follow-up", "theme": "role-mismatch", "week": 3, "hub": "Montreal", "followUpWith": "early-talent"},
	}
}

test_share_follow_up_bad_recipient_denied if {
	call.decision.decision == "deny" with input as {
		"tool": {"name": "shareSignal"},
		"args": {"mode": "follow-up", "theme": "role-mismatch", "week": 3, "hub": "Montreal", "followUpWith": "everyone"},
	}
}

test_share_follow_up_extra_field_denied if {
	call.decision.decision == "deny" with input as {
		"tool": {"name": "shareSignal"},
		"args": {"mode": "follow-up", "theme": "role-mismatch", "week": 3, "hub": "Montreal", "followUpWith": "early-talent", "message": "hi"},
	}
}
