# Session 05 — Plan: New "View Profile" Permission Checkbox

**Date:** 2026-07-09

## Context

User requested a new permission checkbox in the Roles & Permissions UI for controlling access to viewing individual employee profiles. Currently, `profiling.view` controls BOTH the employee list view AND the individual profile detail view. The goal is to split this into two distinct permissions:

- `profiling.view` — View Employee List (roster)
- `profiling.view_profile` — View Employee Profile (individual detail page)

## Investigation Summary

### Current Permission System

The system has **27 permission identifiers** across **8 modules**, defined in `src/lib/permissions.ts`. The `profiling` module currently has:

| Identifier | Purpose |
|---|---|
| `profiling.view` | See employee list AND view individual profiles |
| `profiling.view_inactive` | Filter by inactive status |
| `profiling.create` | Create new employees |
| `profiling.edit` | Edit existing employees |
| `profiling.delete` | Soft-delete employees |

### How profile viewing flows today

1. User navigates to "Employee Records" → `page.tsx` renders `<EmployeeListPage>` wrapped in `<PermissionGuard require="profiling.view">`
2. User clicks a row → navigates to `view:<id>` subpage → `page.tsx` renders `<EmployeeProfilePage>` (still inside the same outer `profiling.view` guard — **no additional guard**)
3. The "My Profile" shortcut bypasses all guards (any authenticated user can view their own profile)

### All touch points for adding the new permission

| # | File | Change Required |
|---|---|---|
| 1 | `src/lib/permissions.ts` | Add `"profiling.view_profile"` to `PERMISSIONS` array and to the `profiling` module in `MODULES` |
| 2 | `src/components/admin/role-pages.tsx` | Add label/description in `PERMISSION_LABELS`, add to `PERMISSIONS_BY_MODULE` |
| 3 | `src/app/page.tsx` | Add inner `<PermissionGuard require="profiling.view_profile">` around the `view:<id>` route |
| 4 | `prisma/seed.ts` | Add `profiling.view_profile` to `ALL_PERMISSIONS` and per-role arrays where `profiling.view` exists |
| 5 | `src/app/api/roles/[id]/route.ts` | Add `"profiling.view_profile"` to `CRITICAL_PERMS` for system role protection |

## Plan

### Step 1 — Add permission to catalog

**File:** `src/lib/permissions.ts`

- Add `"profiling.view_profile"` to the `PERMISSIONS` array (after `profiling.view`, before `profiling.view_inactive`)
- Add `"profiling.view_profile"` to the `profiling` module permissions array in `MODULES`

### Step 2 — Add checkbox to role form UI

**File:** `src/components/admin/role-pages.tsx`

- Add to `PERMISSION_LABELS`:
  ```ts
  "profiling.view_profile": { label: "View Profile", description: "View detailed employee profile (certificates, files, personal info)." },
  ```
- Add `"profiling.view_profile"` to the `Employee Profiling` section in `PERMISSIONS_BY_MODULE`

### Step 3 — Guard the profile view route

**File:** `src/app/page.tsx` (line 57-58)

Currently:
```tsx
currentSubpage?.startsWith("view:") ? (
  <EmployeeProfilePage employeeId={currentSubpage.slice(5)} />
) : <EmployeeListPage />}
```

Change to:
```tsx
currentSubpage?.startsWith("view:") ? (
  <PermissionGuard require="profiling.view_profile" fallback={<PermissionDenied />}>
    <EmployeeProfilePage employeeId={currentSubpage.slice(5)} />
  </PermissionGuard>
) : <EmployeeListPage />}
```

### Step 4 — Update seed data

**File:** `prisma/seed.ts`

Add `"profiling.view_profile"` to:
- `ALL_PERMISSIONS` (System Admin gets everything)
- `ACCOUNTANT_PERMS` (currently has `profiling.view`)
- `HR_PERMS` (currently has `profiling.view`)
- `DEAN_PERMS` (currently has `profiling.view`)
- `IT_STAFF_PERMS` (currently has `profiling.view`)
- **NOT** `PROFESSOR_PERMS` (doesn't have `profiling.view`, so no profile viewing)

### Step 5 — Update CRITICAL_PERMS

**File:** `src/app/api/roles/[id]/route.ts`

Add `"profiling.view_profile"` to the `CRITICAL_PERMS` array.

### Step 6 — Re-seed database

```bash
npx tsx prisma/seed.ts
```

### Step 7 — Verify

- `npx tsc --noEmit` passes
- Create/edit a role in UI — confirm "View Profile" checkbox appears under Employee Profiling
- Assign a role with `profiling.view` but NOT `profiling.view_profile` → can see list, but profile view shows "Access Denied"
- Assign a role with BOTH → can see list and profiles
- System Admin still bypasses all guards

## Files NOT requiring changes

- `src/lib/auth-token.ts` — permission checking is generic, no change needed
- `src/hooks/use-permissions.ts` — `has()` is generic, no change needed
- `src/components/shared/permission-guard.tsx` — generic, no change needed
- Database schema (`prisma/schema.prisma`) — permission model is string-based, no schema migration needed
- `src/app/api/roles/route.ts` — uses generic PERMISSIONS validation, no change needed

## Design Decisions

1. **New permission, not rename** — keeps backward compatibility; existing seed data continues to work after re-seed
2. **Inner guard in page.tsx** — the `profiling.view` outer guard remains, so both permissions are required for full access (list + profile)
3. **CRITICAL_PERMS inclusion** — protects system roles from losing profile viewing capability
4. **My Profile unaffected** — the `myprofile` route bypasses guards entirely (existing behavior preserved)
