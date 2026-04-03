---
name: code-review
description: Review code for bugs, security, performance, and maintainability.
---

# Code Review

1. Read the diff or changed files
2. Check against severity levels
3. Provide actionable fix for every finding

Severity levels:
- **CRITICAL** (block merge): injection, hardcoded secrets, auth bypass, data loss, race conditions
- **WARNING** (fix soon): missing error handling, N+1 queries, missing validation, null checks
- **NIT**: style issues, unused imports, missing types

Output: `[SEVERITY] file:line -- Issue. Fix: X.` Summary with verdict: Approve / Request changes / Block.
