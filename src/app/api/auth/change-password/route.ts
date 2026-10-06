import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, sessions } from "@/db/schema";
import { audit, errorResponse, hashPassword, HttpError, requireUser, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { currentPassword?: string; newPassword?: string };
    const current = body.currentPassword ?? "";
    const next = body.newPassword ?? "";
    if (next.length < 6) throw new HttpError(400, "A nova senha deve ter ao menos 6 caracteres.");
    if (next === "123456") throw new HttpError(400, "A nova senha não pode ser a senha padrão.");

    const row = (await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1))[0];
    if (!row) throw new HttpError(404, "Perfil não encontrado.");
    if (!(await verifyPassword(current, row.passwordHash)))
      throw new HttpError(400, "Senha atual incorreta.");

    await db
      .update(profiles)
      .set({ passwordHash: await hashPassword(next), mustChangePassword: false })
      .where(eq(profiles.id, user.id));
    // invalida outras sessões do mesmo usuário (mantém a atual recriada no cliente)
    await db.delete(sessions).where(eq(sessions.profileId, user.id));
    await audit(user, "password_changed", "profiles", user.id);
    return Response.json({ ok: true, redirect: "/" });
  } catch (e) {
    return errorResponse(e);
  }
}
