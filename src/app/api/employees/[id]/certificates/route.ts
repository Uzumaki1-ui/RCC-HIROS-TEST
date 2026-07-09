import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-token";

// ═══════════════════════════════════════════════════════════════
// /api/employees/[id]/certificates
// GET   profiling.view  — list certificates
// POST  profiling.edit  — add certificate
// ═══════════════════════════════════════════════════════════════

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, "profiling.view");
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const employee = await db.employee.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    const certificates = await db.employeeCertificate.findMany({
      where: { employeeId: id },
      orderBy: { issueDate: "desc" },
    });

    return NextResponse.json({
      certificates: certificates.map((c) => ({
        id: c.id,
        title: c.title,
        issuer: c.issuer,
        certificateNo: c.certificateNo,
        issueDate: c.issueDate?.toISOString() ?? null,
        expiryDate: c.expiryDate?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[API /employees/[id]/certificates GET] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, "profiling.edit");
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const employee = await db.employee.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { title, issuer, certificateNo, issueDate, expiryDate } = body as {
      title?: string;
      issuer?: string;
      certificateNo?: string;
      issueDate?: string;
      expiryDate?: string;
    };

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: "Certificate title is required" },
        { status: 400 }
      );
    }

    const certificate = await db.employeeCertificate.create({
      data: {
        employeeId: id,
        title: title.trim(),
        issuer: issuer?.trim() || null,
        certificateNo: certificateNo?.trim() || null,
        issueDate: issueDate ? new Date(issueDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
      },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: "Add Certificate",
        entity: "EmployeeCertificate",
        entityId: certificate.id,
        metadata: JSON.stringify({ employeeId: id, title: certificate.title }),
      },
    });

    return NextResponse.json({ certificate }, { status: 201 });
  } catch (error) {
    console.error("[API /employees/[id]/certificates POST] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
