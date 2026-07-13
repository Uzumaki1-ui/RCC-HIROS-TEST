import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAnyPermission } from "@/lib/auth-token";

// ═══════════════════════════════════════════════════════════════
// /api/employees/[id]/certificates/[certId]
// PATCH   profiling.edit  — update certificate
// DELETE  profiling.edit  — delete certificate
// ═══════════════════════════════════════════════════════════════

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; certId: string }> }
) {
  try {
    const auth = await requireAnyPermission(request, ["profiling.edit", "profile.selfEdit"]);
    if (!auth.ok) return auth.response;

    const { id, certId } = await params;

    const isSelfEdit = auth.user.id === id;
    if (isSelfEdit && !auth.user.permissions.includes("profile.selfEdit")) {
      return NextResponse.json({ error: "Forbidden — insufficient permissions" }, { status: 403 });
    }
    if (!auth.user.permissions.includes("profiling.edit") && !isSelfEdit) {
      return NextResponse.json({ error: "Forbidden — insufficient permissions" }, { status: 403 });
    }

    const cert = await db.employeeCertificate.findFirst({
      where: { id: certId, employeeId: id },
    });
    if (!cert) {
      return NextResponse.json(
        { error: "Certificate not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { title, issuer, certificateNo, issueDate, expiryDate } = body as {
      title?: string;
      issuer?: string | null;
      certificateNo?: string | null;
      issueDate?: string | null;
      expiryDate?: string | null;
    };

    const data: Record<string, unknown> = {};
    if (typeof title === "string" && title.trim()) data.title = title.trim();
    if (issuer !== undefined) data.issuer = issuer?.trim() || null;
    if (certificateNo !== undefined)
      data.certificateNo = certificateNo?.trim() || null;
    if (issueDate !== undefined)
      data.issueDate = issueDate ? new Date(issueDate) : null;
    if (expiryDate !== undefined)
      data.expiryDate = expiryDate ? new Date(expiryDate) : null;

    const updated = await db.employeeCertificate.update({
      where: { id: certId },
      data,
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: "Update Certificate",
        entity: "EmployeeCertificate",
        entityId: certId,
        metadata: JSON.stringify({ employeeId: id, fields: Object.keys(data) }),
      },
    });

    return NextResponse.json({ certificate: updated });
  } catch (error) {
    console.error("[API /employees/[id]/certificates/[certId] PATCH] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; certId: string }> }
) {
  try {
    const auth = await requireAnyPermission(request, ["profiling.edit", "profile.selfEdit"]);
    if (!auth.ok) return auth.response;

    const { id, certId } = await params;

    const isSelfEdit = auth.user.id === id;
    if (isSelfEdit && !auth.user.permissions.includes("profile.selfEdit")) {
      return NextResponse.json({ error: "Forbidden — insufficient permissions" }, { status: 403 });
    }
    if (!auth.user.permissions.includes("profiling.edit") && !isSelfEdit) {
      return NextResponse.json({ error: "Forbidden — insufficient permissions" }, { status: 403 });
    }

    const cert = await db.employeeCertificate.findFirst({
      where: { id: certId, employeeId: id },
    });
    if (!cert) {
      return NextResponse.json(
        { error: "Certificate not found" },
        { status: 404 }
      );
    }

    await db.employeeCertificate.delete({ where: { id: certId } });

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: "Delete Certificate",
        entity: "EmployeeCertificate",
        entityId: certId,
        metadata: JSON.stringify({ employeeId: id, title: cert.title }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API /employees/[id]/certificates/[certId] DELETE] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
