import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-token";
import { readFile, unlink } from "fs/promises";
import path from "path";

// ═══════════════════════════════════════════════════════════════
// /api/employees/[id]/files/[fileId]
// GET     profiling.view  — serve file (Content-Disposition: inline)
// DELETE  profiling.edit  — remove from disk + DB
// ═══════════════════════════════════════════════════════════════

const UPLOAD_ROOT = path.join(process.cwd(), "uploads", "employees");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const auth = await requirePermission(request, "profiling.view");
    if (!auth.ok) return auth.response;

    const { id, fileId } = await params;
    const file = await db.employeeFile.findFirst({
      where: { id: fileId, employeeId: id },
    });
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const filePath = path.join(UPLOAD_ROOT, id, file.fileName);
    let buffer: Buffer;
    try {
      buffer = await readFile(filePath);
    } catch {
      return NextResponse.json(
        { error: "File missing from disk" },
        { status: 410 }
      );
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.originalName)}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, max-age=0, no-cache",
      },
    });
  } catch (error) {
    console.error("[API /employees/[id]/files/[fileId] GET] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const auth = await requirePermission(request, "profiling.edit");
    if (!auth.ok) return auth.response;

    const { id, fileId } = await params;
    const file = await db.employeeFile.findFirst({
      where: { id: fileId, employeeId: id },
    });
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Remove from disk (ignore errors if already gone)
    const filePath = path.join(UPLOAD_ROOT, id, file.fileName);
    try {
      await unlink(filePath);
    } catch {
      // Already gone — proceed
    }

    await db.employeeFile.delete({ where: { id: fileId } });

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: "Delete File",
        entity: "EmployeeFile",
        entityId: fileId,
        metadata: JSON.stringify({
          employeeId: id,
          originalName: file.originalName,
        }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API /employees/[id]/files/[fileId] DELETE] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
