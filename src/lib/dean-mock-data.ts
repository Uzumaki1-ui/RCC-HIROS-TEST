// STUB: This file provides minimal placeholder data for components not yet migrated to real API data.
// As components are migrated, these stubs will be removed.

export const deptEmployees: { id: string; name: string; position: string; status: string; gender: string; employeeClass: string }[] = [];
export const deanPolls = { active: [] as unknown[], closed: [] as unknown[] };
export const deptApplicants = [] as unknown[];
export const deanCertificates = [] as unknown[];
export const deptCertificates = [] as unknown[];
export const deanDeptEvaluations = [] as unknown[];
export const employeesToEvaluate = [] as unknown[];
export const evaluationPeriods = [] as unknown[];
export const deptWellnessAggregates = { Happy: 0, Neutral: 0, Stressed: 0, Sad: 0, trend: [] as { week: string; Happy: number; Neutral: number; Stressed: number; Sad: number }[] };
export const deanGamification = { monthlyPoints: 0, lifetimePoints: 0, breakdown: [] as { action: string; points: number; count: number; total: number }[] };
export const deanLeaderboard = [] as { rank: number; name: string; department: string; monthlyPoints: number; lifetimePoints: number; isCurrentUser?: boolean }[];
export const deanReportData = {
  attendanceMonthly: [] as unknown[],
  positionComparison: [] as { position: string; onTime: number; late: number; absent: number }[],
  leaveByType: [] as unknown[],
  leaveTrend: [] as unknown[],
  headcount: [] as { position: string; total: number; active: number; onLeave: number; male: number; female: number; managerial: number; rankAndFile: number }[],
};
export const deanAttendance = [] as { date: string; clockIn: string; clockOut: string; status: string; hours: string }[];
export const deptAttendanceRecords = [] as { name: string; date: string; clockIn: string; clockOut: string; status: string }[];
export const deptAttendanceToday = { total: 0, present: 0, late: 0, absent: 0 };

// Leave-related stubs
export type LeaveStatus = "Pending" | "Approved" | "Rejected" | "Cancelled";
export const deanLeaveBalances = [] as unknown[];
export const deanLeaveRequests = [] as unknown[];
export const pendingLeaveApprovals = [] as unknown[];
