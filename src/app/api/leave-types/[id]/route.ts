import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-token";

// ═══════════════════════════════════════════════════════════════
// /api/leave-types/[id]
// PATCH   leave.manage_types — update
// DELETE  leave.manage_types — soft-delete (active=false)
// ═══════════════════════════════════════════════════════════════

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, "leave.manage_types");
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const leaveType = await db.leaveType.findUnique({ where: { id } });
    if (!leaveType) {
      return NextResponse.json(
        { error: "Leave type not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, code, defaultDays, active } = body as {
      name?: string;
      code?: string;
      defaultDays?: number;
      active?: boolean;
    };

    const data: Record<string, unknown> = {};
    if (typeof name === "string" && name.trim() && name !== leaveType.name) {
      const dup = await db.leaveType.findFirst({
        where: { name: name.trim().toLowerCase(), NOT: { id } },
      });
      if (dup) {
        return NextResponse.json(
          { error: "Leave type with this name already exists" },
          { status: 409 }
        );
      }
      data.name = name.trim();
    }
    if (typeof code === "string" && code.trim()) {
      const upper = code.trim().toUpperCase();
      if (upper !== leaveType.code) {
        const dup = await db.leaveType.findUnique({ where: { code: upper } });
        if (dup && dup.id !== id) {
          return NextResponse.json(
            { error: "Leave type with this code already exists" },
            { status: 409 }
          );
        }
        data.code = upper;
      }
    }
    if (defaultDays !== undefined) data.defaultDays = Number(defaultDays) || 0;
    if (active !== undefined) data.active = !!active;

    const updated = await db.leaveType.update({ where: { id }, data });

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: "Update Leave Type",
        entity: "LeaveType",
        entityId: id,
        metadata: JSON.stringify({ fields: Object.keys(data) }),
      },
    });

    return NextResponse.json({ leaveType: updated });
  } catch (error) {
    console.error("[API /leave-types/[id] PATCH] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, "leave.manage_types");
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const leaveType = await db.leaveType.findUnique({ where: { id } });
    if (!leaveType) {
      return NextResponse.json(
        { error: "Leave type not found" },
        { status: 404 }
      );
    }

    // Soft-delete by setting active=false
    await db.leaveType.update({ where: { id }, data: { active: false } });

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: "Deactivate Leave Type",
        entity: "LeaveType",
        entityId: id,
        metadata: JSON.stringify({ name: leaveType.name, code: leaveType.code }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API /leave-types/[id] DELETE] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
