import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, profiles, studentEnrollments, students } from "@/db/schema";
import { audit, createSession, errorResponse, HttpError, normalizeName, verifyPassword } from "@/lib/auth";

const MAX_FAILED = 5;
const LOCK_MINUTES = 10;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      schoolId?: string;
      classId?: string;
      fullName?: string;
      password?: string;
    };
    const { schoolId, classId } = body;
    const fullName = (body.fullName ?? "").trim();
    const password = body.password ?? "";
    if (!schoolId || !classId || !fullName || !password)
      throw new HttpError(400, "Preencha escola, turma, nome completo e senha.");

    const invalid = new HttpError(401, "Dados de acesso inválidos. Confira escola, turma, nome e senha.");

    // A turma precisa pertencer à escola informada (validação no servidor).
    const klass = (
      await db
        .select({ id: classes.id })
        .from(classes)
        .where(and(eq(classes.id, classId), eq(classes.schoolId, schoolId)))
        .limit(1)
    )[0];
    if (!klass) throw invalid;

    const rows = await db
      .select({
        studentId: students.id,
        profileId: profiles.id,
        passwordHash: profiles.passwordHash,
        mustChange: profiles.mustChangePassword,
        active: profiles.active,
        failed: profiles.failedAttempts,
        lockedUntil: profiles.lockedUntil,
        fullName: profiles.fullName,
        role: profiles.role,
      })
      .from(students)
      .innerJoin(studentEnrollments, eq(studentEnrollments.studentId, students.id))
      .innerJoin(profiles, eq(profiles.studentId, students.id))
      .where(
        and(
          eq(students.schoolId, schoolId),
          eq(students.normalizedName, normalizeName(fullName)),
          eq(studentEnrollments.classId, classId),
          eq(studentEnrollments.active, true),
        ),
      )
      .limit(1);

    const user = rows[0];
    if (!user || !user.active) throw invalid;
    if (user.lockedUntil && user.lockedUntil > new Date())
      throw new HttpError(429, "Acesso bloqueado temporariamente. Peça ajuda ao professor.");

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      const failed = user.failed + 1;
      await db
        .update(profiles)
        .set({
          failedAttempts: failed,
          lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
        })
        .where(eq(profiles.id, user.profileId));
      await audit(null, "student_login_failed", "profiles", user.profileId);
      throw invalid;
    }

    await db
      .update(profiles)
      .set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() })
      .where(eq(profiles.id, user.profileId));
    await createSession(user.profileId);
    await audit(
      {
        id: user.profileId,
        role: "student",
        fullName: user.fullName,
        email: null,
        schoolId,
        studentId: user.studentId,
        mustChangePassword: user.mustChange,
      },
      "student_login_success",
      "profiles",
      user.profileId,
    );
    return Response.json({ ok: true, redirect: "/aluno" });
  } catch (e) {
    return errorResponse(e);
  }
}
