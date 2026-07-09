import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-token";

// ═══════════════════════════════════════════════════════════════
// POST /api/evaluations/reset
//   Deletes ALL submitted evaluations (keeps forms, criteria, periods).
//   Requires evaluation.reset permission.
//   Body: { confirm: true } — safety check
// ═══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "evaluation.reset");
    if (!auth.ok) return auth.response;

    const body = await request.json();
    if (!body.confirm) {
      return NextResponse.json(
        { error: "Confirmation required. Send { confirm: true } to proceed." },
        { status: 400 }
      );
    }

    // Delete all evaluation responses first (FK constraint), then evaluations
    const deletedResponses = await db.evaluationResponse.deleteMany({});
    const deletedEvaluations = await db.evaluation.deleteMany({});

    return NextResponse.json({
      success: true,
      deletedEvaluations: deletedEvaluations.count,
      deletedResponses: deletedResponses.count,
    });
  } catch (error) {
    console.error("[API /evaluations/reset] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
