# Session 04 — Seed Data Overhaul

**Date:** 2026-07-09

## Context

User wanted comprehensive demo data that showcases ALL system functionalities for peer reviewers.

## Implementation

### What was done

1. **Rewrote `prisma/seed.ts`** with comprehensive demo data
2. **Reset the database** with `prisma migrate reset --force`
3. **Ran the seed** successfully with `npx tsx prisma/seed.ts`
4. **Started dev server** and verified all APIs

### Seed data breakdown

**Foundation (kept):**
- 3 Groups: Accounting, CCS, HR
- 6 Roles: System Admin, Accountant, HR Personnel, Dean, IT Staff, Professor
- 6 original employee accounts (EMP-0000 through EMP-0005)
- 3 Leave Types: Sick Leave, Vacation Leave, Emergency Leave
- Evaluation form with 10 criteria
- System settings (premises config)

**New additions:**
- 3 new employees: Maria Santos (Professor), John Dela Cruz (HR), Ana Gonzales (Accountant)
- Updated permission sets to include `profiling.delete` for relevant roles
- Leave balances with varied used days across employees
- 8 leave requests showcasing ALL workflow states (draft, pending_l1, pending_l2, approved, rejected, cancelled)
- 2 evaluation periods: archived (2nd Sem 2025) + open (1st Sem 2026)
- 5 evaluation submissions across periods with target scores
- 17 attendance records across 4 days with varied clock states
- 6 employee certificates attached to 3 employees

### Verified APIs
- GET /api/auth/login — token issued ✅
- GET /api/attendance — 6 today, 17 total ✅
- GET /api/leave-requests — 8 with all states ✅
- GET /api/evaluations — 5 total ✅
- GET /api/employees — 9 employees ✅
- GET /api/reports/headcount — full breakdown ✅
