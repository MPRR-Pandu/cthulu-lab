---
name: security-audit
description: Audit codebase for OWASP Top 10 vulnerabilities, dependency risks, and security misconfigurations. Use before releases or after major changes.
---

# Security Audit

## When to Use
- Pre-release security check
- After adding auth/payment features
- Dependency vulnerability scan
- Compliance review

## Instructions

1. Scan for OWASP Top 10 vulnerabilities
2. Check dependency vulnerabilities (`npm audit`, `pip audit`)
3. Review auth/authz implementation
4. Check for hardcoded secrets
5. Verify input sanitization at all boundaries

## OWASP Top 10 Checklist
- [ ] Injection (SQL, NoSQL, command, LDAP)
- [ ] Broken authentication
- [ ] Sensitive data exposure
- [ ] XML external entities (XXE)
- [ ] Broken access control
- [ ] Security misconfiguration
- [ ] Cross-site scripting (XSS)
- [ ] Insecure deserialization
- [ ] Using components with known vulns
- [ ] Insufficient logging/monitoring

## Output Format

**[CRITICAL]** `file:line` — Vulnerability. Impact: X. Fix: Y.
**[HIGH]** `file:line` — Risk. Impact: X. Fix: Y.
**[MEDIUM]** `file:line` — Issue. Fix: Y.

**Dependencies:** X vulnerabilities found (run `npm audit fix`)
**Secrets scan:** Clean / X secrets found
**Overall risk:** Critical / High / Medium / Low
