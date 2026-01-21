---
name: backend-api-guardian
description: Enforces consistent, safe patterns for Next.js API routes and backend logic in tchelper.app. Use for creating/implementing API handlers, route.ts files, DB reads/writes, input validation, error handling, middleware, Whop webhooks, or server-side integrations. Triggers on: api route, endpoint, handler, post/get, backend, server, db read, db write, zod validate, middleware, auth check, rate limit, whop webhook, response shape.
---

# Backend API Guardian – Safe & Consistent Server Logic

You MUST follow these rules when writing API routes (/app/api/**/route.ts), server actions, DB operations, or backend integrations.  
NEVER ignore them without explicit "ignore guardian rules".

## Core Rules for API Routes & Handlers
- Use Next.js App Router only: /app/api/[feature]/route.ts
- ALWAYS async/await + try/catch in handlers
- Standard response shape: { success: boolean, data?: T, error?: string, code?: number }
- HTTP methods: Explicit GET/POST/PUT/DELETE exports
- Middleware stubs: Add auth check (e.g., getSession()) + rate limit (e.g., Upstash Ratelimit) if route is sensitive
- Logging: Use console.log for dev, structured logs (e.g., JSON) for prod

## Input Validation (Zod Required)
- ALWAYS validate body/query/params with Zod safeParse()
- Example schema for contract upload: z.object({ file: z.instanceof(File).optional(), userId: z.string() })
- On fail: return 400 with { success: false, error: result.error.format() }
- For Claude-generated data: Use safeParse + transform to normalize (e.g., coerce strings to numbers/dates)
- NEVER trust raw inputs — sanitize for SQL injection/XSS if DB involved

## DB Reads/Writes (Generic — Adapt to Your ORM)
- Use async wrappers: e.g., try { await db.insert(...) } catch (e) { ... }
- Read patterns: Use queries with limits/offsets for pagination (e.g., db.findMany({ take: 20, skip: offset }))
- Write patterns: Use transactions for multi-step ops (e.g., extract data → insert contract → create calendar event)
- Error handling: Rollback on fail, return 500 with safe message
- If using Prisma: Prefer prisma.$transaction([...])

## External Integrations
- Google Calendar: ALWAYS refresh token, use exponential backoff, default TZ 'America/Chicago'
- Whop Payments: Handle webhooks with signature verification, idempotency keys
- General APIs: Use fetch with timeout/retry, cache if appropriate (Next.js revalidateTag)

## Mandatory Process for New Routes / Backend Logic
1. Read task + existing related code
2. Plan: files affected (route.ts, lib/db.ts?), inputs/outputs, DB ops, validation schema
3. Define Zod schema first
4. Write handler: validate inputs → business logic/DB → standardized response
5. Add error handling + middleware
6. Output: diff + explanations ("Used Zod for safeParse to catch bad Claude data")
7. Ask "apply?" before edits

Think step-by-step. Prioritize security, reliability, and scalability.
Ask if unclear on DB lib (Prisma? Supabase?) or specific integrations.