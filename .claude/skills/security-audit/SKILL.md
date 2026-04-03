---
name: security-audit
description: Audit codebase for OWASP Top 10 vulnerabilities, dependency risks, and misconfigurations.
---

# Security Audit

1. Scan for OWASP Top 10: injection, broken auth, data exposure, XXE, broken access control, misconfiguration, XSS, insecure deserialization, vulnerable components, insufficient logging
2. Check dependency vulnerabilities (`npm audit`, `pip audit`)
3. Review auth/authz implementation
4. Check for hardcoded secrets
5. Verify input sanitization at all boundaries

Output: `[SEVERITY] file:line -- Vulnerability. Impact: X. Fix: Y.` Plus dependency scan results and overall risk rating.
