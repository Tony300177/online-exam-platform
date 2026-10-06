import { asc, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, profiles, schools } from "@/db/schema";
import { Badge, btnPrimary, Card, EmptyState, Field, inputClass } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { createStaffAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  await requirePage(["admin"]);

  const staff = await db
    .select({
      id: profiles.id,
      fullName: profiles.fullName,
      email: profiles.email,
      role: profiles.role,
      active: profiles.active,
      lastLoginAt: profiles.lastLoginAt,
      school: schools.name,
    })
    .from(profiles)
    .leftJoin(schools, eq(schools.id, profiles.schoolId))
    .where(ne(profiles.role, "student"))
    .orderBy(asc(profiles.fullName));

  const schoolList = await db.select({ id: schools.id, name: schools.name }).from(schools).orderBy(asc(schools.name));

  const logs = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entity: auditLogs.entity,
      role: auditLogs.actorRole,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(25);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">Usuários e auditoria</h1>

      <Card title={`Equipe (${staff.length})`}>
        {staff.length === 0 ? (
          <EmptyState message="Nenhum usuário cadastrado." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">E-mail</th>
                  <th className="px-3 py-2">Perfil</th>
                  <th className="px-3 py-2">Escola principal</th>
                  <th className="px-3 py-2">Último acesso</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{s.fullName}</td>
                    <td className="px-3 py-2 text-slate-600">{s.email}</td>
                    <td className="px-3 py-2">
                      <Badge tone="blue">{s.role}</Badge>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{s.school ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleString("pt-BR") : "nunca"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Novo usuário da equipe" subtitle="A senha inicial exige troca no primeiro acesso.">
        <form action={createStaffAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Nome completo *" htmlFor="u-name">
            <input id="u-name" name="fullName" required className={inputClass} />
          </Field>
          <Field label="E-mail *" htmlFor="u-email">
            <input id="u-email" name="email" type="email" required className={inputClass} />
          </Field>
          <Field label="Perfil *" htmlFor="u-role">
            <select id="u-role" name="role" className={inputClass} defaultValue="teacher">
              <option value="admin">Administrador</option>
              <option value="manager">Gestor/Coordenação</option>
              <option value="teacher">Professor(a)</option>
            </select>
          </Field>
          <Field label="Escola" htmlFor="u-school">
            <select id="u-school" name="schoolId" className={inputClass} defaultValue="">
              <option value="">Sem vínculo (apenas admin)</option>
              {schoolList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Senha inicial" htmlFor="u-pwd">
            <input id="u-pwd" name="password" className={inputClass} placeholder="Mudar@123" />
          </Field>
          <div className="flex items-end">
            <button className={btnPrimary}>Criar usuário</button>
          </div>
        </form>
      </Card>

      <Card title="Registros de auditoria (mais recentes)" subtitle="Sem dados pessoais desnecessários.">
        <ul className="divide-y divide-slate-100 text-sm">
          {logs.map((l) => (
            <li key={l.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span className="font-medium text-slate-700">
                {l.action} <span className="text-xs text-slate-500">({l.entity ?? "—"})</span>
              </span>
              <span className="text-xs text-slate-500">
                {l.role ?? "anônimo"} · {new Date(l.createdAt).toLocaleString("pt-BR")}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
