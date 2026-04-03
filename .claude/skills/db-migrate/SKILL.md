---
name: db-migrate
description: Create database migration scripts with up/down operations and rollback safety.
---

# Database Migration

1. Understand current schema
2. Write UP migration (apply) and DOWN migration (revert)
3. Plan data backfill if needed
4. Test both directions

Rules: always include DOWN migration. Never drop columns in prod without deprecation period. Add columns as nullable first, backfill, then add constraints. Create indexes CONCURRENTLY on large tables. Include estimated runtime.
