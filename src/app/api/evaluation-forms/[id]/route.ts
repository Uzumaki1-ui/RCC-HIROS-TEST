import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-token";

// ═══════════════════════════════════════════════════════════════
// /api/evaluation-forms/[id]
// GET    evaluation.view          — single form
// PATCH  evaluation.manage_forms  — update name/active
// DELETE evaluation.manage_forms  — soft-delete (active=false)
// ═══════════════════════════════════════════════════════════════

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, "evaluation.view");
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const form = await db.evaluationForm.findUnique({
      where: { id },
      include: {
        criteria: { orderBy: { sortOrder: "asc" } },
        _count: { select: { periods: true, evaluations: true } },
      },
    });
    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    return NextResponse.json({
      form: {
        id: form.id,
        name: form.name,
        version: form.version,
        active: form.active,
        createdAt: form.createdAt.toISOString(),
        updatedAt: form.updatedAt.toISOString(),
        criteria: form.criteria.map((c) => ({
          id: c.id,
          category: c.category,
          description: c.description,
          maxScore: c.maxScore,
          weight: c.weight,
          sortOrder: c.sortOrder,
        })),
        periodsCount: form._count.periods,
        evaluationsCount: form._count.evaluations,
      },
    });
  } catch (error) {
    console.error("[API /evaluation-forms/[id] GET] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, "evaluation.manage_forms");
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const form = await db.evaluationForm.findUnique({ where: { id } });
    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, active, criteria } = body as {
      name?: string;
      active?: boolean;
      criteria?: {
        id?: string;
        category: string;
        description: string;
        maxScore?: number;
        weight?: number;
        sortOrder?: number;
      }[];
    };

    const data: Record<string, unknown> = {};
    if (typeof name === "string" && name.trim() && name !== form.name) {
      const dup = await db.evaluationForm.findFirst({
        where: { name: name.trim().toLowerCase(), NOT: { id } },
      });
      if (dup) {
        return NextResponse.json(
          { error: "Form with this name already exists" },
          { status: 409 }
        );
      }
      data.name = name.trim();
    }
    if (active !== undefined) data.active = !!active;

    await db.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.evaluationForm.update({ where: { id }, data });
      }
      if (Array.isArray(criteria)) {
        // Replace criteria wholesale
        await tx.evaluationCriterion.deleteMany({ where: { formId: id } });
        if (criteria.length > 0) {
          await tx.evaluationCriterion.createMany({
            data: criteria.map((c, idx) => ({
              formId: id,
              category: c.category,
              description: c.description,
              maxScore: typeof c.maxScore === "number" ? c.maxScore : 5,
              weight: typeof c.weight === "number" ? c.weight : 1.0,
              sortOrder: typeof c.sortOrder === "number" ? c.sortOrder : idx,
            })),
          });
        }
      }
    });

    const updated = await db.evaluationForm.findUnique({
      where: { id },
      include: {
        criteria: { orderBy: { sortOrder: "asc" } },
        _count: { select: { periods: true } },
      },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: "Update Evaluation Form",
        entity: "EvaluationForm",
        entityId: id,
        metadata: JSON.stringify({ fields: Object.keys(data) }),
      },
    });

    return NextResponse.json({
      form: updated
        ? {
            id: updated.id,
            name: updated.name,
            version: updated.version,
            active: updated.active,
            criteria: updated.criteria.map((c) => ({
              id: c.id,
              category: c.category,
              description: c.description,
              maxScore: c.maxScore,
              weight: c.weight,
              sortOrder: c.sortOrder,
            })),
            periodsCount: updated._count.periods,
          }
        : null,
    });
  } catch (error) {
    console.error("[API /evaluation-forms/[id] PATCH] Error:", error);
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
    const form = await db.evaluationForm.findUnique({ where: { id } });
    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    // Soft-delete
    await db.evaluationForm.update({ where: { id }, data: { active: false } });

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: "Deactivate Evaluation Form",
        entity: "EvaluationForm",
        entityId: id,
        metadata: JSON.stringify({ name: form.name }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API /evaluation-forms/[id] DELETE] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
