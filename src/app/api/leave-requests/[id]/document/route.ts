import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-token";
import { readFile } from "fs/promises";
import path from "path";

// ═══════════════════════════════════════════════════════════════
// GET /api/leave-requests/[id]/document
// Serve attached document with Content-Disposition: inline.
// Access: requester, approver (existing approval), or view_all/scopeAllLeave.
// ═══════════════════════════════════════════════════════════════

const UPLOAD_ROOT = path.join(process.cwd(), "uploads", "leave-docs");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const { id } = await params;
    const req = await db.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: { select: { groupId: true } },
        approvals: { select: { approverId: true } },
      },
    });
    if (!req) {
      return NextResponse.json(
        { error: "Leave request not found" },
        { status: 404 }
      );
    }
    if (!req.documentFileName) {
      return NextResponse.json(
        { error: "No document attached to this request" },
        { status: 404 }
      );
    }

    const isRequester = req.employeeId === user.id;
    const isApprover = req.approvals.some((a) => a.approverId === user.id);
    const canViewAll =
      user.isSystem ||
      user.permissions.includes("leave.view_all") ||
      user.scopeAllLeave ||
      (user.groupId && req.employee?.groupId === user.groupId);

    if (!isRequester && !isApprover && !canViewAll) {
      return NextResponse.json(
        { error: "You do not have access to this document" },
        { status: 403 }
      );
    }

    const filePath = path.join(UPLOAD_ROOT, req.documentFileName);
    let buffer: Buffer;
    try {
      buffer = await readFile(filePath);
    } catch {
      return NextResponse.json(
        { error: "Document missing from disk" },
        { status: 410 }
      );
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": req.documentMimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(
          req.documentOriginalName || req.documentFileName || ""
        )}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, max-age=0, no-cache",
      },
    });
  } catch (error) {
    console.error("[API /leave-requests/[id]/document GET] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
