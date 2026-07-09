import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-token";

// ═══════════════════════════════════════════════════════════════
// POST /api/auth/change-password
// Verifies current password, hashes the new one, clears mustChangePwd.
// ═══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const userId = auth.user.id;

    const body = await request.json();
    const { currentPassword, newPassword } = body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const employee = await db.employee.findUnique({
      where: { id: userId },
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    if (!employee.passwordHash) {
      return NextResponse.json(
        { error: "Account has no password set. Please contact IT." },
        { status: 400 }
      );
    }

    const isValid = await bcrypt.compare(currentPassword, employee.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "New password must be different from the current password" },
        { status: 400 }
      );
    }

    const salt = await bcrypt.genSalt(12);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    await db.employee.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        mustChangePwd: false,
      },
    });

    await db.auditLog.create({
      data: {
        userId,
        action: "Change Password",
        entity: "Employee",
        entityId: userId,
        metadata: JSON.stringify({ at: new Date().toISOString() }),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("[API /auth/change-password] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
