---
name: activity-log
description: Log structured activity events for agent work, deployments, reviews, and errors.
---

# Activity Log

Event types: `task_started`, `task_completed`, `task_failed`, `agent_delegated`, `review_passed`, `review_failed`, `deployed`, `error`.

Format: `[ISO-8601 timestamp] [event_type] [agent_name] [details]`

Rules: one line per event. Machine-parseable (space-separated fields, timestamp first). Human-readable details in plain English. Always include: what happened, who did it, what changed. Timestamps in UTC ISO-8601. Agent name must match role identifier.
