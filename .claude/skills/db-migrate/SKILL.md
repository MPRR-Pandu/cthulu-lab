---
name: db-migrate
description: Create database migration scripts with up/down operations, data backfill plans, and rollback safety. Use when modifying database schemas.
---

# Database Migration

## When to Use
- Adding/modifying database tables or columns
- Data backfill or transformation
- Index creation or modification

## Instructions

1. Understand the current schema
2. Write UP migration (apply changes)
3. Write DOWN migration (revert changes)
4. Plan data backfill if needed
5. Test both directions

## Rules
- ALWAYS include a DOWN migration
- NEVER drop columns in production without a deprecation period
- Add new columns as nullable first, backfill, then add constraints
- Create indexes CONCURRENTLY on large tables
- Test migrations against a copy of production data
- Include estimated runtime for large tables

## Output Format

```sql
-- UP
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);

-- DOWN
DROP INDEX IF EXISTS idx_users_email;
ALTER TABLE users DROP COLUMN IF EXISTS email_verified;
```

**Estimated runtime:** ~2min on 1M rows
**Rollback safe:** Yes
**Data loss risk:** None
