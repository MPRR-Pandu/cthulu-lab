---
name: code-review
description: Perform thorough code review checking for bugs, security, performance, and maintainability. Use when reviewing PRs or changed files.
---

# Code Review

## When to Use
- Reviewing a pull request
- Auditing code before merge
- Post-implementation quality check

## Instructions

1. Read the diff or changed files
2. Check each file against the checklist below
3. Classify findings by severity
4. Provide actionable fix for every finding

## Checklist

### Critical (Block merge)
- SQL injection, XSS, command injection
- Secrets/keys hardcoded
- Auth/authz bypass
- Data loss scenarios
- Race conditions in concurrent code

### Warning (Fix before next sprint)
- Missing error handling at boundaries
- N+1 queries
- Missing input validation
- Inconsistent naming
- Missing null/undefined checks

### Nit (Nice to fix)
- Code style inconsistencies
- Unused imports
- Overly complex expressions
- Missing types

## Output Format

**[CRITICAL]** `file:line` — Issue. Fix: X.
**[WARNING]** `file:line` — Issue. Fix: Y.
**[NIT]** `file:line` — Issue. Fix: Z.

**Summary:** X critical, Y warnings, Z nits
**Verdict:** Approve / Request changes / Block
