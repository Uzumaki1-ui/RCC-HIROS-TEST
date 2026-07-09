# Session 01 — Security Hardening Plan

**Date:** 2026-07-09

## Context

Asked to assess whether RCC-HIROS can be safely shared publicly or exposed to the internet.

## Investigation

- Next.js + Prisma + SQLite HR/employee management system
- JWT auth with `jose` library, HS256, 8h expiry
- RBAC permission system with per-route `requirePermission` guards
- Login with bcrypt password hashing, account lockout after 5 failed attempts
- Uploaded employee files stored under `uploads/` on disk

## Key Findings

### Critical (blockers for public sharing)

1. **Hardcoded JWT fallback secret** — `"rcc-hiros-dev-secret-change-in-production"` in `src/lib/auth-token.ts`
2. **`.env` file not in `.gitignore`** — only `.env.local` and `.env.production` are listed
3. **`db/custom.db` not in `.gitignore`** — SQLite database with all employee data would leak
4. **`uploads/` not in `.gitignore`** — employee documents/files would leak

### Important but not blocking

5. No rate limiting on `/api/auth/login`
6. No CAPTCHA on login form
7. No HTTPS enforcement in middleware

### What's working well

- Proper `requireAuth`/`requirePermission` guards on API routes
- bcrypt password hashing
- Account lockout after 5 failures
- RBAC granular permissions
- Audit logging exists

## Plan (created)

Created `plan.md` with a 4-phase security hardening plan:
- Phase 1: Gitignore fixes (db/, uploads/, .env) + remove tracked files
- Phase 2: JWT secret hardening (remove hardcoded fallback, require env var)
- Phase 3: Rate limiting, HTTPS enforcement, security headers, verify SDK
- Phase 4: Pre-deployment checklist

## Execution — Session 01

### Phase 1 — Gitignore hardening ✅
- Added `db/`, `uploads/`, `.env` to `.gitignore`
- Checked with `git ls-files`: `.env`, `db/custom.db`, and `uploads/employees/.../...pdf` were tracked
- Removed all three from git with `git rm --cached` (files kept locally)

### Phase 2 — JWT secret hardening ✅
- Removed hardcoded fallback `"rcc-hiros-dev-secret-change-in-production"` from `src/lib/auth-token.ts`
- Added startup guard: `if (!process.env.JWT_SECRET) { throw new Error("...") }`
- Generated a strong 64-byte random JWT_SECRET and set it in `.env`
- Created `.env.example` to document required env vars

### Z-AI cleanup ✅
- Removed unused `z-ai-web-dev-sdk` dependency (`npm uninstall`)
- Removed `.space-z.ai` from `allowedDevOrigins` in `next.config.ts`
- Verified with grep: no imports of `z-ai` anywhere in `src/`

### Verification ✅
- `npx tsc --noEmit` passes with no errors

## Next steps

Phase 3 items (rate limiting, HTTPS enforcement, security headers) remain for another session if desired.