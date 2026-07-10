# Session 06 — Revamped Plan: Self-Profile Fix + Salary Field

**Date:** 2026-07-09

## Context

User reviewed Session 05's plan (adding profiling.view_profile checkbox) and provided new direction:

1. **"All employed users should be able to view their own profile"** — The original plan missed the fact that professors (who have no profiling.* permissions) cannot view their own profile. The fix should be universal self-profile access, NOT a new permission checkbox.
2. **"Add a salary input when adding and editing a user"** — A new salary field is needed on the Employee form.

## Root Cause Analysis

### Why professors can't see their own profile

| Layer | What happens | Issue |
|---|---|---|
| **Sidebar** | "My Profile" button always visible for any logged-in user | ? Correct |
| **Route guard** (page.tsx) | myprofile route has NO PermissionGuard — renders <EmployeeProfilePage employeeId={user.id}> | ? Correct |
| **API call** (GET /api/employees/[id]) | Calls equirePermission(request, "profiling.view") | ? Blocks professors who lack profiling.view |
| **Result** | API returns 403 ? error "Failed to load employee" | ? Bug |

**Fix:** In GET /api/employees/[id]/route.ts, allow self-access: if the requested id matches the authenticated user's id, skip the profiling.view requirement.

### Salary field — current state

- ? No salary field in Prisma Employee model
- ? No salary input in EmployeeFormPage (create/edit form)
- ? No salary in API create/patch handlers
- ? No salary display on EmployeeProfilePage
- ? No salary in the Employee TypeScript interface

## Revised Plan

### Part A — Fix self-profile viewing (1 file)

**File:** src/app/api/employees/[id]/route.ts

**Change in GET handler:**
- Before the equirePermission(request, "profiling.view") check, add a self-access exception:
  - Extract the authenticated user's ID from uth.user.id
  - If the requested {id} matches the user's own ID, skip the profiling.view check
  - Otherwise, require profiling.view as normal

This ensures:
- Any active employee can view their own profile (My Profile)
- Viewing OTHER employees' profiles still requires profiling.view
- System admin still bypasses all checks

### Part B — Add salary field (5 files)

#### B1 — Database schema
**File:** prisma/schema.prisma
- Add salary Decimal? @default(0) to Employee model (9,2 precision for money)

#### B2 — TypeScript interface
**File:** src/components/profiling/employee-pages.tsx
- Add salary: number | null to the Employee interface

#### B3 — Form field
**File:** src/components/profiling/employee-pages.tsx
- Add a salary number input to EmployeeFormPage (in the Work Assignment section, after hireDate/contractType)
- Label: "Monthly Salary"
- Type: number, step: 0.01, min: 0

#### B4 — API create handler
**File:** src/app/api/employees/route.ts
- Add salary to the validated/create payload in POST handler

#### B5 — API update handler
**File:** src/app/api/employees/[id]/route.ts
- Add salary to the updatable fields in PATCH handler

#### B6 — Profile display (optional)
**File:** src/components/profiling/employee-pages.tsx
- Display salary on the profile page (e.g., in the header card or work info section)
- Format as currency (PHP)

### Part C — Database migration & seed update

#### C1 — Generate migration
`ash
npx prisma migrate dev --name add-salary-field
`

#### C2 — Update seed
**File:** prisma/seed.ts
- Add salary values to all employee seed records

#### C3 — Re-seed
`ash
npx tsx prisma/seed.ts
`

## Files NOT requiring changes

- src/lib/permissions.ts — No new permission needed
- src/components/admin/role-pages.tsx — No new checkbox
- src/app/page.tsx — Route guard is already correct for myprofile
- src/app/api/roles/[id]/route.ts — No CRITICAL_PERMS update needed
- src/hooks/use-permissions.ts — No change needed

## Verification

1. Login as a professor (no profiling permissions) ? Click "My Profile" ? Profile loads successfully ?
2. Login as a professor ? Try navigating to iew:<other_id> ? Should show "Access Denied" (still guarded by profiling.view on the outer route) ?
3. Create a new employee ? Salary field visible in form ? Data saves correctly ?
4. Edit an employee ? Salary field pre-filled ? Update works ?
5. View employee profile ? Salary displayed formatted as PHP currency ?
6. 
px tsc --noEmit passes ?
7. 
px prisma migrate dev --name add-salary-field runs without error ?

---

## Execution Log

### Part A - Self-Profile API Fix (DONE)

**File:** src/app/api/employees/[id]/route.ts
- Changed import to include requireAuth
- Replaced requirePermission with requireAuth + conditional check
- Self-access (auth.user.id === id) bypasses profiling.view requirement
- Viewing others' profiles still requires profiling.view
- System admin bypasses all checks (existing behavior)

### Part B - Salary Field (DONE)

**B1 - Prisma schema:** Added salary Float? @default(0) to Employee model
**B2 - TypeScript interface:** Added salary: number | null to Employee
**B3 - Form field:** Added "Monthly Salary" number input to Work Assignment section
**B4 - POST handler:** Added salary to create payload and response
**B5 - PATCH handler:** Added salary to updatable fields, GET and PATCH response
**B6 - Profile display:** Added salary formatted as PHP currency on profile page

### Part C - Migration & Seed (DONE)

- Ran: npx prisma migrate dev --name add-salary-field
- Updated prisma/seed.ts with salary values for all 9 employees
- Reset and re-seeded: prisma migrate reset --force + npx tsx prisma/seed.ts
- Verified all salaries in database (50000 to 36000 PHP)
- npx tsc --noEmit passes with zero errors from our changes
