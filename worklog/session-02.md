# Session 02 — Phase 3: Rate Limiting, HTTPS, Security Headers

**Date:** 2026-07-09

## Context

Continuing security hardening. Phase 1 & 2 (gitignore, JWT secret) completed in Session 01.

## Phase 3 Tasks

### 3.1 Rate limiting on `/api/auth/login` ✅
- Added in-memory IP-based rate limiter at module scope
- Limits: 20 requests per minute per IP
- Returns 429 with `Retry-After` and `X-RateLimit-Remaining` headers when exceeded
- IP extracted from `x-forwarded-for` → `x-real-ip` → `"unknown"` fallback

### 3.2 HTTPS enforcement ✅
- Added production-only redirect in middleware
- Checks `x-forwarded-proto` header; redirects HTTP → HTTPS with 301

### 3.3 Security headers ✅
Added to every response via middleware:
- `strict-transport-security` — 1 year, includeSubDomains, preload
- `x-content-type-options: nosniff`
- `x-frame-options: DENY`
- `referrer-policy: strict-origin-when-cross-origin`
- `x-xss-protection: 1; mode=block`

### Verification ✅
- `npx tsc --noEmit` passes with no errors

## Files changed
- `src/app/api/auth/login/route.ts` — added rate limiter
- `src/middleware.ts` — added HTTPS redirect + security headers

## Next steps
Phase 4 — Run pre-deployment checklist before sharing publicly.
