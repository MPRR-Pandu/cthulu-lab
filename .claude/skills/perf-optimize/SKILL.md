---
name: perf-optimize
description: Profile and optimize performance -- bundle size, query speed, memory, load time.
---

# Performance Optimization

1. Identify bottleneck (frontend, backend, database, network)
2. Measure baseline performance
3. Apply targeted optimization
4. Measure again to verify improvement

Frontend: lazy load, optimize images, tree-shake, code split, cache static assets. Backend: add indexes, implement caching, connection pooling, pagination, fix N+1 queries. Database: EXPLAIN ANALYZE, add indexes, denormalize read-heavy tables.

Output: Bottleneck, Before metric, Fix, Expected improvement, Trade-off.
