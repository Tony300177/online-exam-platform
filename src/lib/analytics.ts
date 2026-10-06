import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  answers,
  assessments,
  assessmentAssignments,
  attempts,
  bnccSkills,
  questionOptions,
  questionSkills,
  questions,
  studentEnrollments,
  students,
} from "@/db/schema";

export type AnalyticsFilters = {
  allowedSchoolIds: string[] | null;
  schoolId?: string;
  classId?: string;
  gradeYear?: number;
  subjectId?: string;
  assessmentId?: string;
  studentId?: string;
  from?: string;
  to?: string;
};

export type AnalyticsResult = {
  totals: {
    assessments: number;
    attempts: number;
    submitted: number;
    assignedStudents: number;
    participationRate: number;
    answers: number;
    blanks: number;
    accuracy: number;
    average: number;
    median: number;
  };
  distribution: { label: string; count: number }[];
  bySkill: { code: string; description: string; value: number; n: number }[];
  retake: { code: string; description: string; value: number; n: number }[];
  byOption: {
    questionId: string;
    statement: string;
    options: { label: string; content: string; isCorrect: boolean; count: number; pct: number }[];
    n: number;
  }[];
  evolution: { label: string; value: number }[];
  matrix: {
    rows: string[];
    columns: { code: string; label: string }[];
    values: Record<string, Record<string, number | null>>;
  };
};

function filterConditions(f: AnalyticsFilters): SQL[] {
  const conds: SQL[] = [];
  if (f.allowedSchoolIds !== null) {
    conds.push(
      f.allowedSchoolIds.length
        ? inArray(assessments.schoolId, f.allowedSchoolIds)
        : sql`false`,
    );
  }
  if (f.schoolId) conds.push(eq(assessments.schoolId, f.schoolId));
  if (f.gradeYear) conds.push(eq(assessments.gradeYear, f.gradeYear));
  if (f.subjectId) conds.push(eq(assessments.subjectId, f.subjectId));
  if (f.assessmentId) conds.push(eq(assessments.id, f.assessmentId));
  if (f.classId) conds.push(eq(assessments.classId, f.classId));
  if (f.studentId) conds.push(eq(attempts.studentId, f.studentId));
  if (f.from) conds.push(sql`${attempts.submittedAt} >= ${f.from}`);
  if (f.to) conds.push(sql`${attempts.submittedAt} <= ${f.to}`);
  return conds;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export async function getAnalytics(f: AnalyticsFilters): Promise<AnalyticsResult> {
  const conds = filterConditions(f);
  const where = conds.length ? and(...conds) : undefined;

  // Tentativas enviadas/corrigidas
  const attemptRows = await db
    .select({
      id: attempts.id,
      studentId: attempts.studentId,
      studentName: students.fullName,
      total: attempts.totalScore,
      max: attempts.maxScore,
      status: attempts.status,
      submittedAt: attempts.submittedAt,
      assessmentId: assessments.id,
      assessmentTitle: assessments.title,
      assessmentGrade: assessments.gradeYear,
      assessmentSubject: assessments.subjectId,
      createdAt: assessments.createdAt,
    })
    .from(attempts)
    .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
    .innerJoin(students, eq(students.id, attempts.studentId))
    .where(where);

  const finished = attemptRows.filter((a) => a.status !== "em_andamento");
  const percents = finished
    .filter((a) => Number(a.max) > 0)
    .map((a) => (Number(a.total) / Number(a.max)) * 100);

  // Alunos atribuídos (participação) — apenas filtros de nível de avaliação
  const assessmentConds: SQL[] = [];
  if (f.allowedSchoolIds !== null) {
    assessmentConds.push(
      f.allowedSchoolIds.length ? inArray(assessments.schoolId, f.allowedSchoolIds) : sql`false`,
    );
  }
  if (f.schoolId) assessmentConds.push(eq(assessments.schoolId, f.schoolId));
  if (f.gradeYear) assessmentConds.push(eq(assessments.gradeYear, f.gradeYear));
  if (f.subjectId) assessmentConds.push(eq(assessments.subjectId, f.subjectId));
  if (f.assessmentId) assessmentConds.push(eq(assessments.id, f.assessmentId));
  if (f.classId) assessmentConds.push(eq(assessments.classId, f.classId));

  const assignedRows = await db
    .selectDistinct({ studentId: students.id })
    .from(assessmentAssignments)
    .innerJoin(assessments, eq(assessments.id, assessmentAssignments.assessmentId))
    .leftJoin(
      studentEnrollments,
      and(
        eq(studentEnrollments.classId, assessmentAssignments.classId),
        eq(studentEnrollments.active, true),
      ),
    )
    .innerJoin(
      students,
      sql`${students.id} = coalesce(${assessmentAssignments.studentId}, ${studentEnrollments.studentId})`,
    )
    .where(assessmentConds.length ? and(...assessmentConds) : undefined);

  // Respostas detalhadas
  const answerRows = await db
    .select({
      answerId: answers.id,
      attemptId: answers.attemptId,
      questionId: answers.questionId,
      statement: questions.statement,
      optionId: answers.selectedOptionId,
      isBlank: answers.isBlank,
      score: answers.score,
      maxScore: answers.maxScore,
      studentName: students.fullName,
      assessmentTitle: assessments.title,
    })
    .from(answers)
    .innerJoin(attempts, eq(attempts.id, answers.attemptId))
    .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
    .innerJoin(students, eq(students.id, attempts.studentId))
    .innerJoin(questions, eq(questions.id, answers.questionId))
    .where(where ? and(where, sql`${attempts.status} <> 'em_andamento'`) : sql`${attempts.status} <> 'em_andamento'`);

  const totalAnswers = answerRows.length;
  const blanks = answerRows.filter((a) => a.isBlank).length;
  const totalPoints = answerRows.reduce((acc, a) => acc + Number(a.score ?? 0), 0);
  const maxPoints = answerRows.reduce((acc, a) => acc + Number(a.maxScore), 0);

  // Habilidades
  const skillLinks = await db
    .select({
      questionId: questionSkills.questionId,
      code: bnccSkills.code,
      description: bnccSkills.description,
    })
    .from(questionSkills)
    .innerJoin(bnccSkills, eq(bnccSkills.id, questionSkills.skillId));
  const skillByQuestion = new Map<string, { code: string; description: string }[]>();
  for (const l of skillLinks) {
    const arr = skillByQuestion.get(l.questionId) ?? [];
    arr.push({ code: l.code, description: l.description });
    skillByQuestion.set(l.questionId, arr);
  }

  const skillAgg = new Map<string, { description: string; got: number; max: number; n: number }>();
  const matrixAgg = new Map<string, Map<string, { got: number; max: number }>>();

  for (const a of answerRows) {
    const skills = skillByQuestion.get(a.questionId) ?? [];
    for (const s of skills) {
      const cur = skillAgg.get(s.code) ?? { description: s.description, got: 0, max: 0, n: 0 };
      cur.got += Number(a.score ?? 0);
      cur.max += Number(a.maxScore);
      cur.n += 1;
      skillAgg.set(s.code, cur);

      const studentMap = matrixAgg.get(a.studentName) ?? new Map();
      const cell = studentMap.get(s.code) ?? { got: 0, max: 0 };
      cell.got += Number(a.score ?? 0);
      cell.max += Number(a.maxScore);
      studentMap.set(s.code, cell);
      matrixAgg.set(a.studentName, studentMap);
    }
  }

  const bySkill = [...skillAgg.entries()]
    .map(([code, v]) => ({
      code,
      description: v.description,
      value: v.max > 0 ? (v.got / v.max) * 100 : 0,
      n: v.n,
    }))
    .sort((a, b) => a.value - b.value);

  // Distribuição de alternativas (apenas quando há avaliação selecionada)
  const byOption: AnalyticsResult["byOption"] = [];
  if (f.assessmentId) {
    const optRows = await db
      .select({
        questionId: questionOptions.questionId,
        id: questionOptions.id,
        label: questionOptions.label,
        content: questionOptions.content,
        isCorrect: questionOptions.isCorrect,
      })
      .from(questionOptions);
    const grouped = new Map<string, typeof optRows>();
    for (const o of optRows) {
      const arr = grouped.get(o.questionId) ?? [];
      arr.push(o);
      grouped.set(o.questionId, arr);
    }
    const questionIds = [...new Set(answerRows.map((a) => a.questionId))];
    for (const qid of questionIds) {
      const opts = grouped.get(qid);
      if (!opts?.length) continue;
      const related = answerRows.filter((a) => a.questionId === qid);
      const n = related.length;
      byOption.push({
        questionId: qid,
        statement: related[0]?.statement ?? "",
        n,
        options: opts
          .map((o) => {
            const count = related.filter((a) => a.optionId === o.id).length;
            return {
              label: o.label,
              content: o.content,
              isCorrect: o.isCorrect,
              count,
              pct: n ? (count / n) * 100 : 0,
            };
          })
          .sort((a, b) => a.label.localeCompare(b.label)),
      });
    }
  }

  // Evolução: média percentual por avaliação (mesmo ano e componente = comparáveis)
  const evolutionMap = new Map<string, { sum: number; n: number; date: number; grade: number; subject: string }>();
  for (const a of finished) {
    if (Number(a.max) <= 0) continue;
    const key = a.assessmentTitle;
    const cur = evolutionMap.get(key) ?? {
      sum: 0,
      n: 0,
      date: a.createdAt ? new Date(a.createdAt).getTime() : 0,
      grade: a.assessmentGrade,
      subject: a.assessmentSubject,
    };
    cur.sum += (Number(a.total) / Number(a.max)) * 100;
    cur.n += 1;
    evolutionMap.set(key, cur);
  }
  const evolutionAll = [...evolutionMap.entries()].sort((a, b) => a[1].date - b[1].date);
  // Só compara avaliações do mesmo ano escolar e componente curricular
  const refGrade = evolutionAll[0]?.[1].grade;
  const refSubject = evolutionAll[0]?.[1].subject;
  const evolution = evolutionAll
    .filter(([, v]) => v.grade === refGrade && v.subject === refSubject)
    .map(([label, v]) => ({ label, value: v.sum / v.n }));

  // Distribuição de pontuações
  const bucketLabels = ["0-20%", "21-40%", "41-60%", "61-80%", "81-100%"];
  const distribution = bucketLabels.map((label) => ({ label, count: 0 }));
  for (const p of percents) {
    const idx = Math.min(4, Math.floor(p / 20.0001));
    distribution[idx].count += 1;
  }

  const matrixRows = [...matrixAgg.keys()].sort();
  const matrixCols = bySkill.map((s) => ({ code: s.code, label: s.description }));
  const values: Record<string, Record<string, number | null>> = {};
  for (const r of matrixRows) {
    values[r] = {};
    for (const c of matrixCols) {
      const cell = matrixAgg.get(r)?.get(c.code);
      values[r][c.code] = cell && cell.max > 0 ? (cell.got / cell.max) * 100 : null;
    }
  }

  const distinctAssessments = new Set(attemptRows.map((a) => a.assessmentId)).size;
  const assigned = assignedRows.length || new Set(finished.map((a) => a.studentId)).size;

  return {
    totals: {
      assessments: distinctAssessments,
      attempts: attemptRows.length,
      submitted: finished.length,
      assignedStudents: assigned,
      participationRate: assigned ? (new Set(finished.map((a) => a.studentId)).size / assigned) * 100 : 0,
      answers: totalAnswers,
      blanks,
      accuracy: maxPoints > 0 ? (totalPoints / maxPoints) * 100 : 0,
      average: percents.length ? percents.reduce((a, b) => a + b, 0) / percents.length : 0,
      median: median(percents),
    },
    distribution,
    bySkill,
    retake: bySkill.filter((s) => s.value < 60),
    byOption,
    evolution,
    matrix: { rows: matrixRows, columns: matrixCols, values },
  };
}


