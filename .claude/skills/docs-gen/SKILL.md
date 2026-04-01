---
name: docs-gen
description: Generate technical documentation — README, API docs, architecture diagrams, onboarding guides. Use when code needs documentation.
---

# Documentation Generator

## When to Use
- New project needs a README
- API endpoints need documentation
- Architecture decisions need recording
- Team onboarding guide needed

## Document Types

### README.md
- Project name and one-line description
- Quick start (3 commands max)
- Prerequisites
- Installation
- Usage examples
- Contributing guide link
- License

### API Documentation
- Endpoint, method, description
- Request/response examples
- Auth requirements
- Error codes
- Rate limits

### Architecture Decision Record (ADR)
- Title, date, status
- Context (why)
- Decision (what)
- Consequences (trade-offs)

## Rules
- Keep README under 200 lines
- Include copy-pasteable commands
- Every API endpoint needs a curl example
- Use diagrams for architecture (mermaid syntax)
- Write for someone who's never seen the project
