import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireAuth,
  requirePermission,
} from "@/lib/auth-token";

// ═══════════════════════════════════════════════════════════════
// GET   /api/evaluation-forms  auth            — list active forms
// POST  /api/evaluation-forms  evaluation.manage_forms — create form
//   Default 10 criteria across 5 categories × 2 each.
// ═══════════════════════════════════════════════════════════════

const DEFAULT_CRITERIA: {
  category: string;
  description: string;
  maxScore?: number;
  weight?: number;
}[] = [
  { category: "Teaching Competence", description: "Subject matter expertise and delivery" },
  { category: "Teaching Competence", description: "Lesson planning and preparation" },
  { category: "Professionalism", description: "Punctuality and attendance" },
  { category: "Professionalism", description: "Ethical conduct and integrity" },
  { category: "Student Engagement", description: "Classroom interaction and rapport" },
  { category: "Student Engagement", description: "Responsiveness to student needs" },
  { category: "Administrative Duties", description: "Timely submission of reports" },
  { category: "Administrative Duties", description: "Compliance with school policies" },
  { category: "Continuous Improvement", description: "Participation in training and development" },
  { category: "Continuous Improvement", description: "Innovation in teaching methods" },
];

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const forms = await db.evaluationForm.findMany({
      where: { active: true },
      include: {
        _count: {
          select: { criteria: true, periods: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      forms: forms.map((f) => ({
        id: f.id,
        name: f.name,
        version: f.version,
        active: f.active,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
        criteriaCount: f._count.criteria,
        periodsCount: f._count.periods,
      })),
    });
  } catch (error) {
    console.error("[API /evaluation-forms GET] Error:", error);
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
    const { name, criteria } = body as {
      name?: string;
      criteria?: { category: string; description: string; maxScore?: number; weight?: number }[];
    };

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Form name is required" },
        { status: 400 }
      );
    }

    const dup = await db.evaluationForm.findFirst({
      where: { name: name.trim().toLowerCase() },
    });
    if (dup) {
      return NextResponse.json(
        { error: "Form with this name already exists" },
        { status: 409 }
      );
    }

    const useCriteria =
      Array.isArray(criteria) && criteria.length > 0
        ? criteria
        : DEFAULT_CRITERIA;

    const form = await db.evaluationForm.create({
      data: {
        name: name.trim(),
        active: true,
        criteria: {
          create: useCriteria.map((c, idx) => ({
            category: c.category,
            description: c.description,
            maxScore: typeof c.maxScore === "number" ? c.maxScore : 5,
            weight: typeof c.weight === "number" ? c.weight : 1.0,
            sortOrder: idx,
          })),
        },
      },
      include: {
        criteria: { orderBy: { sortOrder: "asc" } },
        _count: { select: { periods: true } },
      },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: "Create Evaluation Form",
        entity: "EvaluationForm",
        entityId: form.id,
        metadata: JSON.stringify({
          name: form.name,
          criteriaCount: form.criteria.length,
        }),
      },
    });

    return NextResponse.json(
      {
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
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API /evaluation-forms POST] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
