import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-token";

// ═══════════════════════════════════════════════════════════════
// POST /api/leave-requests/[id]/approve
// Body: { level, action, remarks }
//   level: 1 (L1) or 2 (L2)
//   action: "approve" | "reject"
//
// Edge Cases:
//   1 — auto-finalize: if no L2 approver exists in the system, L1 approve → final
//   2 — block self-approval unless canSelfApproveLeave; block L2 if same
//       person performed L1
//   5 — rejection wins: any rejection finalizes the request as rejected
// On final approval, increment leave balance usedDays for the year of
// the leave's start date.
// ═══════════════════════════════════════════════════════════════

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const { id } = await params;
    const body = await request.json();
    const { level, action, remarks } = body as {
      level?: number;
      action?: string;
      remarks?: string;
    };

    if (level !== 1 && level !== 2) {
      return NextResponse.json(
        { error: "Level must be 1 or 2" },
        { status: 400 }
      );
    }
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { error: "Action must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    // Permission check (system bypasses)
    const requiredPerm = level === 1 ? "leave.approve_l1" : "leave.approve_l2";
    if (!user.isSystem && !user.permissions.includes(requiredPerm)) {
      return NextResponse.json(
        { error: "Forbidden — insufficient permissions" },
        { status: 403 }
      );
    }

    const req = await db.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, groupId: true } },
        approvals: true,
      },
    });
    if (!req) {
      return NextResponse.json(
        { error: "Leave request not found" },
        { status: 404 }
      );
    }

    // Status check: must be in the appropriate pending state
    if (level === 1 && req.status !== "pending_l1") {
      return NextResponse.json(
        { error: `Request is not pending L1 approval (status: ${req.status})` },
        { status: 400 }
      );
    }
    if (level === 2 && req.status !== "pending_l2") {
      return NextResponse.json(
        { error: `Request is not pending L2 approval (status: ${req.status})` },
        { status: 400 }
      );
    }

    // Edge Case 2 — Block self-approval unless canSelfApproveLeave
    const isRequester = req.employeeId === user.id;
    if (isRequester && !user.canSelfApproveLeave && !user.isSystem) {
      return NextResponse.json(
        { error: "You cannot approve your own leave request" },
        { status: 403 }
      );
    }

    // Edge Case 2 — Block L2 if same person did L1
    if (level === 2) {
      const l1Approval = req.approvals.find((a) => a.level === 1);
      if (l1Approval && l1Approval.approverId === user.id && !user.isSystem) {
        return NextResponse.json(
          {
            error:
              "You cannot approve at L2 if you already approved at L1 for this request",
          },
          { status: 403 }
        );
      }
    }

    // Group scoping: same group, scopeAllLeave, or isRequester (system bypasses)
    if (!user.isSystem && !user.scopeAllLeave && !isRequester) {
      if (!user.groupId || req.employee?.groupId !== user.groupId) {
        return NextResponse.json(
          {
            error:
              "You can only act on leave requests from your own group",
          },
          { status: 403 }
        );
      }
    }

    // Edge Case 5 — Rejection wins
    if (action === "reject") {
      await db.$transaction(async (tx) => {
        await tx.leaveApproval.create({
          data: {
            leaveRequestId: id,
            level,
            approverId: user.id,
            status: "rejected",
            remarks: remarks?.trim() || null,
            actedAt: new Date(),
          },
        });
        await tx.leaveRequest.update({
          where: { id },
          data: { status: "rejected" },
        });
      });

      await db.auditLog.create({
        data: {
          userId: user.id,
          action: `Reject Leave (L${level})`,
          entity: "LeaveRequest",
          entityId: id,
          metadata: JSON.stringify({ requestNo: req.requestNo, remarks }),
        },
      });

      return NextResponse.json({ success: true, status: "rejected" });
    }

    // action === "approve"
    // Edge Case 1 — Check if any L2 approver exists (only relevant when L1 approves)
    let l2ApproversExist = true;
    if (level === 1) {
      const l2Approvers = await db.employee.count({
        where: {
          active: true,
          role: {
            active: true,
            permissions: {
              some: { identifier: "leave.approve_l2", granted: true },
            },
          },
        },
      });
      l2ApproversExist = l2Approvers > 0;
    }

    let newStatus: string;
    let finalApproval = false;

    if (level === 1) {
      if (l2ApproversExist) {
        newStatus = "pending_l2";
      } else {
        // Edge Case 1 — auto-finalize: no L2 approver, so L1 is final
        newStatus = "approved";
        finalApproval = true;
      }
    } else {
      // L2 approve — always final
      newStatus = "approved";
      finalApproval = true;
    }

    await db.$transaction(async (tx) => {
      await tx.leaveApproval.create({
        data: {
          leaveRequestId: id,
          level,
          approverId: user.id,
          status: "approved",
          remarks: remarks?.trim() || null,
          actedAt: new Date(),
        },
      });
      await tx.leaveRequest.update({
        where: { id },
        data: { status: newStatus },
      });

      if (finalApproval) {
        // Increment leave balance usedDays
        const year = req.startDate.getFullYear();
        const balance = await tx.leaveBalance.findUnique({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: req.employeeId,
              leaveTypeId: req.leaveTypeId,
              year,
            },
          },
        });
        if (balance) {
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: { usedDays: balance.usedDays + req.workdays },
          });
        } else {
          // Create the balance row (no initial allocation)
          await tx.leaveBalance.create({
            data: {
              employeeId: req.employeeId,
              leaveTypeId: req.leaveTypeId,
              year,
              totalDays: 0,
              usedDays: req.workdays,
            },
          });
        }
      }
    });

    await db.auditLog.create({
      data: {
        userId: user.id,
        action: `Approve Leave (L${level})`,
        entity: "LeaveRequest",
        entityId: id,
        metadata: JSON.stringify({
          requestNo: req.requestNo,
          newStatus,
          finalApproval,
        }),
      },
    });

    return NextResponse.json({ success: true, status: newStatus, finalApproval });
  } catch (error) {
    console.error("[API /leave-requests/[id]/approve] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
