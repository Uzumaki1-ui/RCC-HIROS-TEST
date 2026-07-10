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

## Session 05 — Plan: View Profile Permission (CANCELLED — superseded by Session 06)

- [x] Investigated current permission system
- [ ] ~~Step 1-6~~ — Cancelled

## Session 06 — Self-Profile Fix + Salary Field

### Part A — Fix self-profile viewing
- [x] Step A1: Add self-access exception in GET /api/employees/[id]

### Part B — Add salary field
- [x] Step B1: Add salary to Prisma Employee model
- [x] Step B2: Add salary to Employee TypeScript interface
- [x] Step B3: Add salary input to EmployeeFormPage
- [x] Step B4: Add salary to POST /api/employees create handler
- [x] Step B5: Add salary to PATCH /api/employees/[id] update handler
- [x] Step B6: Display salary on EmployeeProfilePage

### Part C — Migration & seed
- [x] Step C1: Generate Prisma migration (add-salary-field)
- [x] Step C2: Update seed data with salary values
- [x] Step C3: Re-seed database
- [x] Step C4: Verify (npx tsc --noEmit passes, salary data in db)

## Session 07 — HR Assistant Role + Department/Role Columns

### Part A — New HR Assistant role
- [x] Create HR_ASSISTANT_PERMS permission set
- [x] Add hrAssistant role upsert in seed
- [x] Change John (EMP-0007) to hrAssistant role

### Part B — HR Personnel gains evaluation.submit
- [x] Add evaluation.submit to HR_PERMS seed array
- [x] Remove artificial HR→John evaluation (Jeremiah can now submit via UI)

### Part C — API: Include group & role in evaluation response
- [x] Add group and role to EVALUATION_INCLUDE
- [x] Add group and role to serializeEvaluation

### Part D — Frontend: Department & Role columns
- [x] Update Evaluation interface with group/role fields
- [x] Add Department and Role column headers
- [x] Add Department and Role data cells
- [x] Add Department and Role to EvaluationDetailsModal

### Part E — Seed fix
- [x] Remove problematic employee.deleteMany block (FK violation)

### Part F — Unified Evaluation Page
- [x] Create EvaluationPage component with permission-gated sections
- [x] Update page.tsx to route all eval subpages to unified page
- [x] Update dynamic-sidebar.tsx to route to unified page (no subpage priority)

### Part G — Employee Scoping Fix
- [x] Add `scope` query param to /api/employees
- [x] Use scopeAllEvaluation instead of scopeAllProfiling when scope=evaluation
- [x] Submit page fetches employees with ?scope=evaluation

### Part H — UI Polish
- [x] Move "Select an open period" into Period field hint (flexbox alignment fix)
- [x] Remove Manage Periods button (no longer needed)
- [x] Clean up unused imports (Power, setCurrentPage)
