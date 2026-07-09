// STUB: This file provides minimal placeholder data for components not yet migrated to real API data.
// As components are migrated, these stubs will be removed.

export const hrEmployeeHeadcount = { total: 0, departments: [] as { name: string; count: number; color: string }[] };
export const hrLeaveTrends = [] as { month: string; vacation: number; sick: number; personal: number }[];
export const hrPolls = { active: [] as unknown[], closed: [] as unknown[] };
export const hrApplicants = [] as unknown[];
export const hrAllAttendance = [] as unknown[];
export const hrEmployeeList: { id: string; name: string; department: string; position: string; status: string; gender: string; employeeClass: string; email: string; phone: string; address: string; birthday: string; hireDate: string; salary: number }[] = [];
export const hrOwnCertificates = [] as unknown[];
export const hrVerificationQueue = [] as unknown[];
export const hrAllCertificates = [] as unknown[];
export const hrGamification = { monthlyPoints: 0, lifetimePoints: 0, breakdown: [] as { action: string; points: number; count: number; total: number }[] };
export const hrLeaderboard = [] as { rank: number; name: string; department: string; monthlyPoints: number; lifetimePoints: number; isCurrentUser?: boolean }[];
export const hrReportData = {
  attendanceMonthly: [] as unknown[],
  deptComparison: [] as { dept: string; onTime: number; late: number; absent: number }[],
  leaveByType: [] as unknown[],
  leaveTrend: [] as unknown[],
  headcount: [] as { dept: string; total: number; active: number; onLeave: number; male: number; female: number; managerial: number; rankAndFile: number }[],
};
export const hrAllEvaluations = [] as unknown[];

// Leave-related stubs
export const hrLeaveBalances = [] as unknown[];
export const hrLeaveRequests = [] as unknown[];
export const hrAllLeaveRequests = [] as unknown[];
export const departmentColors = {} as Record<string, string>;
export const hrLeaveTypes = [] as unknown[];

// Wellness stubs
export const hrMoodCategories = [] as unknown[];
export const hrWellnessReminder = { enabled: false, message: "" } as unknown;

// Institution wellness
export const hrInstitutionWellness = {
  distribution: {} as Record<string, number>,
  deptComparison: [] as { dept: string; Happy: number; Neutral: number; Stressed: number; Sad: number }[],
  trend: [] as { week: string; Happy: number; Neutral: number; Stressed: number; Sad: number }[],
};

// Performance management stubs
export const hrEvaluationPeriods = [] as { id: string; name: string; status: string; startDate: string; endDate: string }[];
export const hrPerformanceManagement = [] as { department: string; evaluator: string; evaluationPeriod: string; status: string }[];
