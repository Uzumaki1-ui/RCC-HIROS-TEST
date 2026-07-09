import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireAuth,
  requirePermission,
} from "@/lib/auth-token";

// ═══════════════════════════════════════════════════════════════
// GET   /api/evaluation-periods  auth                    — list periods
// POST  /api/evaluation-periods  evaluation.manage_forms — create period
// ═══════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const periods = await db.evaluationPeriod.findMany({
      include: {
        form: { select: { id: true, name: true, active: true } },
        _count: { select: { evaluations: true } },
      },
      orderBy: { startDate: "desc" },
    });

    return NextResponse.json({
      periods: periods.map((p) => ({
        id: p.id,
        formId: p.formId,
        form: p.form,
        name: p.name,
        startDate: p.startDate.toISOString(),
        endDate: p.endDate.toISOString(),
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        evaluationsCount: p._count.evaluations,
      })),
    });
  } catch (error) {
    console.error("[API /evaluation-periods GET] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "evaluation.manage_forms");
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { formId, name, startDate, endDate, status = "open" } = body as {
      formId?: string;
      name?: string;
      startDate?: string;
      endDate?: string;
      status?: string;
    };

    if (!formId || !name || !startDate || !endDate) {
      return NextResponse.json(
        { error: "formId, name, startDate, and endDate are required" },
        { status: 400 }
      );
    }

    const form = await db.evaluationForm.findUnique({ where: { id: formId } });
    if (!form) {
      return NextResponse.json(
        { error: "Evaluation form not found" },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }
    if (end < start) {
      return NextResponse.json(
        { error: "End date cannot be before start date" },
        { status: 400 }
      );
    }

    if (!["open", "closed", "archived"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status value" },
        { status: 400 }
      );
    }

    const period = await db.evaluationPeriod.create({
      data: {
        formId,
        name: name.trim(),
        startDate: start,
        endDate: end,
        status,
      },
      include: {
        form: { select: { id: true, name: true, active: true } },
      },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: "Create Evaluation Period",
        entity: "EvaluationPeriod",
        entityId: period.id,
        metadata: JSON.stringify({ name: period.name, formId }),
      },
    });

    return NextResponse.json({ period }, { status: 201 });
  } catch (error) {
    console.error("[API /evaluation-periods POST] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
