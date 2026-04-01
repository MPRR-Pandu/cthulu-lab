---
name: activity-log
description: Log structured activity events for agent work, deployments, reviews, and errors. Use whenever recording what happened.
---

# Activity Log

## When to Use
- Recording task starts, completions, or failures
- Logging agent delegations and handoffs
- Tracking reviews, deployments, and errors
- Any event that should be auditable later

## Instructions

1. Determine the event type from the allowed list
2. Format as a single structured log line
3. Append to the activity log file or output to the caller

## Event Types

- `task_started` — work begins on a task
- `task_completed` — task finished successfully
- `task_failed` — task failed with error
- `agent_delegated` — work handed off to another agent
- `review_passed` — code review approved
- `review_failed` — code review rejected
- `deployed` — code shipped to an environment
- `error` — unexpected error occurred

## Output Format

```
[ISO-8601 timestamp] [event_type] [agent_name] [details]
```

Examples:
```
2026-04-01T10:30:00Z task_started lead Planning auth module
2026-04-01T10:45:00Z agent_delegated lead→backend Implement JWT middleware
2026-04-01T11:20:00Z task_completed backend JWT middleware done, 3 files changed
2026-04-01T11:25:00Z review_passed lead Backend auth looks good
2026-04-01T11:30:00Z deployed lead Auth module shipped to staging
2026-04-01T11:35:00Z error backend Redis connection timeout in auth cache
```

## Rules
- One line per event. No multiline entries.
- Machine-parseable: fields separated by spaces, timestamp always first.
- Human-readable: details in plain English.
- Always include: what happened, who did it, what changed.
- Timestamps in UTC ISO-8601 format.
- Agent name must match the agent's role identifier.
