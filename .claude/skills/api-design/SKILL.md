---
name: api-design
description: Design REST or GraphQL APIs with proper endpoints, request/response schemas, error handling, and versioning. Use when designing new APIs.
---

# API Design

## When to Use
- Designing new API endpoints
- Refactoring existing APIs
- Documenting API contracts

## Instructions

1. Understand the domain and use cases
2. Define resources and relationships
3. Design endpoints following REST conventions
4. Define request/response schemas
5. Plan error handling and status codes

## Output Format

### `POST /api/v1/users`

**Request:**
```json
{ "email": "string", "name": "string" }
```

**Response (201):**
```json
{ "id": "uuid", "email": "string", "created_at": "iso8601" }
```

**Errors:**
- `400` — Invalid input: `{ "error": "email_required" }`
- `409` — Email exists: `{ "error": "email_taken" }`
- `500` — Server error: `{ "error": "internal" }`

## Rules
- Use nouns for resources, not verbs (`/users` not `/getUsers`)
- Use proper HTTP methods (GET/POST/PUT/PATCH/DELETE)
- Version APIs (`/api/v1/`)
- Return consistent error format
- Include pagination for list endpoints
- Use ISO 8601 for dates
- Rate limit all endpoints
