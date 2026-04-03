---
name: sprint-planner
description: Break features into sprint tasks with estimates, dependencies, and acceptance criteria.
---

# Sprint Planner

1. Read the feature/epic description
2. Explore codebase to understand architecture
3. Break into tasks completable in 1-3 hours
4. For each task: files to modify, dependencies, risk level

Output table: `| # | Task | Files | Est | Depends | Risk |` plus total estimate and critical path.

Rules: tasks >3h must split further. Every task needs file paths. Flag shared-code tasks as high risk. Include testing tasks.
