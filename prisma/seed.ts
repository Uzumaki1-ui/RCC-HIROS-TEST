// ═══════════════════════════════════════════════════════════════
// RCC-HIROS — Comprehensive Seed
// Creates groups, roles, employees, leave types/balances/requests,
// evaluation form/criteria/period/evaluation, attendance, premises.
// ═══════════════════════════════════════════════════════════════

import { PrismaClient, type EvaluationCriterion } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { hash } from "bcryptjs";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./db/custom.db",
});
const prisma = new PrismaClient({ adapter });

const DEFAULT_PASSWORD = "RCC2026!";
const YEAR = 2026;

// ───────────────────────────────────────────────────────────────
// Permission sets per role
// ───────────────────────────────────────────────────────────────

const ALL_PERMISSIONS = [
  "dashboard.view",
  "profiling.view",
  "profiling.view_inactive",
  "profiling.create",
  "profiling.edit",
  "profiling.delete",
  "attendance.view",
  "attendance.clock_in",
  "attendance.edit",
  "attendance.edit_on_premise",
  "attendance.view_all",
  "evaluation.view",
  "evaluation.submit",
  "evaluation.view_results",
  "evaluation.manage_forms",
  "evaluation.reset",
  "leave.request",
  "leave.approve_l1",
  "leave.approve_l2",
  "leave.view_all",
  "leave.manage_types",
  "reports.view",
  "reports.export",
  "roles.view",
  "roles.create",
  "roles.edit",
  "roles.delete",
  "groups.view",
  "groups.manage",
];

const ACCOUNTANT_PERMS = [
  "dashboard.view",
  "profiling.view",
  "profiling.view_inactive",
  "attendance.view",
  "attendance.clock_in",
  "attendance.edit",
  "attendance.edit_on_premise",
  "leave.request",
  "leave.approve_l2",
  "leave.view_all",
  "reports.view",
  "reports.export",
  "groups.view",
  "roles.view",
];

const HR_PERMS = [
  "dashboard.view",
  "profiling.view",
  "profiling.view_inactive",
  "profiling.create",
  "profiling.edit",
  "attendance.view",
  "attendance.clock_in",
  "attendance.edit",
  "attendance.edit_on_premise",
  "evaluation.view",
  "evaluation.manage_forms",
  "evaluation.reset",
  "leave.request",
  "leave.approve_l2",
  "leave.view_all",
  "leave.manage_types",
  "reports.view",
  "reports.export",
  "groups.view",
  "groups.manage",
  "roles.view",
];

const DEAN_PERMS = [
  "dashboard.view",
  "profiling.view",
  "attendance.view",
  "attendance.clock_in",
  "evaluation.view",
  "evaluation.submit",
  "leave.approve_l1",
  "leave.request",
  "reports.view",
  "groups.view",
];

const IT_STAFF_PERMS = [
  "dashboard.view",
  "profiling.view",
  "profiling.view_inactive",
  "profiling.create",
  "profiling.edit",
  "attendance.view",
  "attendance.clock_in",
  "attendance.edit",
  "attendance.edit_on_premise",
  "evaluation.view",
  "evaluation.manage_forms",
  "leave.view_all",
  "evaluation.reset",
  "leave.manage_types",
  "reports.view",
  "reports.export",
  "roles.view",
  "roles.create",
  "roles.edit",
  "groups.view",
  "groups.manage",
];

const PROFESSOR_PERMS = [
  "dashboard.view",
  "attendance.clock_in",
  "attendance.view",
  "leave.request",
  "evaluation.view_results",
];

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

async function upsertRole(
  name: string,
  description: string,
  opts: {
    scopeAllProfiling?: boolean;
    scopeAllEvaluation?: boolean;
    scopeAllLeave?: boolean;
    scopeAllReports?: boolean;
    scopeAllAttendance?: boolean;
    canSelfApproveLeave?: boolean;
    isSystem?: boolean;
  },
  permissions: string[]
) {
  const role = await prisma.role.upsert({
    where: { name },
    update: {
      description,
      scopeAllProfiling: opts.scopeAllProfiling ?? false,
      scopeAllEvaluation: opts.scopeAllEvaluation ?? false,
      scopeAllLeave: opts.scopeAllLeave ?? false,
      scopeAllReports: opts.scopeAllReports ?? false,
      scopeAllAttendance: opts.scopeAllAttendance ?? false,
      canSelfApproveLeave: opts.canSelfApproveLeave ?? false,
      isSystem: opts.isSystem ?? false,
      active: true,
    },
    create: {
      name,
      description,
      scopeAllProfiling: opts.scopeAllProfiling ?? false,
      scopeAllEvaluation: opts.scopeAllEvaluation ?? false,
      scopeAllLeave: opts.scopeAllLeave ?? false,
      scopeAllReports: opts.scopeAllReports ?? false,
      scopeAllAttendance: opts.scopeAllAttendance ?? false,
      canSelfApproveLeave: opts.canSelfApproveLeave ?? false,
      isSystem: opts.isSystem ?? false,
      active: true,
    },
  });

  // Wipe & rebuild permissions
  await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
  await prisma.rolePermission.createMany({
    data: permissions.map((identifier) => ({
      roleId: role.id,
      identifier,
      granted: true,
    })),
  });

  return role;
}

// ───────────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seeding RCC-HIROS database...");

  // ─────────────────────────────────────────────────────────────
  // 1. Groups
  // ─────────────────────────────────────────────────────────────
  console.log("• Creating groups...");
  const accounting = await prisma.group.upsert({
    where: { code: "ACCT" },
    update: { name: "Accounting", description: "Finance & Accounting Office", active: true },
    create: {
      name: "Accounting",
      code: "ACCT",
      description: "Finance & Accounting Office",
      active: true,
    },
  });
  const ccs = await prisma.group.upsert({
    where: { code: "CCS" },
    update: { name: "College of Computer Studies", description: "CCS faculty & staff", active: true },
    create: {
      name: "College of Computer Studies",
      code: "CCS",
      description: "CCS faculty & staff",
      active: true,
    },
  });
  const hr = await prisma.group.upsert({
    where: { code: "HR" },
    update: { name: "Human Resources", description: "HR Office", active: true },
    create: {
      name: "Human Resources",
      code: "HR",
      description: "HR Office",
      active: true,
    },
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Roles
  // ─────────────────────────────────────────────────────────────
  console.log("• Creating roles...");
  const systemAdmin = await upsertRole(
    "System Admin",
    "Full system access — bypasses all permission checks",
    {
      scopeAllProfiling: true,
      scopeAllEvaluation: true,
      scopeAllLeave: true,
      scopeAllReports: true,
      scopeAllAttendance: true,
      canSelfApproveLeave: false,
      isSystem: true,
    },
    ALL_PERMISSIONS
  );

  const accountant = await upsertRole(
    "Accountant",
    "Finance office — accounting & payroll, L2 leave approver",
    {
      scopeAllProfiling: true,
      scopeAllEvaluation: true,
      scopeAllLeave: true,
      scopeAllReports: true,
      scopeAllAttendance: true,
      canSelfApproveLeave: true,
      isSystem: false,
    },
    ACCOUNTANT_PERMS
  );

  const hrPersonnel = await upsertRole(
    "HR Personnel",
    "HR office — manages employees, leaves, evaluations config",
    {
      scopeAllProfiling: true,
      scopeAllEvaluation: true,
      scopeAllLeave: true,
      scopeAllReports: true,
      scopeAllAttendance: true,
      canSelfApproveLeave: false,
      isSystem: false,
    },
    HR_PERMS
  );

  const dean = await upsertRole(
    "Dean",
    "College Dean — L1 leave approver, evaluates faculty",
    {
      scopeAllProfiling: false,
      scopeAllEvaluation: false,
      scopeAllLeave: false,
      scopeAllReports: false,
      scopeAllAttendance: false,
      canSelfApproveLeave: false,
      isSystem: false,
    },
    DEAN_PERMS
  );

  const itStaff = await upsertRole(
    "IT Staff",
    "IT office — manages roles, system config, leave types",
    {
      scopeAllProfiling: true,
      scopeAllEvaluation: true,
      scopeAllLeave: true,
      scopeAllReports: true,
      scopeAllAttendance: true,
      canSelfApproveLeave: false,
      isSystem: false,
    },
    IT_STAFF_PERMS
  );

  const professor = await upsertRole(
    "Professor",
    "Faculty — clocks in/out, requests leave, views own evaluations",
    {
      scopeAllProfiling: false,
      scopeAllEvaluation: false,
      scopeAllLeave: false,
      scopeAllReports: false,
      scopeAllAttendance: false,
      canSelfApproveLeave: false,
      isSystem: false,
    },
    PROFESSOR_PERMS
  );

  // ─────────────────────────────────────────────────────────────
  // 3. Employees (password = RCC2026!)
  // ─────────────────────────────────────────────────────────────
  console.log("• Creating employees (password: RCC2026!)...");
  const passwordHash = await hash(DEFAULT_PASSWORD, 10);

  const employees = [
    {
      employeeId: "EMP-0000",
      firstName: "System",
      lastName: "Administrator",
      middleName: null,
      email: "admin@rcc.edu.ph",
      phone: "+63 917 000 0000",
      gender: "Male",
      groupId: null,
      roleId: systemAdmin.id,
      contractType: "Regular",
    },
    {
      employeeId: "EMP-0001",
      firstName: "Jeremiah",
      lastName: "Sawal",
      middleName: "D.",
      email: "jeremiah.sawal@rcc.edu.ph",
      phone: "+63 917 000 0001",
      gender: "Male",
      groupId: hr.id,
      roleId: hrPersonnel.id,
      contractType: "Regular",
    },
    {
      employeeId: "EMP-0002",
      firstName: "Cristina",
      lastName: "Reyes",
      middleName: null,
      email: "cristina.reyes@rcc.edu.ph",
      phone: "+63 917 000 0002",
      gender: "Female",
      groupId: accounting.id,
      roleId: accountant.id,
      contractType: "Regular",
    },
    {
      employeeId: "EMP-0003",
      firstName: "Neil",
      lastName: "Datu",
      middleName: "P.",
      email: "neil.datu@rcc.edu.ph",
      phone: "+63 917 000 0003",
      gender: "Male",
      groupId: ccs.id,
      roleId: dean.id,
      contractType: "Regular",
    },
    {
      employeeId: "EMP-0004",
      firstName: "Leander",
      lastName: "Pamintuan",
      middleName: null,
      email: "leander.pamintuan@rcc.edu.ph",
      phone: "+63 917 000 0004",
      gender: "Male",
      groupId: ccs.id,
      roleId: itStaff.id,
      contractType: "Regular",
    },
    {
      employeeId: "EMP-0005",
      firstName: "Darwin",
      lastName: "Medina",
      middleName: "G.",
      email: "darwin.medina@rcc.edu.ph",
      phone: "+63 917 000 0005",
      gender: "Male",
      groupId: ccs.id,
      roleId: professor.id,
      contractType: "Regular",
    },
  ];

  const createdEmployees: Record<string, string> = {}; // employeeId -> db id
  for (const emp of employees) {
    const created = await prisma.employee.upsert({
      where: { employeeId: emp.employeeId },
      update: {
        firstName: emp.firstName,
        lastName: emp.lastName,
        middleName: emp.middleName,
        email: emp.email,
        phone: emp.phone,
        gender: emp.gender,
        groupId: emp.groupId,
        roleId: emp.roleId,
        contractType: emp.contractType,
        active: true,
        passwordHash,
        mustChangePwd: false,
      },
      create: {
        employeeId: emp.employeeId,
        firstName: emp.firstName,
        lastName: emp.lastName,
        middleName: emp.middleName,
        email: emp.email,
        phone: emp.phone,
        gender: emp.gender,
        groupId: emp.groupId,
        roleId: emp.roleId,
        contractType: emp.contractType,
        active: true,
        passwordHash,
        mustChangePwd: false,
        hireDate: new Date(`${YEAR}-01-01T00:00:00.000Z`),
      },
    });
    createdEmployees[emp.employeeId] = created.id;
  }

  // ─────────────────────────────────────────────────────────────
  // 4. Leave types
  // ─────────────────────────────────────────────────────────────
  console.log("• Creating leave types...");
  const sickLeave = await prisma.leaveType.upsert({
    where: { code: "SL" },
    update: { name: "Sick Leave", defaultDays: 10, carryOver: true, active: true },
    create: { name: "Sick Leave", code: "SL", defaultDays: 10, carryOver: true, active: true },
  });
  const vacationLeave = await prisma.leaveType.upsert({
    where: { code: "VL" },
    update: { name: "Vacation Leave", defaultDays: 15, carryOver: true, active: true },
    create: { name: "Vacation Leave", code: "VL", defaultDays: 15, carryOver: true, active: true },
  });
  const emergencyLeave = await prisma.leaveType.upsert({
    where: { code: "EL" },
    update: { name: "Emergency Leave", defaultDays: 5, carryOver: false, active: true },
    create: { name: "Emergency Leave", code: "EL", defaultDays: 5, carryOver: false, active: true },
  });
  const leaveTypes = [sickLeave, vacationLeave, emergencyLeave];

  // ─────────────────────────────────────────────────────────────
  // 5. Leave balances — all 6 employees × 3 types × 2026
  // ─────────────────────────────────────────────────────────────
  console.log("• Creating leave balances...");
  for (const emp of employees) {
    for (const lt of leaveTypes) {
      await prisma.leaveBalance.upsert({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: createdEmployees[emp.employeeId],
            leaveTypeId: lt.id,
            year: YEAR,
          },
        },
        update: { totalDays: lt.defaultDays, usedDays: 0 },
        create: {
          employeeId: createdEmployees[emp.employeeId],
          leaveTypeId: lt.id,
          year: YEAR,
          totalDays: lt.defaultDays,
          usedDays: 0,
        },
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 6. Sample leave requests — 4 different states
  // ─────────────────────────────────────────────────────────────
  console.log("• Creating sample leave requests...");
  const profId = createdEmployees["EMP-0005"]; // Darwin
  const deanId = createdEmployees["EMP-0003"]; // Neil
  const hrId = createdEmployees["EMP-0001"]; // Jeremiah

  // Delete existing sample requests (best-effort) to avoid unique constraint on requestNo
  await prisma.leaveRequest.deleteMany({});
  await prisma.leaveApproval.deleteMany({});

  // Request 1: pending_l1 — Darwin sick leave, awaiting Dean
  const lr1 = await prisma.leaveRequest.create({
    data: {
      requestNo: "LR-0001",
      employeeId: profId,
      leaveTypeId: sickLeave.id,
      startDate: new Date(`${YEAR}-02-10T00:00:00.000Z`),
      endDate: new Date(`${YEAR}-02-11T00:00:00.000Z`),
      workdays: 2,
      reason: "Flu — advised bed rest by physician.",
      status: "pending_l1",
    },
  });
  await prisma.leaveApproval.create({
    data: {
      leaveRequestId: lr1.id,
      level: 1,
      approverId: deanId,
      status: "pending",
    },
  });

  // Request 2: pending_l2 — Darwin vacation leave, approved by Dean, awaiting HR
  const lr2 = await prisma.leaveRequest.create({
    data: {
      requestNo: "LR-0002",
      employeeId: profId,
      leaveTypeId: vacationLeave.id,
      startDate: new Date(`${YEAR}-03-15T00:00:00.000Z`),
      endDate: new Date(`${YEAR}-03-19T00:00:00.000Z`),
      workdays: 5,
      reason: "Family vacation — planned since December.",
      status: "pending_l2",
    },
  });
  await prisma.leaveApproval.create({
    data: {
      leaveRequestId: lr2.id,
      level: 1,
      approverId: deanId,
      status: "approved",
      remarks: "Approved — coverage arranged.",
      actedAt: new Date(`${YEAR}-02-01T10:00:00.000Z`),
    },
  });
  await prisma.leaveApproval.create({
    data: {
      leaveRequestId: lr2.id,
      level: 2,
      approverId: hrId,
      status: "pending",
    },
  });

  // Request 3: approved — Cristina emergency leave (self-approved via canSelfApproveLeave)
  const acctId = createdEmployees["EMP-0002"];
  const lr3 = await prisma.leaveRequest.create({
    data: {
      requestNo: "LR-0003",
      employeeId: acctId,
      leaveTypeId: emergencyLeave.id,
      startDate: new Date(`${YEAR}-01-20T00:00:00.000Z`),
      endDate: new Date(`${YEAR}-01-20T00:00:00.000Z`),
      workdays: 1,
      reason: "Family emergency.",
      status: "approved",
    },
  });
  await prisma.leaveApproval.create({
    data: {
      leaveRequestId: lr3.id,
      level: 1,
      approverId: acctId,
      status: "approved",
      remarks: "Self-approved (Accountant role).",
      actedAt: new Date(`${YEAR}-01-18T09:00:00.000Z`),
    },
  });
  await prisma.leaveApproval.create({
    data: {
      leaveRequestId: lr3.id,
      level: 2,
      approverId: acctId,
      status: "approved",
      remarks: "Self-approved (Accountant role).",
      actedAt: new Date(`${YEAR}-01-18T09:00:00.000Z`),
    },
  });
  // Update used days on the balance
  await prisma.leaveBalance.update({
    where: {
      employeeId_leaveTypeId_year: {
        employeeId: acctId,
        leaveTypeId: emergencyLeave.id,
        year: YEAR,
      },
    },
    data: { usedDays: 1 },
  });

  // Request 4: rejected — Darwin emergency leave, rejected by Dean
  const lr4 = await prisma.leaveRequest.create({
    data: {
      requestNo: "LR-0004",
      employeeId: profId,
      leaveTypeId: emergencyLeave.id,
      startDate: new Date(`${YEAR}-01-08T00:00:00.000Z`),
      endDate: new Date(`${YEAR}-01-08T00:00:00.000Z`),
      workdays: 1,
      reason: "Personal matter.",
      status: "rejected",
    },
  });
  await prisma.leaveApproval.create({
    data: {
      leaveRequestId: lr4.id,
      level: 1,
      approverId: deanId,
      status: "rejected",
      remarks: "Insufficient detail. Please resubmit with documentation.",
      actedAt: new Date(`${YEAR}-01-06T14:00:00.000Z`),
    },
  });

  // ─────────────────────────────────────────────────────────────
  // 7. Evaluation form + 10 default criteria (5 categories × 2)
  // ─────────────────────────────────────────────────────────────
  console.log("• Creating evaluation form + criteria...");
  const evalForm = await prisma.evaluationForm.upsert({
    where: { id: "eval-form-faculty-2026" },
    update: { name: "Faculty Evaluation 2026", version: 1, active: true },
    create: {
      id: "eval-form-faculty-2026",
      name: "Faculty Evaluation 2026",
      version: 1,
      active: true,
    },
  });

  const defaultCriteria: Array<{
    category: string;
    description: string;
    weight: number;
    sortOrder: number;
  }> = [
    // Teaching & Instruction
    {
      category: "Teaching & Instruction",
      description: "Demonstrates mastery of subject matter and presents content accurately.",
      weight: 1.5,
      sortOrder: 1,
    },
    {
      category: "Teaching & Instruction",
      description: "Uses varied teaching strategies that engage students effectively.",
      weight: 1.5,
      sortOrder: 2,
    },
    // Classroom Management
    {
      category: "Classroom Management",
      description: "Maintains a safe, orderly, and conducive learning environment.",
      weight: 1.0,
      sortOrder: 3,
    },
    {
      category: "Classroom Management",
      description: "Manages class time effectively and starts/ends on schedule.",
      weight: 1.0,
      sortOrder: 4,
    },
    // Professionalism
    {
      category: "Professionalism",
      description: "Shows punctuality and regular attendance.",
      weight: 1.0,
      sortOrder: 5,
    },
    {
      category: "Professionalism",
      description: "Maintains professional relationships with students and colleagues.",
      weight: 1.0,
      sortOrder: 6,
    },
    // Student Engagement
    {
      category: "Student Engagement",
      description: "Encourages student participation and active learning.",
      weight: 1.0,
      sortOrder: 7,
    },
    {
      category: "Student Engagement",
      description: "Provides timely and constructive feedback on student work.",
      weight: 1.0,
      sortOrder: 8,
    },
    // Curriculum & Assessment
    {
      category: "Curriculum & Assessment",
      description: "Aligns lessons with course outcomes and syllabus.",
      weight: 1.0,
      sortOrder: 9,
    },
    {
      category: "Curriculum & Assessment",
      description: "Uses fair, valid, and reliable assessment methods.",
      weight: 1.0,
      sortOrder: 10,
    },
  ];

  // Replace existing criteria
  await prisma.evaluation.deleteMany({});
  await prisma.evaluationResponse.deleteMany({});
  await prisma.evaluationCriterion.deleteMany({ where: { formId: evalForm.id } });
  const createdCriteria: EvaluationCriterion[] = [];
  for (const c of defaultCriteria) {
    const criterion = await prisma.evaluationCriterion.create({
      data: {
        formId: evalForm.id,
        category: c.category,
        description: c.description,
        maxScore: 5,
        weight: c.weight,
        sortOrder: c.sortOrder,
      },
    });
    createdCriteria.push(criterion);
  }

  // ─────────────────────────────────────────────────────────────
  // 8. Evaluation period — 1st Semester 2026 (open)
  // ─────────────────────────────────────────────────────────────
  console.log("• Creating evaluation period...");
  const evalPeriod = await prisma.evaluationPeriod.upsert({
    where: { id: "eval-period-1s-2026" },
    update: {
      formId: evalForm.id,
      name: "1st Semester 2026",
      startDate: new Date(`${YEAR}-06-01T00:00:00.000Z`),
      endDate: new Date(`${YEAR}-10-31T00:00:00.000Z`),
      status: "open",
    },
    create: {
      id: "eval-period-1s-2026",
      formId: evalForm.id,
      name: "1st Semester 2026",
      startDate: new Date(`${YEAR}-06-01T00:00:00.000Z`),
      endDate: new Date(`${YEAR}-10-31T00:00:00.000Z`),
      status: "open",
    },
  });

  // ─────────────────────────────────────────────────────────────
  // 9. Submitted evaluation — Neil (evaluator) → Darwin (employee), score 4.50
  // ─────────────────────────────────────────────────────────────
  console.log("• Creating sample evaluation (Neil → Darwin, 4.50)...");
  await prisma.evaluation.deleteMany({
    where: {
      periodId: evalPeriod.id,
      evaluatorId: deanId,
      employeeId: profId,
    },
  });

  // Build response data: average ~4.5 across 10 criteria
  // Use weights to balance — total weighted average should be 4.50
  // We'll set scores alternating 4 and 5 so simple avg = 4.5
  const responses = createdCriteria.map((c, i) => ({
    criterionId: c.id,
    score: i % 2 === 0 ? 5 : 4,
    comments: null as string | null,
  }));

  // Weighted total score
  const totalWeight = createdCriteria.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = createdCriteria.reduce(
    (sum, c, i) => sum + c.weight * responses[i].score,
    0
  );
  const totalScore = Number((weightedSum / totalWeight).toFixed(2));

  const submittedEval = await prisma.evaluation.create({
    data: {
      periodId: evalPeriod.id,
      formId: evalForm.id,
      evaluatorId: deanId,
      employeeId: profId,
      status: "submitted",
      totalScore,
      remarks:
        "Strong performance overall. Continue developing student engagement strategies.",
      submittedAt: new Date(`${YEAR}-10-15T14:30:00.000Z`),
      responses: {
        create: responses,
      },
    },
  });
  console.log(`  Evaluation ${submittedEval.id} created with totalScore=${totalScore}`);

  // ─────────────────────────────────────────────────────────────
  // 10. System settings — premises config
  // ─────────────────────────────────────────────────────────────
  console.log("• Creating system settings...");
  const premisesValue = JSON.stringify({
    lat: 15.1428,
    lng: 120.5886,
    radiusMeters: 200,
    label: "Republic Central Colleges — Angeles",
  });
  await prisma.systemSetting.upsert({
    where: { key: "premises_config" },
    update: { value: premisesValue, category: "attendance" },
    create: {
      key: "premises_config",
      value: premisesValue,
      category: "attendance",
    },
  });

  // ─────────────────────────────────────────────────────────────
  // 11. Attendance — 4 records for today
  // ─────────────────────────────────────────────────────────────
  console.log("• Creating attendance records for today...");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDate = new Date(today);

  // Premises coordinates (Angeles campus)
  const lat = 15.1428;
  const lng = 120.5886;

  // 4 employees clocked in today; first 2 also clocked out
  const attendanceEmployees = [
    { empId: "EMP-0001", clockInHour: 7, clockInMin: 55, clockedOut: true, clockOutHour: 17, clockOutMin: 5 },
    { empId: "EMP-0002", clockInHour: 8, clockInMin: 2, clockedOut: true, clockOutHour: 17, clockOutMin: 10 },
    { empId: "EMP-0003", clockInHour: 8, clockInMin: 15, clockedOut: false, clockOutHour: 0, clockOutMin: 0 },
    { empId: "EMP-0005", clockInHour: 9, clockInMin: 5, clockedOut: false, clockOutHour: 0, clockOutMin: 0 },
  ];

  // Clean today's records (best-effort)
  await prisma.attendance.deleteMany({
    where: { date: { gte: todayDate, lte: new Date(todayDate.getTime() + 86_400_000) } },
  });

  for (const a of attendanceEmployees) {
    const empDbId = createdEmployees[a.empId];
    const clockInAt = new Date(todayDate);
    clockInAt.setHours(a.clockInHour, a.clockInMin, 0, 0);

    const data: Record<string, unknown> = {
      employeeId: empDbId,
      date: todayDate,
      clockInAt,
      clockInLat: lat,
      clockInLng: lng,
      clockInOnPremise: true,
      clockInDistance: 0,
      biometricVerified: false,
      manuallyEdited: false,
    };

    if (a.clockedOut) {
      const clockOutAt = new Date(todayDate);
      clockOutAt.setHours(a.clockOutHour, a.clockOutMin, 0, 0);
      data.clockOutAt = clockOutAt;
      data.clockOutLat = lat;
      data.clockOutLng = lng;
      data.clockOutOnPremise = true;
      data.clockOutDistance = 0;
    }

    await prisma.attendance.create({ data: data as never });
  }

  // ─────────────────────────────────────────────────────────────
  // Done
  // ─────────────────────────────────────────────────────────────
  console.log("");
  console.log("✅ Seed complete!");
  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔑 LOGIN CREDENTIALS (password: RCC2026!)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("EMP-0000 / admin@rcc.edu.ph              → System Admin");
  console.log("EMP-0001 / jeremiah.sawal@rcc.edu.ph     → HR Personnel");
  console.log("EMP-0002 / cristina.reyes@rcc.edu.ph     → Accountant");
  console.log("EMP-0003 / neil.datu@rcc.edu.ph          → Dean");
  console.log("EMP-0004 / leander.pamintuan@rcc.edu.ph  → IT Staff");
  console.log("EMP-0005 / darwin.medina@rcc.edu.ph      → Professor");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("❌ Seed failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
