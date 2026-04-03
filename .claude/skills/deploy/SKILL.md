---
name: deploy
description: Generate deployment configs, CI/CD pipelines, Dockerfiles, and checklists.
---

# Deploy

1. Identify tech stack and target platform
2. Check existing deployment configs
3. Generate/modify configs following platform best practices
4. Include health checks, rollback strategy, monitoring

Pre-deploy checklist: tests pass, no secrets in code, migrations ready, rollback plan, health endpoint, env vars set.

Rules: multi-stage Docker builds, pin dependency versions (no `latest`), health check endpoints required, secrets via env vars or secret managers, include rollback instructions.
