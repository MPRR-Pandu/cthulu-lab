---
name: incident-response
description: Guide through production incident response — triage, diagnose, fix, postmortem. Use when production is down or degraded.
---

# Incident Response

## When to Use
- Production outage or degradation
- Error rate spike
- Customer-reported issues at scale

## Severity Levels

| Level | Definition | Response Time |
|-------|-----------|---------------|
| SEV1 | Service down, all users affected | Immediate |
| SEV2 | Major feature broken, many users affected | 30 min |
| SEV3 | Minor feature broken, some users affected | 4 hours |
| SEV4 | Cosmetic issue, workaround exists | Next sprint |

## Response Process

### 1. Triage (5 min)
- What's broken? (symptom)
- Who's affected? (scope)
- When did it start? (timeline)
- What changed recently? (deploys, config changes)

### 2. Diagnose (15 min)
- Check error logs and monitoring
- Check recent deployments
- Check external dependencies (APIs, databases)
- Reproduce if possible

### 3. Fix
- **Option A:** Rollback last deploy
- **Option B:** Hotfix and deploy
- **Option C:** Feature flag disable

### 4. Postmortem
- Timeline of events
- Root cause
- Impact (users, revenue, data)
- Action items to prevent recurrence

## Rules
- Fix first, investigate later
- Communicate status every 15 min during SEV1/2
- Don't deploy unrelated changes during incident
- Always write a postmortem for SEV1/2
