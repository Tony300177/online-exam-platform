import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  answers,
  assessmentAssignments,
  assessmentQuestions,
  assessments,
  attempts,
  questionOptions,
  questions,
  studentEnrollments,
} from "@/db/schema";
import { HttpError, type SessionUser } from "@/lib/auth";

export function normalizeAnswer(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(",", ".")
    .trim()
    .toLowerCase();
}

/** Avaliações efetivamente atribuídas ao aluno (turma ou individual). */
export async function assessmentsForStudent(studentId: string) {
  const classIds = (
    await db
      .select({ classId: studentEnrollments.classId })
      .from(studentEnrollments)
      .where(and(eq(studentEnrollments.studentId, studentId), eq(studentEnrollments.active, true)))
  ).map((r) => r.classId);

  const rows = await db
    .selectDistinct({
      id: assessments.id,
      title: assessments.title,
      description: assessments.description,
      status: assessments.status,
      durationMinutes: assessments.durationMinutes,
      availableFrom: assessments.availableFrom,
      availableUntil: assessments.availableUntil,
      maxAttempts: assessments.maxAttempts,
      releaseResults: assessments.releaseResults,
      gradeYear: assessments.gradeYear,
    })
    .from(assessments)
    .innerJoin(assessmentAssignments, eq(assessmentAssignments.assessmentId, assessments.id))
    .where(
      and(
        inArray(assessments.status, ["publicada", "encerrada", "resultados_liberados"]),
        classIds.length
          ? sql`(${assessmentAssignments.studentId} = ${studentId} or ${assessmentAssignments.classId} in ${classIds})`
          : eq(assessmentAssignments.studentId, studentId),
      ),
    );
  return rows;
}

export async function ensureStudentAssigned(studentId: string, assessmentId: string) {
  const list = await assessmentsForStudent(studentId);
  const found = list.find((a) => a.id === assessmentId);
  if (!found) throw new HttpError(403, "Esta prova não está atribuída a você.");
  return found;
}

export async function startOrResumeAttempt(user: SessionUser, assessmentId: string) {
  if (!user.studentId) throw new HttpError(403, "Apenas alunos realizam provas.");
  const assessment = await ensureStudentAssigned(user.studentId, assessmentId);
  const now = new Date();
  if (assessment.status !== "publicada") throw new HttpError(400, "Esta prova não está aberta.");
  if (assessment.availableFrom && assessment.availableFrom > now)
    throw new HttpError(400, "A prova ainda não está disponível.");
  if (assessment.availableUntil && assessment.availableUntil < now)
    throw new HttpError(400, "O prazo da prova foi encerrado.");

  const existing = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.assessmentId, assessmentId), eq(attempts.studentId, user.studentId)));

  const open = existing.find((a) => a.status === "em_andamento");
  if (open) return open.id;
  if (existing.length >= assessment.maxAttempts)
    throw new HttpError(400, "Você já utilizou todas as tentativas permitidas.");

  const items = await db
    .select({ questionId: assessmentQuestions.questionId, points: assessmentQuestions.points })
    .from(assessmentQuestions)
    .where(eq(assessmentQuestions.assessmentId, assessmentId));
  if (!items.length) throw new HttpError(400, "Esta prova ainda não possui questões.");

  const maxScore = items.reduce((acc, i) => acc + Number(i.points), 0);
  const [attempt] = await db
    .insert(attempts)
    .values({
      assessmentId,
      studentId: user.studentId,
      attemptNumber: existing.length + 1,
      maxScore: maxScore.toFixed(2),
    })
    .returning({ id: attempts.id });

  await db.insert(answers).values(
    items.map((i) => ({
      attemptId: attempt.id,
      questionId: i.questionId,
      maxScore: i.points,
      isBlank: true,
      gradingStatus: "pendente" as const,
    })),
  );
  return attempt.id;
}

export async function loadAttemptForStudent(user: SessionUser, attemptId: string) {
  if (!user.studentId) throw new HttpError(403, "Acesso negado.");
  const attempt = (await db.select().from(attempts).where(eq(attempts.id, attemptId)).limit(1))[0];
  if (!attempt) throw new HttpError(404, "Tentativa não encontrada.");
  // impede acesso por troca de identificador na URL
  if (attempt.studentId !== user.studentId) throw new HttpError(403, "Acesso negado.");
  return attempt;
}

export async function saveAnswer(
  user: SessionUser,
  attemptId: string,
  payload: { questionId: string; optionId?: string | null; text?: string | null; boolean?: boolean | null },
) {
  const attempt = await loadAttemptForStudent(user, attemptId);
  if (attempt.status !== "em_andamento")
    throw new HttpError(400, "Esta prova já foi enviada e não pode ser alterada.");

  const belongs = (
    await db
      .select({ c: sql<number>`count(*)::int` })
      .from(assessmentQuestions)
      .where(
        and(
          eq(assessmentQuestions.assessmentId, attempt.assessmentId),
          eq(assessmentQuestions.questionId, payload.questionId),
        ),
      )
  )[0].c;
  if (!belongs) throw new HttpError(400, "Questão não pertence a esta prova.");

  let optionId: string | null = null;
  if (payload.optionId) {
    const opt = (
      await db
        .select({ id: questionOptions.id })
        .from(questionOptions)
        .where(
          and(eq(questionOptions.id, payload.optionId), eq(questionOptions.questionId, payload.questionId)),
        )
        .limit(1)
    )[0];
    if (!opt) throw new HttpError(400, "Alternativa inválida.");
    optionId = opt.id;
  }

  const text = payload.text?.trim() ?? null;
  const isBlank = !optionId && !text;

  await db
    .update(answers)
    .set({ selectedOptionId: optionId, textValue: text, isBlank, updatedAt: new Date() })
    .where(and(eq(answers.attemptId, attemptId), eq(answers.questionId, payload.questionId)));

  await db.update(attempts).set({ lastSavedAt: new Date() }).where(eq(attempts.id, attemptId));
  return true;
}

/** Correção automática no servidor + fila manual para questões abertas. */
export async function submitAttempt(user: SessionUser, attemptId: string) {
  const attempt = await loadAttemptForStudent(user, attemptId);
  if (attempt.status !== "em_andamento") return attempt.id; // idempotente

  const rows = await db
    .select({
      answerId: answers.id,
      questionId: answers.questionId,
      optionId: answers.selectedOptionId,
      text: answers.textValue,
      isBlank: answers.isBlank,
      maxScore: answers.maxScore,
      type: questions.type,
      answerKey: questions.answerKeyText,
    })
    .from(answers)
    .innerJoin(questions, eq(questions.id, answers.questionId))
    .where(eq(answers.attemptId, attemptId));

  const correctOptions = await db
    .select({ id: questionOptions.id, questionId: questionOptions.questionId })
    .from(questionOptions)
    .where(eq(questionOptions.isCorrect, true));
  const correctByQuestion = new Map(correctOptions.map((o) => [o.questionId, o.id]));

  let auto = 0;
  for (const r of rows) {
    if (r.type === "open_answer") {
      await db
        .update(answers)
        .set({ gradingStatus: r.isBlank ? "corrigida" : "pendente", score: r.isBlank ? "0.00" : null })
        .where(eq(answers.id, r.answerId));
      continue;
    }
    let score = 0;
    if (!r.isBlank) {
      if (r.type === "multiple_choice" || r.type === "true_false") {
        if (r.optionId && correctByQuestion.get(r.questionId) === r.optionId) score = Number(r.maxScore);
      } else if (r.type === "short_answer") {
        if (r.answerKey && r.text && normalizeAnswer(r.answerKey) === normalizeAnswer(r.text))
          score = Number(r.maxScore);
      }
    }
    auto += score;
    await db
      .update(answers)
      .set({ score: score.toFixed(2), gradingStatus: "automatica" })
      .where(eq(answers.id, r.answerId));
  }

  const pending = (
    await db
      .select({ c: sql<number>`count(*)::int` })
      .from(answers)
      .where(and(eq(answers.attemptId, attemptId), eq(answers.gradingStatus, "pendente")))
  )[0].c;

  await db
    .update(attempts)
    .set({
      status: pending > 0 ? "enviada" : "corrigida",
      submittedAt: new Date(),
      autoScore: auto.toFixed(2),
      totalScore: auto.toFixed(2),
    })
    .where(eq(attempts.id, attemptId));

  return attemptId;
}
