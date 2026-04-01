---
name: deploy
description: Generate deployment configs, CI/CD pipelines, Dockerfiles, and deployment checklists. Use when setting up or modifying deployment infrastructure.
---

# Deploy

## When to Use
- Setting up CI/CD pipeline
- Creating Dockerfiles
- Writing deployment scripts
- Pre-deployment checklist

## Instructions

1. Identify the tech stack and target platform
2. Check existing deployment configs (Dockerfile, .github/workflows, etc.)
3. Generate or modify configs following the platform's best practices
4. Include health checks, rollback strategy, and monitoring

## Supported Platforms
- **Docker** — multi-stage builds, minimal images
- **GitHub Actions** — CI/CD workflows
- **Vercel/Netlify** — frontend deployments
- **AWS/GCP/Azure** — cloud deployments
- **Kubernetes** — k8s manifests

## Pre-Deploy Checklist
- [ ] All tests pass
- [ ] No secrets in code (use env vars)
- [ ] Database migrations ready
- [ ] Rollback plan documented
- [ ] Health check endpoint exists
- [ ] Error monitoring configured
- [ ] Environment variables set in target

## Rules
- Always use multi-stage Docker builds
- Pin dependency versions (no `latest` tags)
- Include health check endpoints
- Never store secrets in configs — use env vars or secret managers
- Include rollback instructions in every deploy script
