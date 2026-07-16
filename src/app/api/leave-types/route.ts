import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth-token";

// ═══════════════════════════════════════════════════════════════
// GET   /api/leave-types   auth only     — list active leave types
// POST  /api/leave-types   leave.manage_types — create
// ═══════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const leaveTypes = await db.leaveType.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ leaveTypes });
  } catch (error) {
    console.error("[API /leave-types GET] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "leave.manage_types");
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { name, code, defaultDays = 0, active = true } = body as {
      name?: string;
      code?: string;
      defaultDays?: number;
      active?: boolean;
    };

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Leave type name is required" },
        { status: 400 }
      );
    }
    if (!code || !code.trim()) {
      return NextResponse.json(
        { error: "Leave type code is required" },
        { status: 400 }
      );
    }

    const upperCode = code.trim().toUpperCase();

    const dupName = await db.leaveType.findFirst({
      where: { name: name.trim().toLowerCase() },
    });
    if (dupName) {
      return NextResponse.json(
        { error: "Leave type with this name already exists" },
        { status: 409 }
      );
    }
    const dupCode = await db.leaveType.findUnique({
      where: { code: upperCode },
    });
    if (dupCode) {
      return NextResponse.json(
        { error: "Leave type with this code already exists" },
        { status: 409 }
      );
    }

    const leaveType = await db.leaveType.create({
      data: {
        name: name.trim(),
        code: upperCode,
        defaultDays: Number(defaultDays) || 0,
        active: !!active,
      },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: "Create Leave Type",
        entity: "LeaveType",
        entityId: leaveType.id,
        metadata: JSON.stringify({ name: leaveType.name, code: leaveType.code }),
      },
    });

    return NextResponse.json({ leaveType }, { status: 201 });
  } catch (error) {
    console.error("[API /leave-types POST] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
