"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  answers,
  assessmentAssignments,
  assessmentQuestions,
  assessments,
  attempts,
  classes,
  gradingRecords,
  profiles,
  questionOptions,
  questionSkills,
  questions,
  schools,
  staffSchools,
  studentEnrollments,
  students,
} from "@/db/schema";
import {
  assertSchoolAccess,
  audit,
  hashPassword,
  HttpError,
  normalizeName,
  requireUser,
} from "@/lib/auth";

function slugify(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const num = (fd: FormData, key: string) => Number(fd.get(key) ?? 0);

export async function createSchoolAction(fd: FormData) {
  const user = await requireUser(["admin"]);
  const name = str(fd, "name");
  if (!name) throw new HttpError(400, "Informe o nome da escola.");
  const [row] = await db
    .insert(schools)
    .values({ name, slug: slugify(name), city: str(fd, "city") || null, network: str(fd, "network") || null })
    .onConflictDoNothing()
    .returning({ id: schools.id });
  await audit(user, "school_created", "schools", row?.id);
  revalidatePath("/painel/escolas");
}

export async function createClassAction(fd: FormData) {
  const user = await requireUser(["admin", "manager"]);
  const schoolId = str(fd, "schoolId");
  await assertSchoolAccess(user, schoolId);
  const name = str(fd, "name");
  const gradeYear = num(fd, "gradeYear");
  if (!name || !gradeYear) throw new HttpError(400, "Informe nome e ano escolar da turma.");
  const [row] = await db
    .insert(classes)
    .values({ schoolId, name, gradeYear, shift: str(fd, "shift") || null, academicYear: 2026 })
    .onConflictDoNothing()
    .returning({ id: classes.id });
  await audit(user, "class_created", "classes", row?.id);
  revalidatePath("/painel/escolas");
}

export async function createStaffAction(fd: FormData) {
  const user = await requireUser(["admin"]);
  const role = str(fd, "role") as "manager" | "teacher" | "admin";
  const email = str(fd, "email").toLowerCase();
  const fullName = str(fd, "fullName");
  const password = str(fd, "password") || "Mudar@123";
  const schoolId = str(fd, "schoolId") || null;
  if (!email || !fullName) throw new HttpError(400, "Informe nome e e-mail.");
  const [row] = await db
    .insert(profiles)
    .values({
      role,
      fullName,
      email,
      passwordHash: await hashPassword(password),
      schoolId,
      mustChangePassword: true,
    })
    .onConflictDoNothing()
    .returning({ id: profiles.id });
  if (row && schoolId) {
    await db.insert(staffSchools).values({ profileId: row.id, schoolId }).onConflictDoNothing();
  }
  await audit(user, "staff_created", "profiles", row?.id, { role });
  revalidatePath("/painel/usuarios");
}

export async function resetStudentPasswordAction(fd: FormData) {
  const user = await requireUser(["admin", "manager", "teacher"]);
  const studentId = str(fd, "studentId");
  const st = (await db.select().from(students).where(eq(students.id, studentId)).limit(1))[0];
  if (!st) throw new HttpError(404, "Aluno não encontrado.");
  await assertSchoolAccess(user, st.schoolId);
  await db
    .update(profiles)
    .set({
      passwordHash: await hashPassword("123456"),
      mustChangePassword: true,
      failedAttempts: 0,
      lockedUntil: null,
    })
    .where(eq(profiles.studentId, studentId));
  await audit(user, "student_password_reset", "students", studentId);
  revalidatePath("/painel/escolas");
}

/* ----------------------------- Questões ----------------------------- */

export async function createQuestionAction(fd: FormData) {
  const user = await requireUser(["admin", "teacher"]);
  const type = str(fd, "type") as "multiple_choice" | "true_false" | "short_answer" | "open_answer";
  const statement = str(fd, "statement");
  const subjectId = str(fd, "subjectId");
  const gradeYear = num(fd, "gradeYear");
  if (!statement || !subjectId || !gradeYear) throw new HttpError(400, "Preencha os campos obrigatórios.");

  const [q] = await db
    .insert(questions)
    .values({
      subjectId,
      gradeYear,
      type,
      statement,
      supportText: str(fd, "supportText") || null,
      correctionCriteria: str(fd, "correctionCriteria") || null,
      answerKeyText: str(fd, "answerKeyText") || null,
      points: str(fd, "points") || "1.00",
      difficulty: (str(fd, "difficulty") || "medio") as "facil" | "medio" | "dificil",
      reviewStatus: (str(fd, "reviewStatus") || "rascunho") as
        | "rascunho"
        | "em_revisao"
        | "aprovada"
        | "arquivada",
      authorId: user.id,
      schoolId: user.schoolId,
    })
    .returning({ id: questions.id });

  if (type === "multiple_choice") {
    const correct = str(fd, "correctOption");
    const labels = ["A", "B", "C", "D", "E"];
    let pos = 0;
    for (const label of labels) {
      const content = str(fd, `option${label}`);
      if (!content) continue;
      await db.insert(questionOptions).values({
        questionId: q.id,
        label,
        content,
        isCorrect: correct === label,
        position: pos++,
      });
    }
  } else if (type === "true_false") {
    const key = str(fd, "tfAnswer") === "V";
    await db.insert(questionOptions).values([
      { questionId: q.id, label: "V", content: "Verdadeiro", isCorrect: key, position: 0 },
      { questionId: q.id, label: "F", content: "Falso", isCorrect: !key, position: 1 },
    ]);
  }

  const skillId = str(fd, "skillId");
  if (skillId) {
    await db
      .insert(questionSkills)
      .values({ questionId: q.id, skillId, validated: fd.get("skillValidated") === "on" })
      .onConflictDoNothing();
  }
  await audit(user, "question_created", "questions", q.id);
  revalidatePath("/painel/questoes");
}

export async function updateQuestionStatusAction(fd: FormData) {
  const user = await requireUser(["admin", "teacher"]);
  const id = str(fd, "questionId");
  const status = str(fd, "reviewStatus") as "rascunho" | "em_revisao" | "aprovada" | "arquivada";
  await db.update(questions).set({ reviewStatus: status }).where(eq(questions.id, id));
  await audit(user, "question_status_changed", "questions", id, { status });
  revalidatePath("/painel/questoes");
}

/* ----------------------------- Avaliações ----------------------------- */

export async function createAssessmentAction(fd: FormData) {
  const user = await requireUser(["admin", "teacher"]);
  const schoolId = str(fd, "schoolId");
  await assertSchoolAccess(user, schoolId);
  const classId = str(fd, "classId") || null;
  const title = str(fd, "title");
  const subjectId = str(fd, "subjectId");
  const gradeYear = num(fd, "gradeYear");
  if (!title || !subjectId || !gradeYear) throw new HttpError(400, "Preencha os campos obrigatórios.");

  const [row] = await db
    .insert(assessments)
    .values({
      title,
      description: str(fd, "description") || null,
      schoolId,
      classId,
      subjectId,
      gradeYear,
      durationMinutes: num(fd, "durationMinutes") || 50,
      availableFrom: str(fd, "availableFrom") ? new Date(str(fd, "availableFrom")) : null,
      availableUntil: str(fd, "availableUntil") ? new Date(str(fd, "availableUntil")) : null,
      maxAttempts: num(fd, "maxAttempts") || 1,
      createdBy: user.id,
    })
    .returning({ id: assessments.id });
  await audit(user, "assessment_created", "assessments", row.id);
  revalidatePath("/painel/avaliacoes");
}

async function loadAssessmentForEdit(assessmentId: string) {
  const user = await requireUser(["admin", "teacher"]);
  const a = (await db.select().from(assessments).where(eq(assessments.id, assessmentId)).limit(1))[0];
  if (!a) throw new HttpError(404, "Avaliação não encontrada.");
  await assertSchoolAccess(user, a.schoolId);
  return { user, assessment: a };
}

export async function addQuestionToAssessmentAction(fd: FormData) {
  const assessmentId = str(fd, "assessmentId");
  const { user, assessment } = await loadAssessmentForEdit(assessmentId);
  if (assessment.status !== "rascunho")
    throw new HttpError(400, "Só é possível alterar questões em avaliações em rascunho.");
  const questionId = str(fd, "questionId");
  const count = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(assessmentQuestions)
    .where(eq(assessmentQuestions.assessmentId, assessmentId));
  const qrow = (await db.select().from(questions).where(eq(questions.id, questionId)).limit(1))[0];
  if (!qrow) throw new HttpError(404, "Questão não encontrada.");
  await db
    .insert(assessmentQuestions)
    .values({
      assessmentId,
      questionId,
      position: count[0]?.c ?? 0,
      points: qrow.points,
    })
    .onConflictDoNothing();
  await audit(user, "assessment_question_added", "assessments", assessmentId, { questionId });
  revalidatePath(`/painel/avaliacoes/${assessmentId}`);
}

export async function removeQuestionFromAssessmentAction(fd: FormData) {
  const assessmentId = str(fd, "assessmentId");
  const { user, assessment } = await loadAssessmentForEdit(assessmentId);
  if (assessment.status !== "rascunho") throw new HttpError(400, "Avaliação já publicada.");
  await db
    .delete(assessmentQuestions)
    .where(
      and(
        eq(assessmentQuestions.assessmentId, assessmentId),
        eq(assessmentQuestions.questionId, str(fd, "questionId")),
      ),
    );
  await audit(user, "assessment_question_removed", "assessments", assessmentId);
  revalidatePath(`/painel/avaliacoes/${assessmentId}`);
}

export async function publishAssessmentAction(fd: FormData) {
  const assessmentId = str(fd, "assessmentId");
  const { user, assessment } = await loadAssessmentForEdit(assessmentId);
  const count = (
    await db
      .select({ c: sql<number>`count(*)::int` })
      .from(assessmentQuestions)
      .where(eq(assessmentQuestions.assessmentId, assessmentId))
  )[0].c;
  if (!count) throw new HttpError(400, "Adicione ao menos uma questão antes de publicar.");
  if (assessment.classId) {
    await db
      .insert(assessmentAssignments)
      .values({ assessmentId, classId: assessment.classId })
      .onConflictDoNothing();
  }
  await db.update(assessments).set({ status: "publicada" }).where(eq(assessments.id, assessmentId));
  await audit(user, "assessment_published", "assessments", assessmentId, { questions: count });
  revalidatePath(`/painel/avaliacoes/${assessmentId}`);
}

export async function changeAssessmentStatusAction(fd: FormData) {
  const assessmentId = str(fd, "assessmentId");
  const { user } = await loadAssessmentForEdit(assessmentId);
  const status = str(fd, "status") as "encerrada" | "resultados_liberados" | "publicada";
  if (status === "encerrada") {
    // encerra tentativas em andamento
    await db
      .update(attempts)
      .set({ status: "enviada", submittedAt: new Date() })
      .where(and(eq(attempts.assessmentId, assessmentId), eq(attempts.status, "em_andamento")));
  }
  await db
    .update(assessments)
    .set({ status, releaseResults: status === "resultados_liberados" })
    .where(eq(assessments.id, assessmentId));
  await audit(user, "assessment_status_changed", "assessments", assessmentId, { status });
  revalidatePath(`/painel/avaliacoes/${assessmentId}`);
}

export async function assignStudentAction(fd: FormData) {
  const assessmentId = str(fd, "assessmentId");
  const { user, assessment } = await loadAssessmentForEdit(assessmentId);
  const studentId = str(fd, "studentId");
  const st = (await db.select().from(students).where(eq(students.id, studentId)).limit(1))[0];
  if (!st || st.schoolId !== assessment.schoolId)
    throw new HttpError(400, "Aluno não pertence à escola da avaliação.");
  await db.insert(assessmentAssignments).values({ assessmentId, studentId }).onConflictDoNothing();
  await audit(user, "assessment_assigned_student", "assessments", assessmentId, { studentId });
  revalidatePath(`/painel/avaliacoes/${assessmentId}`);
}

export async function assignClassAction(fd: FormData) {
  const assessmentId = str(fd, "assessmentId");
  const { user, assessment } = await loadAssessmentForEdit(assessmentId);
  const classId = str(fd, "classId");
  const k = (await db.select().from(classes).where(eq(classes.id, classId)).limit(1))[0];
  if (!k || k.schoolId !== assessment.schoolId)
    throw new HttpError(400, "Turma não pertence à escola da avaliação.");
  await db.insert(assessmentAssignments).values({ assessmentId, classId }).onConflictDoNothing();
  await audit(user, "assessment_assigned_class", "assessments", assessmentId, { classId });
  revalidatePath(`/painel/avaliacoes/${assessmentId}`);
}

/* ----------------------------- Correção ----------------------------- */

export async function gradeAnswerAction(fd: FormData) {
  const user = await requireUser(["admin", "teacher"]);
  const answerId = str(fd, "answerId");
  const row = (
    await db
      .select({
        answer: answers,
        attemptId: attempts.id,
        schoolId: assessments.schoolId,
      })
      .from(answers)
      .innerJoin(attempts, eq(attempts.id, answers.attemptId))
      .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
      .where(eq(answers.id, answerId))
      .limit(1)
  )[0];
  if (!row) throw new HttpError(404, "Resposta não encontrada.");
  await assertSchoolAccess(user, row.schoolId);

  const raw = Number(str(fd, "score").replace(",", "."));
  const max = Number(row.answer.maxScore);
  if (Number.isNaN(raw) || raw < 0 || raw > max)
    throw new HttpError(400, `A pontuação deve estar entre 0 e ${max}.`);

  await db
    .update(answers)
    .set({ score: raw.toFixed(2), gradingStatus: "corrigida", updatedAt: new Date() })
    .where(eq(answers.id, answerId));
  await db.insert(gradingRecords).values({
    answerId,
    graderId: user.id,
    previousScore: row.answer.score,
    newScore: raw.toFixed(2),
    feedback: str(fd, "feedback") || null,
  });

  const sums = (
    await db
      .select({
        manual: sql<string>`coalesce(sum(case when ${answers.gradingStatus} = 'corrigida' then ${answers.score} else 0 end),0)`,
        auto: sql<string>`coalesce(sum(case when ${answers.gradingStatus} = 'automatica' then ${answers.score} else 0 end),0)`,
        pending: sql<number>`count(*) filter (where ${answers.gradingStatus} = 'pendente')::int`,
      })
      .from(answers)
      .where(eq(answers.attemptId, row.attemptId))
  )[0];

  await db
    .update(attempts)
    .set({
      autoScore: sums.auto,
      manualScore: sums.manual,
      totalScore: (Number(sums.auto) + Number(sums.manual)).toFixed(2),
      status: sums.pending === 0 ? "corrigida" : "enviada",
    })
    .where(eq(attempts.id, row.attemptId));

  await audit(user, "answer_graded", "answers", answerId, { score: raw });
  revalidatePath("/painel/correcao");
}

/* ----------------------------- Alunos ----------------------------- */

export async function createStudentAction(fd: FormData) {
  const user = await requireUser(["admin", "manager"]);
  const schoolId = str(fd, "schoolId");
  await assertSchoolAccess(user, schoolId);
  const fullName = str(fd, "fullName");
  const classId = str(fd, "classId");
  if (!fullName || !classId) throw new HttpError(400, "Informe o nome completo e a turma.");
  const [st] = await db
    .insert(students)
    .values({
      schoolId,
      fullName,
      normalizedName: normalizeName(fullName),
      registration: str(fd, "registration") || null,
    })
    .onConflictDoUpdate({
      target: [students.schoolId, students.normalizedName],
      set: { fullName },
    })
    .returning({ id: students.id });
  await db
    .insert(studentEnrollments)
    .values({ studentId: st.id, classId, academicYear: 2026 })
    .onConflictDoNothing();
  await db
    .insert(profiles)
    .values({
      role: "student",
      fullName,
      passwordHash: await hashPassword("123456"),
      schoolId,
      studentId: st.id,
      mustChangePassword: true,
    })
    .onConflictDoNothing();
  await audit(user, "student_created", "students", st.id);
  revalidatePath("/painel/escolas");
}
