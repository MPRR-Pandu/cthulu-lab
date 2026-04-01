---
name: sprint-planner
description: Break down features into sprint tasks with estimates, dependencies, and acceptance criteria. Use when planning a sprint, epic, or feature breakdown.
---

# Sprint Planner

## When to Use
- Breaking a feature into implementable tasks
- Estimating effort for a sprint
- Identifying dependencies between tasks

## Instructions

1. Read the feature request or epic description
2. Explore the codebase to understand current architecture
3. Break into tasks that are each completable in 1-3 hours
4. For each task identify: files to modify, dependencies, risk level

## Output Format

### Epic: [Name]

| # | Task | Files | Est | Depends | Risk |
|---|------|-------|-----|---------|------|
| 1 | [task] | `path` | 1h | - | low |
| 2 | [task] | `path` | 2h | #1 | med |

**Total estimate:** Xh
**Critical path:** #1 → #2 → #5
**Blockers:** [any external dependencies]

## Rules
- Tasks > 3h must be split further
- Every task needs specific file paths
- Flag tasks that touch shared code as "high risk"
- Include testing tasks (not just implementation)
