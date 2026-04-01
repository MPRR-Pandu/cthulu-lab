---
name: perf-optimize
description: Profile and optimize application performance — bundle size, query speed, memory usage, load time. Use when app feels slow or before scaling.
---

# Performance Optimization

## When to Use
- App is slow or unresponsive
- Preparing for traffic scaling
- Bundle size reduction
- Database query optimization

## Instructions

1. Identify the bottleneck (frontend, backend, database, network)
2. Measure current performance (baseline)
3. Apply targeted optimization
4. Measure again (verify improvement)

## Common Optimizations

### Frontend
- Lazy load routes and heavy components
- Optimize images (WebP, proper sizing)
- Tree-shake unused imports
- Code split at route boundaries
- Cache static assets

### Backend
- Add database indexes for slow queries
- Implement caching (Redis, in-memory)
- Use connection pooling
- Paginate large result sets
- Profile N+1 queries

### Database
- EXPLAIN ANALYZE slow queries
- Add missing indexes
- Denormalize for read-heavy tables
- Use read replicas for analytics

## Output Format

**Bottleneck:** [where the slowness is]
**Before:** [metric]
**Fix:** [what to change]
**After:** [expected improvement]
**Trade-off:** [what you give up]
