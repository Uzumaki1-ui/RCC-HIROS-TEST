# Plan: Security Hardening for Public Sharing

**Goal:** Make RCC-HIROS safe to share publicly (code repo + live deployment).

---

## Phase 1 — Gitignore Hardening (Prevent Data Leaks)

Must be done before any public git push.

### 1.1 Fix `.gitignore`

**File:** `.gitignore`

Add to the end:
```
# Secrets and data
.env
db/
uploads/
```

**Rationale:**
- `.env` — currently has local SQLite path; if production credentials are added later they'd leak
- `db/custom.db` — contains all employee data (names, emails, password hashes, attendance GPS coordinates, leave records, evaluations)
- `uploads/` — contains employee documents (certificates, files)

### 1.2 Remove tracked files from git

After fixing `.gitignore`, check and clean:
```bash
git ls-files .env db/ uploads/     # Check if tracked
git rm --cached .env                # If tracked
git rm -r --cached db/              # If tracked
git rm -r --cached uploads/         # If tracked
```

---

## Phase 2 — JWT Secret Hardening

### 2.1 Remove hardcoded fallback from code

**File:** `src/lib/auth-token.ts` (lines 9-11)

Before:
```ts
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "rcc-hiros-dev-secret-change-in-production"
);
```

After:
```ts
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET
);
```

### 2.2 Generate a strong production secret

```powershell
# Windows
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(64))
```

Set as `JWT_SECRET` in the production environment (server env vars, NOT committed).

---

## Phase 3 — Production Security Additions

### 3.1 Rate limiting on login endpoint

**File:** `src/app/api/auth/login/route.ts`

Add in-memory rate limiter (IP-based, ~10 req/min per IP). Return 429 when exceeded.

### 3.2 HTTPS enforcement

**File:** `src/middleware.ts`

Redirect HTTP to HTTPS when `NODE_ENV=production` and `x-forwarded-proto` is not `https`.

### 3.3 Security headers

**File:** `src/middleware.ts`

Add HSTS, X-Content-Type-Options, X-Frame-Options, Content-Security-Policy.

### 3.4 Verify `z-ai-web-dev-sdk` dependency

Check if it's actually imported anywhere. If not, remove it from `package.json`:
```bash
rg "z-ai-web-dev-sdk" src/
```

### 3.5 (Optional) CAPTCHA on login

Add Cloudflare Turnstile or Google reCAPTCHA if the site is public-facing.

---

## Phase 4 — Pre-Deployment Checklist

- [ ] JWT_SECRET set in production environment
- [ ] `.gitignore` updated with `db/`, `uploads/`, `.env`
- [ ] No tracked secrets in git (`git ls-files` confirms clean)
- [ ] Rate limiting on `/api/auth/login`
- [ ] HTTPS enforced in middleware
- [ ] Security headers added
- [ ] Production `.env` never committed
- [ ] Clean database deployed (no dev seed data)

---

## Priority Summary

| Priority | Task | Effort |
|----------|------|--------|
| P0 | Gitignore fix (db/ uploads/ .env) | 5 min |
| P0 | Remove hardcoded JWT fallback | 5 min |
| P0 | Generate & set production JWT_SECRET | 5 min |
| P1 | Rate limiting on login | 30 min |
| P1 | HTTPS enforcement + security headers | 15 min |
| P2 | CAPTCHA on login | 1-2 hours |
| P2 | Review z-ai-web-dev-sdk | 5 min |