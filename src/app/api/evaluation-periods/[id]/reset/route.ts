import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-token";

// ═══════════════════════════════════════════════════════════════
// POST /api/evaluation-periods/[id]/reset
//   Deletes all evaluations + responses for THIS period only.
//   Requires evaluation.reset permission.
// ═══════════════════════════════════════════════════════════════

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, "evaluation.reset");
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const period = await db.evaluationPeriod.findUnique({ where: { id } });
    if (!period) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }

    // Delete responses first (FK constraint), then evaluations for this period
    const evaluations = await db.evaluation.findMany({
      where: { periodId: id },
      select: { id: true },
    });
    const evalIds = evaluations.map((e) => e.id);

    if (evalIds.length > 0) {
      await db.evaluationResponse.deleteMany({
        where: { evaluationId: { in: evalIds } },
      });
      await db.evaluation.deleteMany({
        where: { periodId: id },
      });
    }

    return NextResponse.json({
      success: true,
      deletedEvaluations: evalIds.length,
    });
  } catch (error) {
    console.error("[API /evaluation-periods/[id]/reset] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
