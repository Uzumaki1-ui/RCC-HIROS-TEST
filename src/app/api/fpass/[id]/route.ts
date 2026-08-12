import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-token";

// ═══════════════════════════════════════════════════════════════
// GET /api/fpass/[id] — get a single submission
// ═══════════════════════════════════════════════════════════════
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, "fpass.fill");
    if (!auth.ok) return auth.response;
    const { user } = auth;
    const { id } = await params;

    const submission = await db.fpassSubmission.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            middleName: true,
            email: true,
            gender: true,
            contractType: true,
            hireDate: true,
            group: { select: { id: true, name: true, code: true } },
            role: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    // Check access: owner or fpass.manage
    const canManage = user.isSystem || user.permissions.includes("fpass.manage");
    if (submission.employeeId !== user.id && !canManage) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    return NextResponse.json({ submission });
  } catch (error) {
    console.error("[API /fpass/[id]] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// PATCH /api/fpass/[id] — update a submission
// ═══════════════════════════════════════════════════════════════
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, "fpass.fill");
    if (!auth.ok) return auth.response;
    const { user } = auth;
    const { id } = await params;

    const existing = await db.fpassSubmission.findUnique({
      where: { id },
      select: { id: true, employeeId: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    // Check access: owner or fpass.manage
    const canManage = user.isSystem || user.permissions.includes("fpass.manage");
    if (existing.employeeId !== user.id && !canManage) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { formData, totalPoints } = body as {
      formData?: string;
      totalPoints?: number;
    };

    const submission = await db.fpassSubmission.update({
      where: { id },
      data: {
        ...(formData !== undefined ? { formData } : {}),
        ...(totalPoints !== undefined ? { totalPoints } : {}),
      },
    });

    return NextResponse.json({ submission });
  } catch (error) {
    console.error("[API /fpass/[id]] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
