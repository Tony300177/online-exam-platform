import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { answers, assessments, attempts, gradingRecords, profiles, questions, students } from "@/db/schema";
import { Badge, Card, EmptyState, Field, inputClass } from "@/components/ui";
import { allowedSchoolIds, requirePage } from "@/lib/auth";
import { gradeAnswerAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function CorrecaoPage() {
  const user = await requirePage(["admin", "teacher"]);
  const allowed = await allowedSchoolIds(user);
  const scope = allowed === null ? undefined : allowed.length ? allowed : ["x"];

  const queue = await db
    .select({
      answerId: answers.id,
      text: answers.textValue,
      isBlank: answers.isBlank,
      maxScore: answers.maxScore,
      score: answers.score,
      status: answers.gradingStatus,
      statement: questions.statement,
      criteria: questions.correctionCriteria,
      studentName: students.fullName,
      assessmentTitle: assessments.title,
    })
    .from(answers)
    .innerJoin(attempts, eq(attempts.id, answers.attemptId))
    .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
    .innerJoin(students, eq(students.id, attempts.studentId))
    .innerJoin(questions, eq(questions.id, answers.questionId))
    .where(
      scope
        ? and(eq(answers.gradingStatus, "pendente"), inArray(assessments.schoolId, scope))
        : eq(answers.gradingStatus, "pendente"),
    )
    .orderBy(asc(assessments.title), asc(students.fullName))
    .limit(100);

  const history = await db
    .select({
      id: gradingRecords.id,
      newScore: gradingRecords.newScore,
      previousScore: gradingRecords.previousScore,
      createdAt: gradingRecords.createdAt,
      grader: profiles.fullName,
      studentName: students.fullName,
    })
    .from(gradingRecords)
    .leftJoin(profiles, eq(profiles.id, gradingRecords.graderId))
    .innerJoin(answers, eq(answers.id, gradingRecords.answerId))
    .innerJoin(attempts, eq(attempts.id, answers.attemptId))
    .innerJoin(students, eq(students.id, attempts.studentId))
    .orderBy(asc(gradingRecords.createdAt))
    .limit(20);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Fila de correção manual</h1>
        <p className="text-sm text-slate-600">
          Questões objetivas são corrigidas automaticamente no servidor. Aqui ficam as respostas
          abertas que aguardam avaliação pedagógica.
        </p>
      </div>

      <Card title={`Pendentes (${queue.length})`}>
        {queue.length === 0 ? (
          <EmptyState message="Nenhuma resposta aguardando correção." />
        ) : (
          <ul className="flex flex-col gap-4">
            {queue.map((item) => (
              <li key={item.answerId} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge tone="blue">{item.assessmentTitle}</Badge>
                  <Badge>{item.studentName}</Badge>
                  <Badge tone="amber">máx. {Number(item.maxScore).toFixed(2)} pt</Badge>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-800">{item.statement}</p>
                {item.criteria && (
                  <p className="mt-1 rounded bg-slate-50 p-2 text-xs text-slate-600">
                    Critérios: {item.criteria}
                  </p>
                )}
                <p className="mt-2 rounded border border-slate-100 bg-white p-3 text-sm text-slate-700">
                  {item.isBlank || !item.text ? <em className="text-slate-400">Resposta em branco</em> : item.text}
                </p>
                <form action={gradeAnswerAction} className="mt-3 grid gap-3 sm:grid-cols-3">
                  <input type="hidden" name="answerId" value={item.answerId} />
                  <Field label="Pontuação" htmlFor={`sc-${item.answerId}`}>
                    <input
                      id={`sc-${item.answerId}`}
                      name="score"
                      required
                      inputMode="decimal"
                      className={inputClass}
                      placeholder={`0 a ${Number(item.maxScore).toFixed(2)}`}
                    />
                  </Field>
                  <Field label="Devolutiva (opcional)" htmlFor={`fb-${item.answerId}`}>
                    <input id={`fb-${item.answerId}`} name="feedback" className={inputClass} />
                  </Field>
                  <div className="flex items-end">
                    <button className="w-full rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800">
                      Registrar correção
                    </button>
                  </div>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Histórico recente de correções">
        {history.length === 0 ? (
          <EmptyState message="Sem registros de correção manual." />
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  {h.studentName} — {Number(h.previousScore ?? 0).toFixed(2)} → {Number(h.newScore).toFixed(2)} pt
                </span>
                <span className="text-xs text-slate-500">
                  {h.grader ?? "—"} · {new Date(h.createdAt).toLocaleString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
