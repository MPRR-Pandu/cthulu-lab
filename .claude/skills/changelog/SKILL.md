---
name: changelog
description: Generate changelogs and release notes from git history.
---

# Changelog Generator

1. Read git log since last release tag
2. Categorize commits: features, fixes, breaking changes, internal
3. Write user-facing descriptions (not raw commit messages)
4. Highlight breaking changes first

Rules: user-facing language. Breaking changes always listed first with migration steps. Group related changes. Link to PRs/issues where relevant.
