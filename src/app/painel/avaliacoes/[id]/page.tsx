import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  assessmentAssignments,
  assessmentQuestions,
  assessments,
  attempts,
  bnccSkills,
  classes,
  questionOptions,
  questionSkills,
  questions,
  schools,
  studentEnrollments,
  students,
  subjects,
} from "@/db/schema";
import { Badge, btnGhost, btnPrimary, Card, EmptyState, Field, inputClass } from "@/components/ui";
import { assertSchoolAccessPage, requirePage } from "@/lib/auth";
import {
  addQuestionToAssessmentAction,
  assignClassAction,
  assignStudentAction,
  changeAssessmentStatusAction,
  publishAssessmentAction,
  removeQuestionFromAssessmentAction,
} from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function AssessmentDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage(["admin", "teacher"]);
  const { id } = await params;

  const a = (
    await db
      .select({
        a: assessments,
        schoolName: schools.name,
        subjectName: subjects.name,
        className: classes.name,
      })
      .from(assessments)
      .innerJoin(schools, eq(schools.id, assessments.schoolId))
      .innerJoin(subjects, eq(subjects.id, assessments.subjectId))
      .leftJoin(classes, eq(classes.id, assessments.classId))
      .where(eq(assessments.id, id))
      .limit(1)
  )[0];
  if (!a) notFound();
  await assertSchoolAccessPage(user, a.a.schoolId);

  const selected = await db
    .select({
      questionId: questions.id,
      statement: questions.statement,
      type: questions.type,
      points: assessmentQuestions.points,
      position: assessmentQuestions.position,
      skills: sql<string>`coalesce((select string_agg(b.code, ', ') from ${questionSkills} qs join ${bnccSkills} b on b.id = qs.skill_id where qs.question_id = ${questions.id}), '—')`,
      options: sql<string>`coalesce((select string_agg(o.label || ') ' || o.content, '  ' order by o.position) from ${questionOptions} o where o.question_id = ${questions.id}), '')`,
    })
    .from(assessmentQuestions)
    .innerJoin(questions, eq(questions.id, assessmentQuestions.questionId))
    .where(eq(assessmentQuestions.assessmentId, id))
    .orderBy(asc(assessmentQuestions.position));

  const available = await db
    .select({
      id: questions.id,
      statement: questions.statement,
      type: questions.type,
      skills: sql<string>`coalesce((select string_agg(b.code, ', ') from ${questionSkills} qs join ${bnccSkills} b on b.id = qs.skill_id where qs.question_id = ${questions.id}), '—')`,
    })
    .from(questions)
    .where(
      and(
        eq(questions.gradeYear, a.a.gradeYear),
        sql`${questions.reviewStatus} in ('aprovada','em_revisao')`,
        sql`not exists (select 1 from ${assessmentQuestions} aq where aq.assessment_id = ${id} and aq.question_id = ${questions.id})`,
      ),
    )
    .orderBy(asc(questions.createdAt))
    .limit(60);

  const classList = await db
    .select({ id: classes.id, name: classes.name })
    .from(classes)
    .where(eq(classes.schoolId, a.a.schoolId))
    .orderBy(asc(classes.gradeYear));

  const studentList = await db
    .select({ id: students.id, name: students.fullName })
    .from(students)
    .where(eq(students.schoolId, a.a.schoolId))
    .orderBy(asc(students.fullName))
    .limit(400);

  const assignments = await db
    .select({
      id: assessmentAssignments.id,
      className: classes.name,
      studentName: students.fullName,
    })
    .from(assessmentAssignments)
    .leftJoin(classes, eq(classes.id, assessmentAssignments.classId))
    .leftJoin(students, eq(students.id, assessmentAssignments.studentId))
    .where(eq(assessmentAssignments.assessmentId, id));

  const progress = await db
    .select({
      studentName: students.fullName,
      status: attempts.status,
      total: attempts.totalScore,
      max: attempts.maxScore,
      submittedAt: attempts.submittedAt,
    })
    .from(attempts)
    .innerJoin(students, eq(students.id, attempts.studentId))
    .where(eq(attempts.assessmentId, id))
    .orderBy(asc(students.fullName));

  const expected = (
    await db
      .selectDistinct({ id: students.id })
      .from(assessmentAssignments)
      .leftJoin(
        studentEnrollments,
        and(eq(studentEnrollments.classId, assessmentAssignments.classId), eq(studentEnrollments.active, true)),
      )
      .innerJoin(
        students,
        sql`${students.id} = coalesce(${assessmentAssignments.studentId}, ${studentEnrollments.studentId})`,
      )
      .where(eq(assessmentAssignments.assessmentId, id))
  ).length;

  const isDraft = a.a.status === "rascunho";
  const totalPoints = selected.reduce((acc, q) => acc + Number(q.points), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/painel/avaliacoes" className="text-sm text-sky-700 hover:underline">
            ← Avaliações
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">{a.a.title}</h1>
          <p className="text-sm text-slate-600">
            {a.schoolName} · {a.className ?? "sem turma fixa"} · {a.a.gradeYear}º ano · {a.subjectName} ·{" "}
            {a.a.durationMinutes} min · {a.a.maxAttempts} tentativa(s) · {totalPoints.toFixed(2)} pontos
          </p>
        </div>
        <Badge tone={a.a.status === "publicada" ? "green" : isDraft ? "slate" : "blue"}>
          {a.a.status.replace(/_/g, " ")}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`Questões da prova (${selected.length})`} subtitle="Passo 5 — monte a prova com o banco de questões.">
          {selected.length === 0 ? (
            <EmptyState message="Nenhuma questão adicionada." />
          ) : (
            <ol className="flex flex-col gap-3">
              {selected.map((q, i) => (
                <li key={q.questionId} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {i + 1}. {q.statement}
                      </p>
                      {q.options && <p className="mt-1 text-xs text-slate-500">{q.options}</p>}
                      <p className="mt-1 text-xs text-sky-700">BNCC: {q.skills} · {Number(q.points).toFixed(2)} pt</p>
                    </div>
                    {isDraft && (
                      <form action={removeQuestionFromAssessmentAction}>
                        <input type="hidden" name="assessmentId" value={id} />
                        <input type="hidden" name="questionId" value={q.questionId} />
                        <button className="rounded border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                          Remover
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card title="Adicionar questões do banco" subtitle={`Questões de ${a.a.gradeYear}º ano disponíveis`}>
          {!isDraft ? (
            <EmptyState message="A composição só pode ser alterada enquanto a avaliação estiver em rascunho." />
          ) : available.length === 0 ? (
            <EmptyState message="Não há questões disponíveis para este ano escolar." />
          ) : (
            <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
              {available.map((q) => (
                <li key={q.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 p-2">
                  <div>
                    <p className="text-sm text-slate-800">{q.statement}</p>
                    <p className="text-xs text-sky-700">BNCC: {q.skills}</p>
                  </div>
                  <form action={addQuestionToAssessmentAction}>
                    <input type="hidden" name="assessmentId" value={id} />
                    <input type="hidden" name="questionId" value={q.id} />
                    <button className={`${btnGhost} px-2 py-1 text-xs`}>Adicionar</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Atribuição" subtitle="Passo 8 — atribua a turmas inteiras ou a alunos específicos.">
          <ul className="mb-4 flex flex-wrap gap-2">
            {assignments.length === 0 && <li className="text-sm text-slate-500">Nenhuma atribuição ainda.</li>}
            {assignments.map((as) => (
              <li key={as.id}>
                <Badge tone="blue">{as.className ?? as.studentName}</Badge>
              </li>
            ))}
          </ul>
          <div className="grid gap-4 sm:grid-cols-2">
            <form action={assignClassAction} className="flex flex-col gap-2">
              <input type="hidden" name="assessmentId" value={id} />
              <Field label="Atribuir a uma turma" htmlFor="as-class">
                <select id="as-class" name="classId" className={inputClass} required defaultValue="">
                  <option value="" disabled>
                    Selecione
                  </option>
                  {classList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <button className={btnGhost}>Atribuir turma</button>
            </form>
            <form action={assignStudentAction} className="flex flex-col gap-2">
              <input type="hidden" name="assessmentId" value={id} />
              <Field label="Atribuir a um aluno" htmlFor="as-student">
                <select id="as-student" name="studentId" className={inputClass} required defaultValue="">
                  <option value="" disabled>
                    Selecione
                  </option>
                  {studentList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <button className={btnGhost}>Atribuir aluno</button>
            </form>
          </div>
        </Card>

        <Card title="Publicação e resultados" subtitle="Passos 7, 9 e 10">
          <div className="flex flex-col gap-3">
            <Link href={`/painel/avaliacoes/${id}/previa`} className={btnGhost}>
              Visualizar prova antes de publicar
            </Link>
            {isDraft && (
              <form action={publishAssessmentAction}>
                <input type="hidden" name="assessmentId" value={id} />
                <button className={btnPrimary}>Publicar avaliação</button>
              </form>
            )}
            {a.a.status === "publicada" && (
              <form action={changeAssessmentStatusAction}>
                <input type="hidden" name="assessmentId" value={id} />
                <input type="hidden" name="status" value="encerrada" />
                <button className={btnPrimary}>Encerrar aplicação</button>
              </form>
            )}
            {(a.a.status === "encerrada" || a.a.status === "publicada") && (
              <form action={changeAssessmentStatusAction}>
                <input type="hidden" name="assessmentId" value={id} />
                <input type="hidden" name="status" value="resultados_liberados" />
                <button className={btnGhost}>Liberar resultados aos alunos</button>
              </form>
            )}
            <p className="text-xs text-slate-500">
              Enquanto os resultados não forem liberados, o aluno não vê pontuação nem gabarito.
            </p>
          </div>
        </Card>
      </div>

      <Card
        title="Acompanhamento da aplicação"
        subtitle={`${progress.filter((p) => p.status !== "em_andamento").length} de ${expected} alunos atribuídos concluíram`}
      >
        {progress.length === 0 ? (
          <EmptyState message="Nenhuma tentativa iniciada." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Aluno</th>
                  <th className="px-3 py-2">Situação</th>
                  <th className="px-3 py-2">Pontuação</th>
                  <th className="px-3 py-2">Envio</th>
                </tr>
              </thead>
              <tbody>
                {progress.map((p, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-2">{p.studentName}</td>
                    <td className="px-3 py-2">
                      <Badge tone={p.status === "corrigida" ? "green" : p.status === "enviada" ? "amber" : "slate"}>
                        {p.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {Number(p.max) > 0
                        ? `${Number(p.total).toFixed(2)} / ${Number(p.max).toFixed(2)} (${((Number(p.total) / Number(p.max)) * 100).toFixed(0)}%)`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {p.submittedAt ? new Date(p.submittedAt).toLocaleString("pt-BR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
