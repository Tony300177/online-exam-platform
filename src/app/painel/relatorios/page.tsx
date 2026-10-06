import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { assessments, classes, schools, students, subjects } from "@/db/schema";
import { BarsH, btnGhost, btnPrimary, Card, EmptyState, Field, Histogram, inputClass, Stat } from "@/components/ui";
import { allowedSchoolIds, requirePage } from "@/lib/auth";
import { getAnalytics } from "@/lib/analytics";
import PrintButton from "./print-button";

export const dynamic = "force-dynamic";

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePage(["admin", "manager", "teacher"]);
  const allowed = await allowedSchoolIds(user);
  const scope = allowed === null ? undefined : allowed.length ? allowed : ["x"];
  const sp = await searchParams;

  const [schoolList, classList, assessmentList, studentList, subjectList] = await Promise.all([
    db.select({ id: schools.id, name: schools.name }).from(schools).where(scope ? inArray(schools.id, scope) : undefined).orderBy(asc(schools.name)),
    db.select({ id: classes.id, name: classes.name }).from(classes).where(scope ? inArray(classes.schoolId, scope) : undefined).orderBy(asc(classes.gradeYear)),
    db
      .select({ id: assessments.id, title: assessments.title, gradeYear: assessments.gradeYear, subjectId: assessments.subjectId })
      .from(assessments)
      .where(scope ? inArray(assessments.schoolId, scope) : undefined)
      .orderBy(asc(assessments.title)),
    db.select({ id: students.id, name: students.fullName }).from(students).where(scope ? inArray(students.schoolId, scope) : undefined).orderBy(asc(students.fullName)).limit(500),
    db.select().from(subjects),
  ]);

  const data = await getAnalytics({
    allowedSchoolIds: allowed,
    schoolId: sp.escola || undefined,
    classId: sp.turma || undefined,
    assessmentId: sp.avaliacao || undefined,
    studentId: sp.aluno || undefined,
    from: sp.de || undefined,
    to: sp.ate || undefined,
  });

  const selectedAssessment = assessmentList.find((a) => a.id === sp.avaliacao);
  const subjectName = subjectList.find((s) => s.id === selectedAssessment?.subjectId)?.name;
  const query = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => Boolean(v)) as [string, string][],
  ).toString();

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <h1 className="text-2xl font-bold text-slate-900">Relatórios</h1>
        <p className="text-sm text-slate-600">
          Gere relatórios individuais, por turma, por escola ou por avaliação e exporte em PDF
          (impressão), XLSX ou CSV, sempre respeitando as permissões do seu perfil.
        </p>
      </div>

      <Card title="Filtros do relatório" className="print:hidden">
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Escola" htmlFor="r-escola">
            <select id="r-escola" name="escola" defaultValue={sp.escola ?? ""} className={inputClass}>
              <option value="">Todas</option>
              {schoolList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Turma" htmlFor="r-turma">
            <select id="r-turma" name="turma" defaultValue={sp.turma ?? ""} className={inputClass}>
              <option value="">Todas</option>
              {classList.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Avaliação" htmlFor="r-aval">
            <select id="r-aval" name="avaliacao" defaultValue={sp.avaliacao ?? ""} className={inputClass}>
              <option value="">Todas</option>
              {assessmentList.map((a) => (
                <option key={a.id} value={a.id}>{a.title}</option>
              ))}
            </select>
          </Field>
          <Field label="Aluno" htmlFor="r-aluno">
            <select id="r-aluno" name="aluno" defaultValue={sp.aluno ?? ""} className={inputClass}>
              <option value="">Todos</option>
              {studentList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="De" htmlFor="r-de">
            <input id="r-de" type="date" name="de" defaultValue={sp.de ?? ""} className={inputClass} />
          </Field>
          <Field label="Até" htmlFor="r-ate">
            <input id="r-ate" type="date" name="ate" defaultValue={sp.ate ?? ""} className={inputClass} />
          </Field>
          <div className="flex items-end gap-2">
            <button className={btnPrimary}>Gerar relatório</button>
          </div>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          <a className={btnGhost} href={`/api/reports/export?formato=xlsx&${query}`}>
            Exportar XLSX
          </a>
          <a className={btnGhost} href={`/api/reports/export?formato=csv&${query}`}>
            Exportar CSV
          </a>
          <PrintButton />
        </div>
      </Card>

      <article className="flex flex-col gap-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <header>
          <h2 className="text-xl font-bold text-slate-900">
            {selectedAssessment ? selectedAssessment.title : "Relatório consolidado de avaliações"}
          </h2>
          <p className="text-sm text-slate-600">
            {selectedAssessment ? `${selectedAssessment.gradeYear}º ano · ${subjectName ?? "—"}` : "Todos os anos e componentes do escopo filtrado"}
            {" · "}
            Emitido por {user.fullName} em {new Date().toLocaleString("pt-BR")}
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Participação" value={`${data.totals.participationRate.toFixed(0)}%`} hint={`${data.totals.submitted}/${data.totals.assignedStudents}`} />
          <Stat label="Respostas válidas" value={data.totals.answers - data.totals.blanks} hint={`${data.totals.blanks} em branco`} />
          <Stat label="Percentual de acerto" value={`${data.totals.accuracy.toFixed(1)}%`} />
          <Stat label="Média" value={`${data.totals.average.toFixed(1)}%`} />
          <Stat label="Mediana" value={`${data.totals.median.toFixed(1)}%`} />
        </div>

        <section>
          <h3 className="mb-2 text-base font-semibold text-slate-800">Habilidades avaliadas e desempenho</h3>
          {data.bySkill.length === 0 ? (
            <EmptyState message="Nenhuma habilidade com respostas registradas no escopo filtrado." />
          ) : (
            <>
              <BarsH data={data.bySkill.map((s) => ({ label: s.code, value: s.value, n: s.n, title: s.description }))} />
              <ul className="mt-4 space-y-1 text-xs text-slate-600">
                {data.bySkill.map((s) => (
                  <li key={s.code}>
                    <strong>{s.code}</strong> — {s.description}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-base font-semibold text-slate-800">Distribuição de pontuações</h3>
          <Histogram buckets={data.distribution} />
        </section>

        <section>
          <h3 className="mb-2 text-base font-semibold text-slate-800">Observações pedagógicas</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>
              Indicadores calculados sobre {data.totals.answers} respostas de {data.totals.submitted} tentativas finalizadas.
            </li>
            {data.retake.length > 0 ? (
              <li>
                Habilidades sugeridas para retomada: {data.retake.map((s) => s.code).join(", ")}. Planeje
                intervenções considerando também as evidências de sala de aula.
              </li>
            ) : (
              <li>Nenhuma habilidade ficou abaixo de 60% de aproveitamento no escopo filtrado.</li>
            )}
            <li>
              Percentuais isolados não constituem diagnóstico definitivo da aprendizagem; use-os junto a
              outros instrumentos avaliativos.
            </li>
            <li>Documento com dados pessoais de estudantes — distribuição restrita conforme a LGPD.</li>
          </ul>
        </section>
      </article>
    </div>
  );
}
