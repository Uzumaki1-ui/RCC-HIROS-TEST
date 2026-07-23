import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, requireAnyPermission } from "@/lib/auth-token";
import { readFile, unlink, writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

// ═══════════════════════════════════════════════════════════════
// /api/employees/[id]/files/[fileId]
// GET     profiling.view  — serve file (Content-Disposition: inline)
// PUT     profile.*       — reupload file (replace existing, PDF only, 10MB)
// DELETE  profiling.edit  — remove from disk + DB
// ═══════════════════════════════════════════════════════════════

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const auth = await requireAnyPermission(request, ["profiling.edit", "profile.editAll", "profile.selfEdit"]);
    if (!auth.ok) return auth.response;

    const { id, fileId } = await params;

    const isSelfEdit = auth.user.id === id && auth.user.permissions.includes("profile.selfEdit");
    const isAdmin = auth.user.permissions.includes("profiling.edit") || auth.user.permissions.includes("profile.editAll");
    if (!isAdmin && !isSelfEdit) {
      return NextResponse.json({ error: "Forbidden - insufficient permissions" }, { status: 403 });
    }

    const existing = await db.employeeFile.findFirst({
      where: { id: fileId, employeeId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded (expected 'file' field)" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds 10MB limit" }, { status: 400 });
    }

    // Delete old file from disk
    const oldPath = path.join(UPLOAD_ROOT, id, existing.fileName);
    try { await unlink(oldPath); } catch { /* ignore */ }

    // Save new file
    const dir = path.join(UPLOAD_ROOT, id);
    await mkdir(dir, { recursive: true });
    const ext = path.extname(file.name) || "";
    const newFileName = `${randomUUID()}${ext}`;
    const newFilePath = path.join(dir, newFileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(newFilePath, buffer);

    // Update DB record
    const updated = await db.employeeFile.update({
      where: { id: fileId },
      data: {
        fileName: newFileName,
        originalName: file.name,
        mimeType: "application/pdf",
        fileSize: file.size,
        uploadedById: auth.user.id,
        uploadedAt: new Date(),
      },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: "Reupload File",
        entity: "EmployeeFile",
        entityId: fileId,
        metadata: JSON.stringify({ employeeId: id, originalName: file.name, size: file.size }),
      },
    });

    return NextResponse.json({
      file: {
        id: updated.id,
        originalName: updated.originalName,
        mimeType: updated.mimeType,
        fileSize: updated.fileSize,
        uploadedAt: updated.uploadedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[API /employees/[id]/files/[fileId] PUT] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const auth = await requireAnyPermission(request, ["profiling.edit", "profile.editAll", "profile.selfEdit"]);
    if (!auth.ok) return auth.response;

    const { id, fileId } = await params;

    const isSelfEdit = auth.user.id === id && auth.user.permissions.includes("profile.selfEdit");
    const isAdmin = auth.user.permissions.includes("profiling.edit") || auth.user.permissions.includes("profile.editAll");
    if (!isAdmin && !isSelfEdit) {
      return NextResponse.json({ error: "Forbidden - insufficient permissions" }, { status: 403 });
    }

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
