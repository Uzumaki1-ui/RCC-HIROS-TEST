import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-token";

// ═══════════════════════════════════════════════════════════════
// /api/evaluation-periods/[id]
// PATCH   evaluation.manage_forms — update (status, name, dates)
// DELETE  evaluation.manage_forms — delete
// ═══════════════════════════════════════════════════════════════

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, "evaluation.manage_forms");
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const period = await db.evaluationPeriod.findUnique({ where: { id } });
    if (!period) {
      return NextResponse.json(
        { error: "Evaluation period not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, startDate, endDate, status } = body as {
      name?: string;
      startDate?: string;
      endDate?: string;
      status?: string;
    };

    const data: Record<string, unknown> = {};
    if (typeof name === "string" && name.trim()) data.name = name.trim();
    if (startDate) {
      const d = new Date(startDate);
      if (isNaN(d.getTime())) {
        return NextResponse.json(
          { error: "Invalid startDate" },
          { status: 400 }
        );
      }
      data.startDate = d;
    }
    if (endDate) {
      const d = new Date(endDate);
      if (isNaN(d.getTime())) {
        return NextResponse.json(
          { error: "Invalid endDate" },
          { status: 400 }
        );
      }
      data.endDate = d;
    }
    if (status !== undefined) {
      if (!["open", "closed"].includes(status)) {
        return NextResponse.json(
          { error: "Invalid status value" },
          { status: 400 }
        );
      }
      data.status = status;

      // Auto-close all other open periods when opening this one
      if (status === "open") {
        await db.evaluationPeriod.updateMany({
          where: { id: { not: id }, status: "open" },
          data: { status: "closed" },
        });
      }
    }

    if (data.startDate && data.endDate) {
      if (new Date(data.startDate as string) > new Date(data.endDate as string)) {
        return NextResponse.json(
          { error: "End date cannot be before start date" },
          { status: 400 }
        );
      }
    }

    const updated = await db.evaluationPeriod.update({
      where: { id },
      data,
      include: { form: { select: { id: true, name: true, active: true } } },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: "Update Evaluation Period",
        entity: "EvaluationPeriod",
        entityId: id,
        metadata: JSON.stringify({ fields: Object.keys(data) }),
      },
    });

    return NextResponse.json({ period: updated });
  } catch (error) {
    console.error("[API /evaluation-periods/[id] PATCH] Error:", error);
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
    const auth = await requirePermission(request, "evaluation.manage_forms");
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const period = await db.evaluationPeriod.findUnique({ where: { id } });
    if (!period) {
      return NextResponse.json(
        { error: "Evaluation period not found" },
        { status: 404 }
      );
    }

    if (period.status === "open") {
      return NextResponse.json(
        { error: "Cannot delete an open period. Close it first." },
        { status: 400 }
      );
    }

    await db.evaluationPeriod.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: "Delete Evaluation Period",
        entity: "EvaluationPeriod",
        entityId: id,
        metadata: JSON.stringify({ name: period.name, previousStatus: period.status }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API /evaluation-periods/[id] DELETE] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
