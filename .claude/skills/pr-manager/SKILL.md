---
name: pr-manager
description: Create, manage, and review pull requests with proper descriptions, labels, and review assignments. Use when creating or managing PRs.
---

# PR Manager

## When to Use
- Creating a pull request
- Writing PR descriptions
- Managing PR review workflow

## Instructions

1. Gather all changes (git diff, commit history)
2. Write a clear PR title (under 70 chars, imperative mood)
3. Write structured description
4. Suggest reviewers based on file ownership

## PR Description Template

```markdown
## Summary
[1-3 bullet points of what changed and why]

## Changes
- [File/component]: [what changed]

## Testing
- [ ] Unit tests added/updated
- [ ] Manual testing done
- [ ] Edge cases covered

## Screenshots
[If UI changes]

## Rollback
[How to revert if something breaks]
```

## Rules
- PR title: imperative mood, under 70 chars ("Add auth middleware" not "Added auth middleware")
- One PR per feature/fix — no mega PRs
- Link to issue/ticket if exists
- Flag breaking changes prominently
- Request review from code owners of modified files
