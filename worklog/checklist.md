# Checklist

## Session 01 — Security hardening execution

- [x] Log initial analysis and create plan
- [x] Review and finalize plan
- [x] Phase 1: Fix gitignore (db/ uploads/ .env)
- [x] Phase 1: Remove tracked files from git if any
- [x] Phase 2: Remove hardcoded JWT fallback
- [x] Phase 2: Generate & set production JWT_SECRET
- [x] Remove unused z-ai-web-dev-sdk dependency
- [x] Clean up .space-z.ai from allowedDevOrigins

## Session 02 — Phase 3 hardening

- [x] Phase 3: Add rate limiting on /api/auth/login
- [x] Phase 3: HTTPS enforcement in middleware
- [x] Phase 3: Security headers in middleware
- [ ] Phase 4: CAPTCHA on login — deferred
- [ ] Phase 4: Clean database for production — deferred

## Session 03 — Cloudflare Tunnel (cancelled)

- [x] Installed & authenticated cloudflared
- [x] Created tunnel + DNS route for app.rcc-hiros.com
- [x] Cleaned up — user pursuing alternative solution

## Session 04 — Seed data overhaul

- [x] Plan finalized
- [x] Implement seed update
- [x] Verify seed runs cleanly
- [x] Verify APIs return correct data