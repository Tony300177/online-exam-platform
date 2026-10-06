import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { assessments, classes, schools, students, subjects } from "@/db/schema";
import {
  BarsH,
  btnPrimary,
  Card,
  EmptyState,
  Field,
  Heatmap,
  Histogram,
  inputClass,
  LineChart,
  Stat,
} from "@/components/ui";
import { allowedSchoolIds, requirePage } from "@/lib/auth";
import { getAnalytics } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export default async function AnalisesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePage(["admin", "manager", "teacher"]);
  const allowed = await allowedSchoolIds(user);
  const scope = allowed === null ? undefined : allowed.length ? allowed : ["x"];
  const sp = await searchParams;

  const [schoolList, subjectList, classList, assessmentList, studentList] = await Promise.all([
    db.select({ id: schools.id, name: schools.name }).from(schools).where(scope ? inArray(schools.id, scope) : undefined).orderBy(asc(schools.name)),
    db.select().from(subjects).orderBy(asc(subjects.name)),
    db.select({ id: classes.id, name: classes.name, schoolId: classes.schoolId }).from(classes).where(scope ? inArray(classes.schoolId, scope) : undefined).orderBy(asc(classes.gradeYear)),
    db.select({ id: assessments.id, title: assessments.title }).from(assessments).where(scope ? inArray(assessments.schoolId, scope) : undefined).orderBy(asc(assessments.title)),
    db.select({ id: students.id, name: students.fullName }).from(students).where(scope ? inArray(students.schoolId, scope) : undefined).orderBy(asc(students.fullName)).limit(500),
  ]);

  const data = await getAnalytics({
    allowedSchoolIds: allowed,
    schoolId: sp.escola || undefined,
    classId: sp.turma || undefined,
    gradeYear: sp.ano ? Number(sp.ano) : undefined,
    subjectId: sp.componente || undefined,
    assessmentId: sp.avaliacao || undefined,
    studentId: sp.aluno || undefined,
    from: sp.de || undefined,
    to: sp.ate || undefined,
  });

  const t = data.totals;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard pedagógico</h1>
        <p className="text-sm text-slate-600">
          Indicadores analíticos calculados a partir das respostas registradas. A BNCC define as
          habilidades; os gráficos abaixo são recursos de análise da plataforma.
        </p>
      </div>

      <Card title="Filtros">
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Escola" htmlFor="d-escola">
            <select id="d-escola" name="escola" defaultValue={sp.escola ?? ""} className={inputClass}>
              <option value="">Todas</option>
              {schoolList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Turma" htmlFor="d-turma">
            <select id="d-turma" name="turma" defaultValue={sp.turma ?? ""} className={inputClass}>
              <option value="">Todas</option>
              {classList.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Ano escolar" htmlFor="d-ano">
            <select id="d-ano" name="ano" defaultValue={sp.ano ?? ""} className={inputClass}>
              <option value="">Todos</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
                <option key={g} value={g}>{g}º ano</option>
              ))}
            </select>
          </Field>
          <Field label="Componente" htmlFor="d-comp">
            <select id="d-comp" name="componente" defaultValue={sp.componente ?? ""} className={inputClass}>
              <option value="">Todos</option>
              {subjectList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Avaliação" htmlFor="d-aval">
            <select id="d-aval" name="avaliacao" defaultValue={sp.avaliacao ?? ""} className={inputClass}>
              <option value="">Todas</option>
              {assessmentList.map((a) => (
                <option key={a.id} value={a.id}>{a.title}</option>
              ))}
            </select>
          </Field>
          <Field label="Aluno" htmlFor="d-aluno">
            <select id="d-aluno" name="aluno" defaultValue={sp.aluno ?? ""} className={inputClass}>
              <option value="">Todos</option>
              {studentList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Período — de" htmlFor="d-de">
            <input id="d-de" name="de" type="date" defaultValue={sp.de ?? ""} className={inputClass} />
          </Field>
          <Field label="Período — até" htmlFor="d-ate">
            <input id="d-ate" name="ate" type="date" defaultValue={sp.ate ?? ""} className={inputClass} />
          </Field>
          <div className="flex items-end">
            <button className={btnPrimary}>Aplicar filtros</button>
          </div>
        </form>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Stat label="Participação" value={`${t.participationRate.toFixed(0)}%`} hint={`${t.submitted} de ${t.assignedStudents} atribuídos`} />
        <Stat label="Taxa de acerto" value={`${t.accuracy.toFixed(1)}%`} hint={`${t.answers} respostas`} />
        <Stat label="Média" value={`${t.average.toFixed(1)}%`} hint={`${t.submitted} tentativas`} />
        <Stat label="Mediana" value={`${t.median.toFixed(1)}%`} />
        <Stat label="Questões em branco" value={t.blanks} hint={`de ${t.answers} respostas`} />
        <Stat label="Avaliações" value={t.assessments} />
        <Stat label="Tentativas" value={t.attempts} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Desempenho por habilidade BNCC" subtitle="Barras horizontais · n = respostas consideradas">
          <BarsH data={data.bySkill.map((s) => ({ label: s.code, value: s.value, n: s.n, title: s.description }))} />
        </Card>
        <Card title="Habilidades que necessitam de retomada" subtitle="Abaixo de 60% de aproveitamento">
          {data.retake.length === 0 ? (
            <EmptyState message="Nenhuma habilidade abaixo do parâmetro definido (60%)." />
          ) : (
            <ul className="flex flex-col gap-3 text-sm">
              {data.retake.map((s) => (
                <li key={s.code} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="font-semibold text-amber-900">
                    {s.code} — {s.value.toFixed(1)}% <span className="text-xs font-normal">(n={s.n})</span>
                  </p>
                  <p className="text-xs text-amber-800">{s.description}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Distribuição de pontuações" subtitle="Histograma das tentativas finalizadas">
          <Histogram buckets={data.distribution} />
        </Card>
        <Card title="Evolução entre avaliações comparáveis" subtitle="Somente mesmo ano escolar e componente curricular">
          <LineChart points={data.evolution} />
        </Card>
      </div>

      <Card
        title="Frequência de escolha das alternativas"
        subtitle={sp.avaliacao ? "Por questão objetiva da avaliação selecionada" : "Selecione uma avaliação no filtro para visualizar"}
      >
        {data.byOption.length === 0 ? (
          <EmptyState message="Selecione uma avaliação específica para ver a distribuição das alternativas." />
        ) : (
          <ul className="flex flex-col gap-5">
            {data.byOption.map((q) => (
              <li key={q.questionId}>
                <p className="text-sm font-semibold text-slate-800">{q.statement}</p>
                <p className="text-xs text-slate-500">n = {q.n} respostas</p>
                <div className="mt-2">
                  <BarsH
                    data={q.options.map((o) => ({
                      label: `${o.label}${o.isCorrect ? " ✓" : ""} — ${o.content.slice(0, 50)}`,
                      value: o.pct,
                      n: o.count,
                    }))}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Matriz aluno × habilidade" subtitle="Matriz de calor · acesso restrito a profissionais autorizados">
        <Heatmap rows={data.matrix.rows} columns={data.matrix.columns} values={data.matrix.values} />
      </Card>
    </div>
  );
}
