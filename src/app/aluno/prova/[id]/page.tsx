import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { answers, assessmentQuestions, assessments, questionOptions, questions } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { loadAttemptForStudent } from "@/lib/attempts";
import ExamRunner from "./runner";

export const dynamic = "force-dynamic";

export default async function ProvaPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/aluno/login");
  if (user.role !== "student") redirect("/painel");
  const { id } = await params;

  const attempt = await loadAttemptForStudent(user, id).catch(() => null);
  // Nunca expõe tentativa de outro aluno: identificador inválido volta ao painel.
  if (!attempt) redirect("/aluno");
  if (attempt.status !== "em_andamento") redirect("/aluno/resultados");

  const assessment = (
    await db.select().from(assessments).where(eq(assessments.id, attempt.assessmentId)).limit(1)
  )[0];

  const items = await db
    .select({
      questionId: questions.id,
      statement: questions.statement,
      support: questions.supportText,
      type: questions.type,
      points: assessmentQuestions.points,
    })
    .from(assessmentQuestions)
    .innerJoin(questions, eq(questions.id, assessmentQuestions.questionId))
    .where(eq(assessmentQuestions.assessmentId, attempt.assessmentId))
    .orderBy(asc(assessmentQuestions.position));

  const options = await db.select().from(questionOptions).orderBy(asc(questionOptions.position));
  const saved = await db.select().from(answers).where(eq(answers.attemptId, id));

  const payload = items.map((q) => ({
    ...q,
    points: Number(q.points),
    options: options
      .filter((o) => o.questionId === q.questionId)
      .map((o) => ({ id: o.id, label: o.label, content: o.content })),
    savedOptionId: saved.find((s) => s.questionId === q.questionId)?.selectedOptionId ?? null,
    savedText: saved.find((s) => s.questionId === q.questionId)?.textValue ?? "",
  }));

  const deadline = attempt.startedAt
    ? new Date(new Date(attempt.startedAt).getTime() + assessment.durationMinutes * 60000).toISOString()
    : null;

  return (
    <ExamRunner
      attemptId={id}
      title={assessment.title}
      instructions={assessment.description}
      deadline={deadline}
      questions={payload}
    />
  );
}
