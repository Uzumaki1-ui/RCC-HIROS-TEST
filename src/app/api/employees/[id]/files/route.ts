import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, requireAnyPermission } from "@/lib/auth-token";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

// ═══════════════════════════════════════════════════════════════
// /api/employees/[id]/files
// GET   profiling.view  — list files with uploader info
// POST  profiling.edit|profile.*  — multipart upload (max 10MB, PDF only)
// ═══════════════════════════════════════════════════════════════

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME = new Set([
  "application/pdf",
]);

const UPLOAD_ROOT = path.join(process.cwd(), "uploads", "employees");

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

    const files = await db.employeeFile.findMany({
      where: { employeeId: id },
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    return NextResponse.json({
      files: files.map((f) => ({
        id: f.id,
        fileName: f.fileName,
        originalName: f.originalName,
        mimeType: f.mimeType,
        fileSize: f.fileSize,
        description: f.description,
        uploadedBy: f.uploadedBy
          ? `${f.uploadedBy.firstName} ${f.uploadedBy.lastName}`.trim()
          : null,
        createdAt: f.createdAt.toISOString(),
        uploadedAt: f.uploadedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[API /employees/[id]/files GET] Error:", error);
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
    const auth = await requireAnyPermission(request, ["profiling.edit", "profile.editAll", "profile.selfEdit"]);
    if (!auth.ok) return auth.response;

    const { id } = await params;

    // Self-edit: only allow upload to own profile
    const isSelfEdit = auth.user.id === id && auth.user.permissions.includes("profile.selfEdit");
    const isAdmin = auth.user.permissions.includes("profiling.edit") || auth.user.permissions.includes("profile.editAll");
    if (!isAdmin && !isSelfEdit) {
      return NextResponse.json(
        { error: "Forbidden - insufficient permissions" },
        { status: 403 }
      );
    }

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

    const formData = await request.formData();
    const file = formData.get("file");
    const description = (formData.get("description") as string | null) || null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file uploaded (expected 'file' field)" },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 10MB limit" },
        { status: 400 }
      );
    }

    // Ensure upload directory exists
    const dir = path.join(UPLOAD_ROOT, id);
    await mkdir(dir, { recursive: true });

    const ext = path.extname(file.name) || "";
    const fileName = `${randomUUID()}${ext}`;
    const filePath = path.join(dir, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const record = await db.employeeFile.create({
      data: {
        employeeId: id,
        fileName,
        originalName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
        description: description?.trim() || null,
        uploadedById: auth.user.id,
        uploadedAt: new Date(),
      },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: "Upload File",
        entity: "EmployeeFile",
        entityId: record.id,
        metadata: JSON.stringify({
          employeeId: id,
          originalName: file.name,
          size: file.size,
        }),
      },
    });

    return NextResponse.json({ file: record }, { status: 201 });
  } catch (error) {
    console.error("[API /employees/[id]/files POST] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
