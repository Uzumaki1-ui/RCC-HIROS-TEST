// Shared types and constants still used by components.
// Mock data stubs have been removed — all components now use real API data.

export interface LeaveAllowance {
  id?: string; // database record ID (cuid) for API operations
  leaveTypeId: string;
  code: string;
  type: string;
  total: number;
  used: number;
  enabled: boolean;
}

export const applicantSources: string[] = ["Website", "Referral", "Walk-in", "Job Fair"];
export type ApplicantStage = "New" | "Screening" | "Interview" | "Offer" | "Hired" | "Rejected";
