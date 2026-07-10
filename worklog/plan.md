# Plan: HR Assistant Role + Department/Role Columns

**Goal:** Create a role hierarchy where higher roles can evaluate lower roles within the same group, and display department/role info in evaluation results.

---

## Part A — New "HR Assistant" Role

**File:** prisma/seed.ts

**Changes:**
- Add HR_ASSISTANT_PERMS array (limited permissions — no eval submit/manage/reset)
- Add hrAssistant role upsert call with all scopeAll = false
- Change John (EMP-0007) from hrPersonnel → hrAssistant role

---

## Part B — HR Personnel Can Submit Evaluations

**File:** prisma/seed.ts

**Changes:**
- Add "evaluation.submit" to HR_PERMS array
- Remove the artificial HR→John evaluation from seed (Jeremiah can now evaluate John via the UI)

---

## Part C — API Include Group & Role

**File:** src/app/api/evaluations/route.ts

**Changes:**
- EVALUATION_INCLUDE now fetches group: { select: { name: true } } and ole: { select: { name: true } }
- serializeEvaluation includes group and role in employee object

---

## Part D — Department & Role Columns

**File:** src/components/evaluation/evaluation-pages.tsx

**Changes:**
- Update Evaluation interface with group and ole fields
- Add "Department" and "Role" column headers to ResultsTable
- Add Department and Role data cells
- Update EvaluationDetailsModal with Department and Role info
- Fix colSpan values

---

## Verification Checklist

- [x] John shows as "HR Assistant" in seed output and DB
- [x] Jeremiah (HR Personnel) has evaluation.submit permission
- [x] HR→John evaluation removed from seed (can now be done via UI)
- [x] API returns group.name and role.name in evaluation employee object
- [x] Department and Role columns visible in Evaluation Results table
- [x] Department and Role visible in Evaluation Details modal
- [x] npx tsc --noEmit passes
- [x] Seed runs cleanly
