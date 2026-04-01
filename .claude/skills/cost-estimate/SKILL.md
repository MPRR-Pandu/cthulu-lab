---
name: cost-estimate
description: Estimate infrastructure and development costs for features, migrations, and scaling. Use when budgeting or evaluating build-vs-buy decisions.
---

# Cost Estimation

## When to Use
- Budgeting for a new feature
- Build vs. buy decision
- Infrastructure scaling cost projection
- Sprint capacity planning

## Instructions

1. Break down the work into components
2. Estimate dev hours per component
3. Estimate infrastructure costs (compute, storage, API calls)
4. Calculate total cost over time horizon

## Output Format

### Development Cost

| Component | Hours | Rate | Cost |
|-----------|-------|------|------|
| Backend API | 16h | $X/h | $Y |
| Frontend UI | 8h | $X/h | $Y |
| Testing | 4h | $X/h | $Y |
| **Total** | **28h** | | **$Z** |

### Infrastructure Cost (Monthly)

| Service | Unit | Volume | Cost |
|---------|------|--------|------|
| Compute | vCPU-hour | 720h | $X |
| Database | GB-month | 10GB | $Y |
| API calls | per 1K | 100K | $Z |
| **Total** | | | **$W/mo** |

### Build vs. Buy

| Factor | Build | Buy |
|--------|-------|-----|
| Upfront | $X | $0 |
| Monthly | $Y | $Z |
| Break-even | N months | - |
| Customizable | Full | Limited |

## Rules
- Include hidden costs (maintenance, monitoring, on-call)
- Add 30% buffer for unknowns
- Compare 12-month total cost, not just monthly
