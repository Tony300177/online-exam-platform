import "dotenv/config";
import pg from "pg";
import bcrypt from "bcryptjs";
import { BNCC, SUBJECTS } from "./bncc.mjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const q = (text, params) => pool.query(text, params);
const norm = (s) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();

async function main() {
  // ---------- subjects ----------
  for (const [code, name] of SUBJECTS) {
    await q(
      `insert into subjects (code, name) values ($1,$2)
       on conflict (code) do update set name = excluded.name`,
      [code, name],
    );
  }
  const subjRows = (await q(`select id, code from subjects`)).rows;
  const subj = Object.fromEntries(subjRows.map((r) => [r.code, r.id]));

  // ---------- BNCC ----------
  for (const [code, sub, grade, unit, object, desc] of BNCC) {
    await q(
      `insert into bncc_skills (code, subject_id, grade_year, thematic_unit, knowledge_object, description)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (code) do update set description = excluded.description,
         thematic_unit = excluded.thematic_unit, knowledge_object = excluded.knowledge_object`,
      [code, subj[sub], grade, unit, object, desc],
    );
  }

  // ---------- schools / classes ----------
  const schoolsData = [
    ["Escola Municipal Modelo", "escola-municipal-modelo", "São Paulo", "Municipal"],
    ["Escola Municipal Vila Nova", "escola-municipal-vila-nova", "São Paulo", "Municipal"],
  ];
  const schoolIds = {};
  for (const [name, slug, city, network] of schoolsData) {
    const r = await q(
      `insert into schools (name, slug, city, network) values ($1,$2,$3,$4)
       on conflict (slug) do update set name = excluded.name returning id`,
      [name, slug, city, network],
    );
    schoolIds[slug] = r.rows[0].id;
  }

  const classIds = {};
  for (const slug of Object.keys(schoolIds)) {
    for (let grade = 1; grade <= 5; grade++) {
      for (const letter of ["A", "B"]) {
        const name = `${grade}º ano ${letter}`;
        const r = await q(
          `insert into classes (school_id, name, grade_year, shift, academic_year)
           values ($1,$2,$3,'Manhã',2026)
           on conflict (school_id, name, academic_year) do update set grade_year = excluded.grade_year
           returning id`,
          [schoolIds[slug], name, grade],
        );
        classIds[`${slug}|${name}`] = r.rows[0].id;
      }
    }
  }

  // ---------- staff ----------
  const hash = (p) => bcrypt.hashSync(p, 10);
  async function upsertStaff(role, fullName, email, password, schoolId, link) {
    const r = await q(
      `insert into profiles (role, full_name, email, password_hash, school_id, must_change_password)
       values ($1,$2,$3,$4,$5,false)
       on conflict (email) do update set full_name = excluded.full_name, role = excluded.role
       returning id`,
      [role, fullName, email, hash(password), schoolId],
    );
    const id = r.rows[0].id;
    for (const s of link ?? []) {
      await q(
        `insert into staff_schools (profile_id, school_id) values ($1,$2) on conflict do nothing`,
        [id, s],
      );
    }
    return id;
  }

  const allSchools = Object.values(schoolIds);
  await upsertStaff("admin", "Administrador da Plataforma", "admin@plataforma.edu", "Admin@123", null, []);
  await upsertStaff("manager", "Coordenação Escola Modelo", "gestor@plataforma.edu", "Gestor@123",
    schoolIds["escola-municipal-modelo"], [schoolIds["escola-municipal-modelo"]]);
  const teacherId = await upsertStaff("teacher", "Professora Ana Souza", "professor@plataforma.edu",
    "Prof@123", schoolIds["escola-municipal-modelo"], allSchools);

  // ---------- alunos de demonstração ----------
  const demoClasses = [
    ["escola-municipal-modelo", "5º ano A", 18],
    ["escola-municipal-modelo", "4º ano A", 10],
    ["escola-municipal-modelo", "1º ano A", 8],
    ["escola-municipal-vila-nova", "5º ano A", 10],
  ];
  const studentsByClass = {};
  for (const [slug, className, count] of demoClasses) {
    studentsByClass[`${slug}|${className}`] = [];
    for (let i = 1; i <= count; i++) {
      const fullName = `Aluno Demonstracao ${className.replace(/\D/g, "")}${String(i).padStart(2, "0")} ${slug === "escola-municipal-modelo" ? "Modelo" : "Vila Nova"}`;
      const st = await q(
        `insert into students (school_id, full_name, normalized_name, registration)
         values ($1,$2,$3,$4)
         on conflict (school_id, normalized_name) do update set full_name = excluded.full_name
         returning id`,
        [schoolIds[slug], fullName, norm(fullName), `DEMO-${className.replace(/\D/g, "")}-${i}`],
      );
      const studentId = st.rows[0].id;
      await q(
        `insert into student_enrollments (student_id, class_id, academic_year)
         values ($1,$2,2026) on conflict do nothing`,
        [studentId, classIds[`${slug}|${className}`]],
      );
      await q(
        `insert into profiles (role, full_name, password_hash, school_id, student_id, must_change_password)
         values ('student',$1,$2,$3,$4,true)
         on conflict (student_id) do nothing`,
        [fullName, hash("123456"), schoolIds[slug], studentId],
      );
      studentsByClass[`${slug}|${className}`].push(studentId);
    }
  }

  // ---------- banco de questões (5º ano) ----------
  const skillRows = (await q(`select id, code from bncc_skills`)).rows;
  const skill = Object.fromEntries(skillRows.map((r) => [r.code, r.id]));

  const questionSeed = [
    {
      code: "Q-MAT5-01", subject: "MAT", grade: 5, type: "multiple_choice", skill: "EF05MA01",
      statement: "Qual é o número que se lê 'cento e vinte e três mil, quatrocentos e cinquenta'?",
      options: [["A", "12.345", false], ["B", "123.450", true], ["C", "1.234.500", false], ["D", "123.045", false]],
    },
    {
      code: "Q-MAT5-02", subject: "MAT", grade: 5, type: "multiple_choice", skill: "EF05MA03",
      statement: "Marina dividiu uma pizza em 8 fatias iguais e comeu 3 fatias. Que fração representa o que ela comeu?",
      options: [["A", "3/8", true], ["B", "8/3", false], ["C", "1/3", false], ["D", "5/8", false]],
    },
    {
      code: "Q-MAT5-03", subject: "MAT", grade: 5, type: "multiple_choice", skill: "EF05MA07",
      statement: "João tinha R$ 25,50 e gastou R$ 13,75. Quanto sobrou?",
      options: [["A", "R$ 11,75", true], ["B", "R$ 12,25", false], ["C", "R$ 39,25", false], ["D", "R$ 10,75", false]],
    },
    {
      code: "Q-MAT5-04", subject: "MAT", grade: 5, type: "true_false", skill: "EF05MA02",
      statement: "O número 0,7 é maior que o número 0,25.", answerKey: "true",
    },
    {
      code: "Q-MAT5-05", subject: "MAT", grade: 5, type: "short_answer", skill: "EF05MA08",
      statement: "Calcule: 4,5 x 3 = ?", answerKeyText: "13,5",
      criteria: "Aceitar 13,5 ou 13.5.",
    },
    {
      code: "Q-LP5-01", subject: "LP", grade: 5, type: "multiple_choice", skill: "EF35LP03",
      support: "O sabiá-laranjeira é o pássaro símbolo do Brasil. Ele é conhecido pelo canto melodioso, que anuncia a chegada da primavera nos campos e quintais brasileiros.",
      statement: "Qual é a ideia central do texto?",
      options: [
        ["A", "A primavera é a estação mais quente do ano.", false],
        ["B", "O sabiá-laranjeira é o pássaro símbolo do Brasil e tem canto melodioso.", true],
        ["C", "Os quintais brasileiros têm muitas árvores.", false],
        ["D", "Os pássaros migram no inverno.", false],
      ],
    },
    {
      code: "Q-LP5-02", subject: "LP", grade: 5, type: "multiple_choice", skill: "EF35LP05",
      support: "Depois da longa caminhada, Pedro estava exausto e dormiu profundamente.",
      statement: "No texto, a palavra 'exausto' significa:",
      options: [["A", "Muito cansado", true], ["B", "Muito alegre", false], ["C", "Com fome", false], ["D", "Com medo", false]],
    },
    {
      code: "Q-LP5-03", subject: "LP", grade: 5, type: "multiple_choice", skill: "EF05LP08",
      statement: "Qual das palavras abaixo é formada por derivação com sufixo?",
      options: [["A", "Pedra", false], ["B", "Pedreiro", true], ["C", "Guarda-chuva", false], ["D", "Flor", false]],
    },
    {
      code: "Q-LP5-04", subject: "LP", grade: 5, type: "open_answer", skill: "EF35LP04",
      support: "Ao chegar em casa, Bia encontrou a porta aberta e o guarda-chuva molhado na entrada.",
      statement: "Escreva o que podemos concluir sobre o que aconteceu antes de Bia chegar em casa. Justifique com pistas do texto.",
      criteria: "1,0 ponto: infere que alguém chegou antes e que estava chovendo, citando pistas. 0,5: infere parcialmente. 0: não responde ou não usa pistas.",
    },
  ];

  const questionIds = {};
  for (const item of questionSeed) {
    const exists = await q(`select id from questions where statement = $1 limit 1`, [item.statement]);
    let id;
    if (exists.rows[0]) {
      id = exists.rows[0].id;
    } else {
      const r = await q(
        `insert into questions (subject_id, grade_year, type, statement, support_text, correction_criteria,
            answer_key_text, points, difficulty, review_status, author_id)
         values ($1,$2,$3,$4,$5,$6,$7,'1.00','medio','aprovada',$8) returning id`,
        [subj[item.subject], item.grade, item.type, item.statement, item.support ?? null,
          item.criteria ?? null, item.answerKeyText ?? null, teacherId],
      );
      id = r.rows[0].id;
      if (item.options) {
        let pos = 0;
        for (const [label, content, correct] of item.options) {
          await q(
            `insert into question_options (question_id, label, content, is_correct, position)
             values ($1,$2,$3,$4,$5)`,
            [id, label, content, correct, pos++],
          );
        }
      }
      if (item.type === "true_false") {
        await q(
          `insert into question_options (question_id, label, content, is_correct, position) values
           ($1,'V','Verdadeiro',$2,0), ($1,'F','Falso',$3,1)`,
          [id, item.answerKey === "true", item.answerKey !== "true"],
        );
      }
      await q(
        `insert into question_skills (question_id, skill_id, validated) values ($1,$2,true)
         on conflict do nothing`,
        [id, skill[item.skill]],
      );
    }
    questionIds[item.code] = id;
  }

  // ---------- avaliação publicada + tentativas de demonstração ----------
  const exists = await q(`select id from assessments where title = $1 limit 1`, [
    "Diagnóstica 1 - 5º ano (Matemática e Língua Portuguesa)",
  ]);
  if (!exists.rows[0]) {
    const classId = classIds["escola-municipal-modelo|5º ano A"];
    const a = await q(
      `insert into assessments (title, description, school_id, class_id, subject_id, grade_year,
         duration_minutes, available_from, available_until, max_attempts, status, release_results, created_by)
       values ($1,$2,$3,$4,$5,5,60, now() - interval '2 days', now() + interval '30 days', 1,
         'publicada', true, $6) returning id`,
      ["Diagnóstica 1 - 5º ano (Matemática e Língua Portuguesa)",
        "Avaliação diagnóstica inicial com habilidades de Matemática e Língua Portuguesa.",
        schoolIds["escola-municipal-modelo"], classId, subj["MAT"], teacherId],
    );
    const assessmentId = a.rows[0].id;
    let pos = 0;
    for (const code of Object.keys(questionIds)) {
      await q(
        `insert into assessment_questions (assessment_id, question_id, position, points)
         values ($1,$2,$3,'1.00')`,
        [assessmentId, questionIds[code], pos++],
      );
    }
    await q(`insert into assessment_assignments (assessment_id, class_id) values ($1,$2)`, [
      assessmentId, classId,
    ]);

    const aq = (await q(
      `select aq.question_id, aq.points, q.type from assessment_questions aq
       join questions q on q.id = aq.question_id where aq.assessment_id = $1`,
      [assessmentId],
    )).rows;
    const optionsByQ = {};
    for (const row of (await q(`select id, question_id, is_correct from question_options`)).rows) {
      (optionsByQ[row.question_id] ??= []).push(row);
    }

    const studentList = studentsByClass["escola-municipal-modelo|5º ano A"].slice(0, 14);
    let seedRand = 7;
    const rand = () => ((seedRand = (seedRand * 1103515245 + 12345) % 2147483648) / 2147483648);

    for (const studentId of studentList) {
      const at = await q(
        `insert into attempts (assessment_id, student_id, attempt_number, status, started_at,
           submitted_at, max_score) values ($1,$2,1,'corrigida', now() - interval '1 day',
           now() - interval '1 day', $3) returning id`,
        [assessmentId, studentId, String(aq.length)],
      );
      const attemptId = at.rows[0].id;
      let auto = 0, manual = 0;
      for (const item of aq) {
        const opts = optionsByQ[item.question_id] ?? [];
        if (item.type === "multiple_choice" || item.type === "true_false") {
          const blank = rand() < 0.06;
          if (blank) {
            await q(
              `insert into answers (attempt_id, question_id, is_blank, score, max_score, grading_status)
               values ($1,$2,true,'0.00',$3,'automatica')`,
              [attemptId, item.question_id, item.points],
            );
            continue;
          }
          const correct = rand() < 0.62;
          const chosen = correct
            ? opts.find((o) => o.is_correct)
            : opts.filter((o) => !o.is_correct)[Math.floor(rand() * Math.max(1, opts.length - 1))];
          const score = chosen && chosen.is_correct ? Number(item.points) : 0;
          auto += score;
          await q(
            `insert into answers (attempt_id, question_id, selected_option_id, is_blank, score, max_score, grading_status)
             values ($1,$2,$3,false,$4,$5,'automatica')`,
            [attemptId, item.question_id, chosen?.id ?? null, score.toFixed(2), item.points],
          );
        } else if (item.type === "short_answer") {
          const correct = rand() < 0.5;
          const score = correct ? Number(item.points) : 0;
          auto += score;
          await q(
            `insert into answers (attempt_id, question_id, text_value, is_blank, score, max_score, grading_status)
             values ($1,$2,$3,false,$4,$5,'automatica')`,
            [attemptId, item.question_id, correct ? "13,5" : "12", score.toFixed(2), item.points],
          );
        } else {
          const score = Math.round(rand() * 2) / 2;
          manual += score;
          await q(
            `insert into answers (attempt_id, question_id, text_value, is_blank, score, max_score, grading_status)
             values ($1,$2,$3,false,$4,$5,'corrigida')`,
            [attemptId, item.question_id, "Acho que estava chovendo e alguem chegou antes.",
              score.toFixed(2), item.points],
          );
        }
      }
      await q(
        `update attempts set auto_score=$2, manual_score=$3, total_score=$4 where id=$1`,
        [attemptId, auto.toFixed(2), manual.toFixed(2), (auto + manual).toFixed(2)],
      );
    }
  }

  console.log("Seed concluído.");
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
