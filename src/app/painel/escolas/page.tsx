import { asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { classes, schools, studentEnrollments, students } from "@/db/schema";
import { Badge, btnGhost, btnPrimary, Card, EmptyState, Field, inputClass } from "@/components/ui";
import { allowedSchoolIds, requirePage } from "@/lib/auth";
import {
  createClassAction,
  createSchoolAction,
  createStudentAction,
  resetStudentPasswordAction,
} from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function EscolasPage({
  searchParams,
}: {
  searchParams: Promise<{ escola?: string; turma?: string }>;
}) {
  const user = await requirePage(["admin", "manager"]);
  const allowed = await allowedSchoolIds(user);
  const sp = await searchParams;

  const schoolList = await db
    .select({ id: schools.id, name: schools.name, city: schools.city })
    .from(schools)
    .where(allowed === null ? undefined : inArray(schools.id, allowed.length ? allowed : ["x"]))
    .orderBy(asc(schools.name));

  const selectedSchool = sp.escola && schoolList.some((s) => s.id === sp.escola) ? sp.escola : schoolList[0]?.id;

  const classList = selectedSchool
    ? await db
        .select({
          id: classes.id,
          name: classes.name,
          gradeYear: classes.gradeYear,
          shift: classes.shift,
          total: sql<number>`(select count(*)::int from ${studentEnrollments} se where se.class_id = ${classes.id} and se.active)`,
        })
        .from(classes)
        .where(eq(classes.schoolId, selectedSchool))
        .orderBy(asc(classes.gradeYear), asc(classes.name))
    : [];

  const selectedClass = sp.turma && classList.some((c) => c.id === sp.turma) ? sp.turma : classList[0]?.id;

  const studentList = selectedClass
    ? await db
        .select({
          id: students.id,
          fullName: students.fullName,
          registration: students.registration,
          active: students.active,
        })
        .from(students)
        .innerJoin(studentEnrollments, eq(studentEnrollments.studentId, students.id))
        .where(eq(studentEnrollments.classId, selectedClass))
        .orderBy(asc(students.fullName))
    : [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">Escolas, turmas e alunos</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Escolas">
          {schoolList.length === 0 ? (
            <EmptyState message="Nenhuma escola disponível para o seu perfil." />
          ) : (
            <ul className="flex flex-col gap-1">
              {schoolList.map((s) => (
                <li key={s.id}>
                  <a
                    href={`/painel/escolas?escola=${s.id}`}
                    className={`block rounded-lg px-3 py-2 text-sm ${
                      s.id === selectedSchool ? "bg-sky-50 font-semibold text-sky-900" : "hover:bg-slate-50"
                    }`}
                  >
                    {s.name}
                    {s.city && <span className="block text-xs text-slate-500">{s.city}</span>}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {user.role === "admin" && (
            <form action={createSchoolAction} className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4">
              <Field label="Nova escola" htmlFor="school-name">
                <input id="school-name" name="name" required className={inputClass} />
              </Field>
              <Field label="Município" htmlFor="school-city">
                <input id="school-city" name="city" className={inputClass} />
              </Field>
              <button className={btnPrimary}>Cadastrar escola</button>
            </form>
          )}
        </Card>

        <Card title="Turmas" subtitle="Ano letivo 2026">
          {classList.length === 0 ? (
            <EmptyState message="Nenhuma turma cadastrada nesta escola." />
          ) : (
            <ul className="flex flex-col gap-1">
              {classList.map((c) => (
                <li key={c.id}>
                  <a
                    href={`/painel/escolas?escola=${selectedSchool}&turma=${c.id}`}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                      c.id === selectedClass ? "bg-sky-50 font-semibold text-sky-900" : "hover:bg-slate-50"
                    }`}
                  >
                    <span>
                      {c.name} <span className="text-xs text-slate-500">({c.gradeYear}º ano)</span>
                    </span>
                    <Badge>{c.total} alunos</Badge>
                  </a>
                </li>
              ))}
            </ul>
          )}
          {selectedSchool && (
            <form action={createClassAction} className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4">
              <input type="hidden" name="schoolId" value={selectedSchool} />
              <Field label="Nome da turma" htmlFor="class-name">
                <input id="class-name" name="name" required className={inputClass} placeholder="3º ano C" />
              </Field>
              <Field label="Ano escolar" htmlFor="class-grade">
                <select id="class-grade" name="gradeYear" className={inputClass} required defaultValue="">
                  <option value="" disabled>
                    Selecione
                  </option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
                    <option key={g} value={g}>
                      {g}º ano
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Turno" htmlFor="class-shift">
                <input id="class-shift" name="shift" className={inputClass} placeholder="Manhã" />
              </Field>
              <button className={btnPrimary}>Cadastrar turma</button>
            </form>
          )}
        </Card>

        <Card title="Alunos da turma" subtitle="Dados pessoais restritos a perfis autorizados">
          {studentList.length === 0 ? (
            <EmptyState message="Nenhum aluno vinculado a esta turma." />
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {studentList.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{s.fullName}</p>
                    {s.registration && <p className="text-xs text-slate-500">Matrícula: {s.registration}</p>}
                  </div>
                  <form action={resetStudentPasswordAction}>
                    <input type="hidden" name="studentId" value={s.id} />
                    <button className={`${btnGhost} px-2 py-1 text-xs`}>Redefinir senha</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {selectedSchool && selectedClass && (
            <form action={createStudentAction} className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4">
              <input type="hidden" name="schoolId" value={selectedSchool} />
              <input type="hidden" name="classId" value={selectedClass} />
              <Field label="Nome completo do aluno" htmlFor="st-name" hint="Exatamente como consta na matrícula.">
                <input id="st-name" name="fullName" required className={inputClass} />
              </Field>
              <Field label="Matrícula (opcional)" htmlFor="st-reg">
                <input id="st-reg" name="registration" className={inputClass} />
              </Field>
              <button className={btnPrimary}>Cadastrar aluno</button>

            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
