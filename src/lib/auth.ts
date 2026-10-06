import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { profiles, sessions, staffSchools, auditLogs } from "@/db/schema";

export const SESSION_COOKIE = "prova_session";
const SESSION_DAYS = 7;

export type Role = "admin" | "manager" | "teacher" | "student";

export type SessionUser = {
  id: string;
  role: Role;
  fullName: string;
  email: string | null;
  schoolId: string | null;
  studentId: string | null;
  mustChangePassword: boolean;
};

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}
export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export async function createSession(profileId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  await db.insert(sessions).values({ profileId, tokenHash: tokenHash(token), expiresAt });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash(token)));
  jar.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({
      id: profiles.id,
      role: profiles.role,
      fullName: profiles.fullName,
      email: profiles.email,
      schoolId: profiles.schoolId,
      studentId: profiles.studentId,
      mustChangePassword: profiles.mustChangePassword,
      active: profiles.active,
    })
    .from(sessions)
    .innerJoin(profiles, eq(profiles.id, sessions.profileId))
    .where(and(eq(sessions.tokenHash, tokenHash(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const u = rows[0];
  if (!u || !u.active) return null;
  return {
    id: u.id,
    role: u.role as Role,
    fullName: u.fullName,
    email: u.email,
    schoolId: u.schoolId,
    studentId: u.studentId,
    mustChangePassword: u.mustChangePassword,
  };
}

export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Não autenticado.");
  if (roles && !roles.includes(user.role)) throw new HttpError(403, "Acesso negado.");
  return user;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) {
    return Response.json({ error: e.message }, { status: e.status });
  }
  console.error("[api-error]", e instanceof Error ? e.message : "unknown");
  return Response.json({ error: "Erro interno do servidor." }, { status: 500 });
}

/** Escolas que o usuário pode acessar. `null` = todas (admin). */
export async function allowedSchoolIds(user: SessionUser): Promise<string[] | null> {
  if (user.role === "admin") return null;
  const links = await db
    .select({ schoolId: staffSchools.schoolId })
    .from(staffSchools)
    .where(eq(staffSchools.profileId, user.id));
  const ids = new Set(links.map((l) => l.schoolId));
  if (user.schoolId) ids.add(user.schoolId);
  return [...ids];
}

export async function assertSchoolAccess(user: SessionUser, schoolId: string) {
  const ids = await allowedSchoolIds(user);
  if (ids === null) return;
  if (!ids.includes(schoolId)) throw new HttpError(403, "Sem permissão sobre esta escola.");
}

export async function audit(
  actor: SessionUser | null,
  action: string,
  entity?: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
) {
  try {
    await db.insert(auditLogs).values({
      actorId: actor?.id ?? null,
      actorRole: actor?.role ?? null,
      action,
      entity: entity ?? null,
      entityId: entityId ?? null,
      metadata: metadata ?? null,
    });
  } catch {
    /* auditoria nunca deve quebrar a operação */
  }
}

/** Guarda para páginas (Server Components): redireciona em vez de lançar erro HTTP. */
export async function requirePage(roles?: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/trocar-senha");
  if (roles && !roles.includes(user.role)) redirect(user.role === "student" ? "/aluno" : "/painel");
  return user;
}

/** Versão para páginas: redireciona quando o usuário não tem vínculo com a escola. */
export async function assertSchoolAccessPage(user: SessionUser, schoolId: string) {
  const ids = await allowedSchoolIds(user);
  if (ids === null || ids.includes(schoolId)) return;
  redirect("/painel");
}
