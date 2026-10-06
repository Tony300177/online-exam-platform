import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { audit, createSession, errorResponse, HttpError, verifyPassword } from "@/lib/auth";

const MAX_FAILED = 5;
const LOCK_MINUTES = 10;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    if (!email || !password) throw new HttpError(400, "Informe e-mail e senha.");

    const rows = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
    const user = rows[0];
    const invalid = new HttpError(401, "Credenciais inválidas.");
    if (!user || !user.active || user.role === "student") throw invalid;
    if (user.lockedUntil && user.lockedUntil > new Date())
      throw new HttpError(429, "Conta temporariamente bloqueada. Tente novamente em alguns minutos.");

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      const failed = user.failedAttempts + 1;
      await db
        .update(profiles)
        .set({
          failedAttempts: failed,
          lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
        })
        .where(eq(profiles.id, user.id));
      await audit(null, "login_failed", "profiles", user.id);
      throw invalid;
    }

    await db
      .update(profiles)
      .set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() })
      .where(eq(profiles.id, user.id));
    await createSession(user.id);
    await audit(
      { id: user.id, role: user.role, fullName: user.fullName, email: user.email, schoolId: user.schoolId, studentId: null, mustChangePassword: user.mustChangePassword },
      "login_success",
      "profiles",
      user.id,
    );
    return Response.json({ ok: true, redirect: user.mustChangePassword ? "/trocar-senha" : "/painel" });
  } catch (e) {
    return errorResponse(e);
  }
}
