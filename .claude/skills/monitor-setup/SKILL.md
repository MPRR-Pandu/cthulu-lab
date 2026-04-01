---
name: monitor-setup
description: Set up monitoring, alerting, and observability — health checks, error tracking, metrics, dashboards. Use when deploying or improving reliability.
---

# Monitoring Setup

## When to Use
- New service deployment
- Improving observability
- Setting up alerting
- After a production incident

## Core Metrics (USE/RED)

### For Services (RED)
- **Rate:** requests per second
- **Errors:** error rate / error count
- **Duration:** latency p50/p95/p99

### For Resources (USE)
- **Utilization:** CPU, memory, disk %
- **Saturation:** queue depth, thread pool
- **Errors:** hardware/software errors

## Health Check Endpoint

```typescript
app.get('/health', (req, res) => {
  const checks = {
    status: 'ok',
    uptime: process.uptime(),
    database: await db.ping() ? 'ok' : 'down',
    timestamp: new Date().toISOString(),
  };
  const healthy = checks.database === 'ok';
  res.status(healthy ? 200 : 503).json(checks);
});
```

## Alerting Rules

| Alert | Condition | Severity |
|-------|-----------|----------|
| Service down | health check fails 3x | Critical |
| High error rate | >5% 5xx in 5 min | High |
| Slow responses | p95 > 2s for 5 min | Medium |
| Disk full | >90% usage | High |
| Memory leak | RSS growing >10%/hr | Medium |

## Rules
- Every service needs a /health endpoint
- Alert on symptoms (error rate), not causes (CPU)
- Include runbook link in every alert
- Set up on-call rotation for critical alerts
- Log structured JSON (not plain text)
