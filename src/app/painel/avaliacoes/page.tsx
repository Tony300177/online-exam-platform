import Link from "next/link";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { assessments, attempts, classes, schools, subjects } from "@/db/schema";
import { Badge, btnPrimary, Card, EmptyState, Field, inputClass } from "@/components/ui";
import { allowedSchoolIds, requirePage } from "@/lib/auth";
import { createAssessmentAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function AvaliacoesPage() {
  const user = await requirePage(["admin", "teacher"]);
  const allowed = await allowedSchoolIds(user);
  const scope = allowed === null ? undefined : allowed.length ? allowed : ["x"];

  const [schoolList, subjectList, classList] = await Promise.all([
    db
      .select({ id: schools.id, name: schools.name })
      .from(schools)
      .where(scope ? inArray(schools.id, scope) : undefined)
      .orderBy(asc(schools.name)),
    db.select().from(subjects).orderBy(asc(subjects.name)),
    db
      .select({ id: classes.id, name: classes.name, schoolId: classes.schoolId, gradeYear: classes.gradeYear })
      .from(classes)
      .where(scope ? inArray(classes.schoolId, scope) : undefined)
      .orderBy(asc(classes.gradeYear)),
  ]);

  const list = await db
    .select({
      id: assessments.id,
      title: assessments.title,
      status: assessments.status,
      gradeYear: assessments.gradeYear,
      school: schools.name,
      subject: subjects.name,
      attempts: sql<number>`(select count(*)::int from ${attempts} t where t.assessment_id = ${assessments.id})`,
    })
    .from(assessments)
    .innerJoin(schools, eq(schools.id, assessments.schoolId))
    .innerJoin(subjects, eq(subjects.id, assessments.subjectId))
    .where(scope ? inArray(assessments.schoolId, scope) : undefined)
    .orderBy(desc(assessments.createdAt));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">Avaliações</h1>

      <Card title={`Minhas avaliações (${list.length})`}>
        {list.length === 0 ? (
          <EmptyState message="Nenhuma avaliação criada ainda." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link href={`/painel/avaliacoes/${a.id}`} className="font-semibold text-sky-800 hover:underline">
                    {a.title}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {a.school} · {a.gradeYear}º ano · {a.subject} · {a.attempts} tentativas
                  </p>
                </div>
                <Badge tone={a.status === "publicada" ? "green" : a.status === "rascunho" ? "slate" : "blue"}>
                  {a.status.replace(/_/g, " ")}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Criar avaliação" subtitle="Passo 1 — defina escola, turma, ano e componente curricular.">
        <form action={createAssessmentAction} className="grid gap-4 lg:grid-cols-3">
          <Field label="Escola *" htmlFor="a-school">
            <select id="a-school" name="schoolId" required className={inputClass} defaultValue="">
              <option value="" disabled>
                Selecione
              </option>
              {schoolList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Turma" htmlFor="a-class" hint="A turma deve pertencer à escola selecionada.">
            <select id="a-class" name="classId" className={inputClass} defaultValue="">
              <option value="">Definir depois</option>
              {classList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({schoolList.find((s) => s.id === c.schoolId)?.name})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ano escolar *" htmlFor="a-grade">
            <select id="a-grade" name="gradeYear" required className={inputClass} defaultValue="">
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
          <Field label="Componente curricular *" htmlFor="a-subject">
            <select id="a-subject" name="subjectId" required className={inputClass} defaultValue="">
              <option value="" disabled>
                Selecione
              </option>
              {subjectList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Título *" htmlFor="a-title">
            <input id="a-title" name="title" required className={inputClass} />
          </Field>
          <Field label="Duração (minutos)" htmlFor="a-dur">
            <input id="a-dur" name="durationMinutes" type="number" min={5} defaultValue={50} className={inputClass} />
          </Field>
          <Field label="Disponível a partir de" htmlFor="a-from">
            <input id="a-from" name="availableFrom" type="datetime-local" className={inputClass} />
          </Field>
          <Field label="Disponível até" htmlFor="a-until">
            <input id="a-until" name="availableUntil" type="datetime-local" className={inputClass} />
          </Field>
          <Field label="Tentativas permitidas" htmlFor="a-att">
            <input id="a-att" name="maxAttempts" type="number" min={1} max={5} defaultValue={1} className={inputClass} />
          </Field>
          <Field label="Instruções para o aluno" htmlFor="a-desc">
            <textarea id="a-desc" name="description" rows={2} className={inputClass} />
          </Field>
          <div className="flex items-end lg:col-span-3">
            <button className={btnPrimary}>Criar avaliação (rascunho)</button>
          </div>
        </form>
      </Card>
    </div>
  );
}
