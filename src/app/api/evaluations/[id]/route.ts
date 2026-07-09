import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-token";

// ═══════════════════════════════════════════════════════════════
// /api/evaluations/[id]
// GET auth — single evaluation with access check
//   Access: evaluator, evaluated employee, or view_all/scopeAllEvaluation
// ═══════════════════════════════════════════════════════════════

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const { id } = await params;
    const evaluation = await db.evaluation.findUnique({
      where: { id },
      include: {
        evaluator: { select: { id: true, firstName: true, lastName: true } },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            groupId: true,
          },
        },
        form: {
          select: {
            id: true,
            name: true,
            criteria: { orderBy: { sortOrder: "asc" } },
          },
        },
        period: { select: { id: true, name: true, status: true } },
        responses: true,
      },
    });

    if (!evaluation) {
      return NextResponse.json(
        { error: "Evaluation not found" },
        { status: 404 }
      );
    }

    // Access check
    const isEvaluator = evaluation.evaluatorId === user.id;
    const isSubject = evaluation.employeeId === user.id;
    const canViewAll =
      user.isSystem ||
      user.permissions.includes("evaluation.view_results") ||
      user.permissions.includes("evaluation.view") ||
      user.scopeAllEvaluation ||
      (user.groupId && evaluation.employee?.groupId === user.groupId);

    if (!isEvaluator && !isSubject && !canViewAll) {
      return NextResponse.json(
        { error: "You do not have access to this evaluation" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      evaluation: {
        id: evaluation.id,
        periodId: evaluation.periodId,
        formId: evaluation.formId,
        evaluatorId: evaluation.evaluatorId,
        evaluator: evaluation.evaluator
          ? {
              id: evaluation.evaluator.id,
              name: `${evaluation.evaluator.firstName} ${evaluation.evaluator.lastName}`.trim(),
            }
          : null,
        employeeId: evaluation.employeeId,
        employee: evaluation.employee
          ? {
              id: evaluation.employee.id,
              name: `${evaluation.employee.firstName} ${evaluation.employee.lastName}`.trim(),
              employeeId: evaluation.employee.employeeId,
              groupId: evaluation.employee.groupId,
            }
          : null,
        status: evaluation.status,
        totalScore: evaluation.totalScore,
        remarks: evaluation.remarks,
        submittedAt: evaluation.submittedAt?.toISOString() ?? null,
        createdAt: evaluation.createdAt.toISOString(),
        updatedAt: evaluation.updatedAt.toISOString(),
        form: evaluation.form
          ? {
              id: evaluation.form.id,
              name: evaluation.form.name,
              criteria: evaluation.form.criteria.map((c) => ({
                id: c.id,
                category: c.category,
                description: c.description,
                maxScore: c.maxScore,
                weight: c.weight,
                sortOrder: c.sortOrder,
              })),
            }
          : null,
        period: evaluation.period,
        responses: evaluation.responses.map((r) => ({
          id: r.id,
          criterionId: r.criterionId,
          score: r.score,
          comments: r.comments,
        })),
      },
    });
  } catch (error) {
    console.error("[API /evaluations/[id] GET] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
