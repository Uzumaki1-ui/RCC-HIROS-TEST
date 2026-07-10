import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth-token";

// ═══════════════════════════════════════════════════════════════
// /api/employees/[id]
// GET    profiling.view             — single employee w/ certs + counts
// PATCH  profiling.edit             — update fields + optional password reset
// DELETE profiling.delete           — soft-delete (active=false)
// ═══════════════════════════════════════════════════════════════

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Self-access exception: any authenticated user can view their own profile.
    // For viewing others' profiles, require profiling.view.
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const { id } = await params;

    // If NOT viewing own profile, require profiling.view
    if (auth.user.id !== id) {
      if (!auth.user.isSystem && !auth.user.permissions.includes("profiling.view")) {
        return NextResponse.json(
          { error: "You do not have permission to view this employee's profile" },
          { status: 403 }
        );
      }
    }
    const employee = await db.employee.findUnique({
      where: { id },
      include: {
        group: true,
        role: { select: { id: true, name: true } },
        certificates: { orderBy: { issueDate: "desc" } },
        files: {
          orderBy: { createdAt: "desc" },
          include: {
            uploadedBy: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        _count: {
          select: {
            certificates: true,
            files: true,
            leaveRequests: true,
            attendanceRecords: true,
            evaluations: true,
          },
        },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    // Block inactive employees for users without profiling.view_inactive
    const canViewInactive =
      auth.user.permissions.includes("profiling.view_inactive") ||
      auth.user.isSystem;

    if (!employee.active && !canViewInactive) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      employee: {
        id: employee.id,
        employeeId: employee.employeeId,
        firstName: employee.firstName,
        middleName: employee.middleName,
        lastName: employee.lastName,
        email: employee.email,
        phone: employee.phone,
        address: employee.address,
        birthday: employee.birthday?.toISOString() ?? null,
        gender: employee.gender,
        groupId: employee.groupId,
        group: employee.group
          ? {
              id: employee.group.id,
              name: employee.group.name,
              code: employee.group.code,
            }
          : null,
        roleId: employee.roleId,
        roleName: employee.role?.name ?? null,
        contractType: employee.contractType,
        hireDate: employee.hireDate?.toISOString() ?? null,
        salary: employee.salary ?? null,
        active: employee.active,
        mustChangePwd: employee.mustChangePwd,
        lastLoginAt: employee.lastLoginAt?.toISOString() ?? null,
        createdAt: employee.createdAt.toISOString(),
        updatedAt: employee.updatedAt.toISOString(),
        certificates: employee.certificates.map((c) => ({
          id: c.id,
          title: c.title,
          issuer: c.issuer,
          certificateNo: c.certificateNo,
          issueDate: c.issueDate?.toISOString() ?? null,
          expiryDate: c.expiryDate?.toISOString() ?? null,
          createdAt: c.createdAt.toISOString(),
        })),
        files: employee.files.map((f) => ({
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
        })),
        counts: employee._count,
      },
    });
  } catch (error) {
    console.error("[API /employees/[id] GET] Error:", error);
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
    const auth = await requirePermission(request, "profiling.edit");
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const employee = await db.employee.findUnique({ where: { id } });
    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      employeeId,
      firstName,
      middleName,
      lastName,
      email,
      phone,
      address,
      birthday,
      gender,
      groupId,
      roleId,
      contractType,
      hireDate,
      salary,
      active,
      password,
    } = body as {
      employeeId?: string;
      firstName?: string;
      middleName?: string | null;
      lastName?: string;
      email?: string;
      phone?: string | null;
      address?: string | null;
      birthday?: string | null;
      gender?: string | null;
      groupId?: string | null;
      roleId?: string | null;
      contractType?: string;
      hireDate?: string | null;
      salary?: number | null;
      active?: boolean;
      password?: string;
    };

    const data: Record<string, unknown> = {};

    if (typeof employeeId === "string" && employeeId.trim() && employeeId !== employee.employeeId) {
      const dup = await db.employee.findUnique({
        where: { employeeId: employeeId.trim() },
      });
      if (dup && dup.id !== id) {
        return NextResponse.json(
          { error: "Employee ID already exists" },
          { status: 409 }
        );
      }
      data.employeeId = employeeId.trim();
    }
    if (typeof firstName === "string" && firstName.trim())
      data.firstName = firstName.trim();
    if (typeof lastName === "string" && lastName.trim())
      data.lastName = lastName.trim();
    if (middleName !== undefined) data.middleName = middleName?.trim() || null;
    if (typeof email === "string" && email.trim()) {
      const emailLower = email.trim().toLowerCase();
      if (emailLower !== employee.email) {
        const dup = await db.employee.findUnique({
          where: { email: emailLower },
        });
        if (dup && dup.id !== id) {
          return NextResponse.json(
            { error: "Email already exists" },
            { status: 409 }
          );
        }
        data.email = emailLower;
      }
    }
    if (phone !== undefined) data.phone = phone?.trim() || null;
    if (address !== undefined) data.address = address?.trim() || null;
    if (birthday !== undefined)
      data.birthday = birthday ? new Date(birthday) : null;
    if (gender !== undefined) data.gender = gender || null;
    if (groupId !== undefined) data.groupId = groupId || null;
    if (roleId !== undefined) data.roleId = roleId || null;
    if (typeof contractType === "string" && contractType.trim())
      data.contractType = contractType.trim();
    if (hireDate !== undefined) data.hireDate = hireDate ? new Date(hireDate) : null;
    if (salary !== undefined) data.salary = salary ?? null;
    if (active !== undefined) data.active = !!active;

    // Optional password reset
    if (password !== undefined) {
      if (typeof password !== "string" || password.length < 8) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters" },
          { status: 400 }
        );
      }
      const salt = await bcrypt.genSalt(12);
      data.passwordHash = await bcrypt.hash(password, salt);
      data.mustChangePwd = true;
    }

    const updated = await db.employee.update({
      where: { id },
      data,
      include: {
        group: true,
        role: { select: { id: true, name: true } },
        _count: { select: { certificates: true } },
      },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: "Update Employee",
        entity: "Employee",
        entityId: id,
        metadata: JSON.stringify({ fields: Object.keys(data) }),
      },
    });

    return NextResponse.json({
      employee: {
        id: updated.id,
        employeeId: updated.employeeId,
        firstName: updated.firstName,
        middleName: updated.middleName,
        lastName: updated.lastName,
        email: updated.email,
        phone: updated.phone,
        address: updated.address,
        birthday: updated.birthday?.toISOString() ?? null,
        gender: updated.gender,
        groupId: updated.groupId,
        groupName: updated.group?.name ?? null,
        roleId: updated.roleId,
        roleName: updated.role?.name ?? null,
        contractType: updated.contractType,
        hireDate: updated.hireDate?.toISOString() ?? null,
        salary: updated.salary ?? null,
        active: updated.active,
        mustChangePwd: updated.mustChangePwd,
        certificateCount: updated._count.certificates,
      },
    });
  } catch (error) {
    console.error("[API /employees/[id] PATCH] Error:", error);
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
    const auth = await requirePermission(request, "profiling.delete");
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const employee = await db.employee.findUnique({ where: { id } });
    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    // Soft-delete: set active=false
    await db.employee.update({
      where: { id },
      data: { active: false },
    });

    await db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: "Deactivate Employee",
        entity: "Employee",
        entityId: id,
        metadata: JSON.stringify({
          employeeId: employee.employeeId,
          email: employee.email,
        }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API /employees/[id] DELETE] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
