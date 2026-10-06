import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";

/* =========================================================================
 * ENUMS
 * ========================================================================= */
export const userRole = pgEnum("user_role", ["admin", "manager", "teacher", "student"]);
export const questionType = pgEnum("question_type", [
  "multiple_choice",
  "true_false",
  "short_answer",
  "open_answer",
]);
export const difficulty = pgEnum("difficulty_level", ["facil", "medio", "dificil"]);
export const reviewStatus = pgEnum("review_status", ["rascunho", "em_revisao", "aprovada", "arquivada"]);
export const assessmentStatus = pgEnum("assessment_status", [
  "rascunho",
  "publicada",
  "encerrada",
  "resultados_liberados",
]);
export const attemptStatus = pgEnum("attempt_status", ["em_andamento", "enviada", "corrigida"]);
export const gradingStatus = pgEnum("grading_status", ["automatica", "pendente", "corrigida"]);

/* =========================================================================
 * ESTRUTURA ESCOLAR
 * ========================================================================= */
export const schools = pgTable(
  "schools",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    code: text("code"),
    city: text("city"),
    network: text("network"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("schools_slug_uq").on(t.slug)],
);

export const classes = pgTable(
  "classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    gradeYear: integer("grade_year").notNull(), // 1..9
    shift: text("shift"),
    academicYear: integer("academic_year").notNull().default(2026),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("classes_school_name_year_uq").on(t.schoolId, t.name, t.academicYear),
    index("classes_school_idx").on(t.schoolId),
  ],
);

export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    registration: text("registration"),
    birthDate: text("birth_date"),
    sex: text("sex"),
    race: text("race"),
    neighborhood: text("neighborhood"),
    shift: text("shift"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("students_school_name_uq").on(t.schoolId, t.normalizedName),
    index("students_school_idx").on(t.schoolId),
  ],
);

export const studentEnrollments = pgTable(
  "student_enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    academicYear: integer("academic_year").notNull().default(2026),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("enrollment_student_class_year_uq").on(t.studentId, t.classId, t.academicYear),
    index("enrollment_class_idx").on(t.classId),
  ],
);

/* =========================================================================
 * IDENTIDADE
 * ========================================================================= */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    role: userRole("role").notNull(),
    fullName: text("full_name").notNull(),
    email: text("email"),
    username: text("username"),
    passwordHash: text("password_hash").notNull(),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "set null" }),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }),
    active: boolean("active").notNull().default(true),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("profiles_email_uq").on(t.email),
    uniqueIndex("profiles_student_uq").on(t.studentId),
  ],
);

/** vínculos de gestores/professores com escolas e turmas */
export const staffSchools = pgTable(
  "staff_schools",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("staff_school_uq").on(t.profileId, t.schoolId)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("sessions_token_uq").on(t.tokenHash)],
);

/* =========================================================================
 * CURRÍCULO / BNCC
 * ========================================================================= */
export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("subjects_code_uq").on(t.code)],
);

export const bnccSkills = pgTable(
  "bncc_skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(), // ex: EF01MA01
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    gradeYear: integer("grade_year").notNull(),
    thematicUnit: text("thematic_unit"), // unidade temática / campo de atuação / prática de linguagem
    knowledgeObject: text("knowledge_object"),
    description: text("description").notNull(),
  },
  (t) => [
    uniqueIndex("bncc_code_uq").on(t.code),
    index("bncc_grade_subject_idx").on(t.gradeYear, t.subjectId),
  ],
);

/* =========================================================================
 * BANCO DE QUESTÕES
 * ========================================================================= */
export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    gradeYear: integer("grade_year").notNull(),
    type: questionType("type").notNull(),
    statement: text("statement").notNull(),
    supportText: text("support_text"),
    correctionCriteria: text("correction_criteria"),
    answerKeyText: text("answer_key_text"), // resposta curta esperada
    points: numeric("points", { precision: 6, scale: 2 }).notNull().default("1.00"),
    difficulty: difficulty("difficulty").notNull().default("medio"),
    reviewStatus: reviewStatus("review_status").notNull().default("rascunho"),
    authorId: uuid("author_id").references(() => profiles.id, { onDelete: "set null" }),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("questions_grade_subject_idx").on(t.gradeYear, t.subjectId)],
);

export const questionOptions = pgTable(
  "question_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    label: text("label").notNull(), // A, B, C...
    content: text("content").notNull(),
    isCorrect: boolean("is_correct").notNull().default(false),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("question_options_q_idx").on(t.questionId)],
);

export const questionSkills = pgTable(
  "question_skills",
  {
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => bnccSkills.id, { onDelete: "restrict" }),
    validated: boolean("validated").notNull().default(false),
  },
  (t) => [uniqueIndex("question_skill_uq").on(t.questionId, t.skillId)],
);

/* =========================================================================
 * AVALIAÇÕES
 * ========================================================================= */
export const assessments = pgTable(
  "assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    classId: uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    gradeYear: integer("grade_year").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(50),
    availableFrom: timestamp("available_from", { withTimezone: true }),
    availableUntil: timestamp("available_until", { withTimezone: true }),
    maxAttempts: integer("max_attempts").notNull().default(1),
    status: assessmentStatus("status").notNull().default("rascunho"),
    releaseResults: boolean("release_results").notNull().default(false),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("assessments_school_idx").on(t.schoolId)],
);

export const assessmentQuestions = pgTable(
  "assessment_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    position: integer("position").notNull().default(0),
    points: numeric("points", { precision: 6, scale: 2 }).notNull().default("1.00"),
  },
  (t) => [uniqueIndex("assessment_question_uq").on(t.assessmentId, t.questionId)],
);

export const assessmentAssignments = pgTable(
  "assessment_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    classId: uuid("class_id").references(() => classes.id, { onDelete: "cascade" }),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("assignments_assessment_idx").on(t.assessmentId)],
);

export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull().default(1),
    status: attemptStatus("status").notNull().default("em_andamento"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    lastSavedAt: timestamp("last_saved_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    autoScore: numeric("auto_score", { precision: 7, scale: 2 }).notNull().default("0.00"),
    manualScore: numeric("manual_score", { precision: 7, scale: 2 }).notNull().default("0.00"),
    totalScore: numeric("total_score", { precision: 7, scale: 2 }).notNull().default("0.00"),
    maxScore: numeric("max_score", { precision: 7, scale: 2 }).notNull().default("0.00"),
  },
  (t) => [
    uniqueIndex("attempt_unique").on(t.assessmentId, t.studentId, t.attemptNumber),
    index("attempt_assessment_idx").on(t.assessmentId),
  ],
);

export const answers = pgTable(
  "answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    selectedOptionId: uuid("selected_option_id").references(() => questionOptions.id, {
      onDelete: "set null",
    }),
    booleanValue: boolean("boolean_value"),
    textValue: text("text_value"),
    isBlank: boolean("is_blank").notNull().default(true),
    score: numeric("score", { precision: 6, scale: 2 }),
    maxScore: numeric("max_score", { precision: 6, scale: 2 }).notNull().default("1.00"),
    gradingStatus: gradingStatus("grading_status").notNull().default("pendente"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("answer_attempt_question_uq").on(t.attemptId, t.questionId)],
);

export const gradingRecords = pgTable("grading_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  answerId: uuid("answer_id")
    .notNull()
    .references(() => answers.id, { onDelete: "cascade" }),
  graderId: uuid("grader_id").references(() => profiles.id, { onDelete: "set null" }),
  previousScore: numeric("previous_score", { precision: 6, scale: 2 }),
  newScore: numeric("new_score", { precision: 6, scale: 2 }).notNull(),
  feedback: text("feedback"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => profiles.id, { onDelete: "set null" }),
    actorRole: text("actor_role"),
    action: text("action").notNull(),
    entity: text("entity"),
    entityId: text("entity_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);

export const importBatches = pgTable("import_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id").references(() => profiles.id, { onDelete: "set null" }),
  fileName: text("file_name"),
  inserted: integer("inserted").notNull().default(0),
  updated: integer("updated").notNull().default(0),
  rejected: integer("rejected").notNull().default(0),
  report: jsonb("report"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
