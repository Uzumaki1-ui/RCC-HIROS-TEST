import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-token";

// ═══════════════════════════════════════════════════════════════
// POST /api/evaluations/cleanup
//   Auto-deletes evaluations older than the retention period.
//   Reads the retention setting from SystemSetting key "evaluation_retention_months".
//   Default: 12 months if not configured.
//
//   This endpoint can be called:
//   - Manually by HR from the UI
//   - By a cron job / scheduled task
// ═══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "evaluation.manage_forms");
    if (!auth.ok) return auth.response;

    // Read retention setting
    const setting = await db.systemSetting.findUnique({
      where: { key: "evaluation_retention_months" },
    });
    const retentionMonths = setting ? parseInt(setting.value, 10) : 12;
    if (isNaN(retentionMonths) || retentionMonths < 1) {
      return NextResponse.json(
        { error: "Invalid retention setting" },
        { status: 400 }
      );
    }

    // Calculate cutoff date
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - retentionMonths);

    // Find evaluations older than the cutoff
    const oldEvaluations = await db.evaluation.findMany({
      where: { submittedAt: { lt: cutoff } },
      select: { id: true },
    });
    const oldIds = oldEvaluations.map((e) => e.id);

    if (oldIds.length > 0) {
      // Delete responses first, then evaluations
      await db.evaluationResponse.deleteMany({
        where: { evaluationId: { in: oldIds } },
      });
      await db.evaluation.deleteMany({
        where: { id: { in: oldIds } },
      });
    }

    return NextResponse.json({
      success: true,
      retentionMonths,
      cutoffDate: cutoff.toISOString(),
      deletedEvaluations: oldIds.length,
    });
  } catch (error) {
    console.error("[API /evaluations/cleanup] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET — read the current retention setting
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "evaluation.manage_forms");
    if (!auth.ok) return auth.response;

    const setting = await db.systemSetting.findUnique({
      where: { key: "evaluation_retention_months" },
    });
    const retentionMonths = setting ? parseInt(setting.value, 10) : 12;

    return NextResponse.json({ retentionMonths });
  } catch (error) {
    console.error("[API /evaluations/cleanup GET] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH — update the retention setting
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "evaluation.manage_forms");
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { retentionMonths } = body as { retentionMonths: number };

    if (typeof retentionMonths !== "number" || retentionMonths < 1 || retentionMonths > 120) {
      return NextResponse.json(
        { error: "Retention must be between 1 and 120 months" },
        { status: 400 }
      );
    }

    await db.systemSetting.upsert({
      where: { key: "evaluation_retention_months" },
      create: {
        key: "evaluation_retention_months",
        value: String(retentionMonths),
        category: "evaluation",
      },
      update: { value: String(retentionMonths) },
    });

    return NextResponse.json({ success: true, retentionMonths });
  } catch (error) {
    console.error("[API /evaluations/cleanup PATCH] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
