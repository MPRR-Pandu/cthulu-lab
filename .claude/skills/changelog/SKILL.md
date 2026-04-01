---
name: changelog
description: Generate changelogs and release notes from git history. Use before releases or version bumps.
---

# Changelog Generator

## When to Use
- Preparing a release
- Writing release notes
- Version bump documentation

## Instructions

1. Read git log since last release tag
2. Categorize commits: features, fixes, breaking changes, docs
3. Write user-facing descriptions (not commit messages)
4. Highlight breaking changes prominently

## Output Format

```markdown
## v1.2.0 (2026-04-01)

### Breaking Changes
- API endpoint `/users` now requires auth header

### Features
- Add email notification on signup
- Support bulk import via CSV

### Fixes
- Fix timeout on large file uploads
- Correct timezone handling in scheduler

### Internal
- Upgrade React to 18.3
- Add integration tests for auth flow
```

## Rules
- User-facing language (not "refactor utils module")
- Breaking changes ALWAYS listed first
- Group related changes together
- Include migration steps for breaking changes
- Link to PRs/issues where relevant
