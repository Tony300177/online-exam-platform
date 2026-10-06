require("dotenv").config();
const XLSX = require("xlsx");
const pg = require("pg");
const bcrypt = require("bcryptjs");

function normalizeName(v) {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}
function slugify(v) {
  return normalizeName(v).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function parseGradeYear(value) {
  if (!value) return null;
  const m = value.match(/\d+/);
  if (m) { const n = Number(m[0]); return n >= 1 && n <= 9 ? n : null; }
  const v = normalizeName(value);
  if (v.includes("PRE") || v.includes("MATERNAL") || v.includes("JARDIM") || v.includes("BERCARIO") || v.includes("BERÇÁRIO")) return 0;
  return null;
}

(async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const wb = XLSX.readFile("planilha-organizada-importacao.xlsx");
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  console.log("linhas:", rows.length);

  const schoolMap = new Map();
  const classMap = new Map();
  const defaultHash = bcrypt.hashSync("123456", 10);

  const schools = new Map();
  const classes = new Map();
  for (const row of rows) {
    const school = (row["ESCOLA"] || "").trim();
    const className = (row["NOME DA TURMA"] || "").trim();
    const shift = (row["TURNO"] || "").trim();
    const rawGrade = (row["ANO/SÉRIE"] || "").trim() || className;
    const gradeYear = parseGradeYear(rawGrade);
    if (school && !schools.has(normalizeName(school))) schools.set(normalizeName(school), { name: school, slug: slugify(school) });
    if (school && className) {
      const key = `${normalizeName(school)}|${normalizeName(className)}`;
      if (!classes.has(key)) classes.set(key, { schoolName: school, name: className, gradeYear: gradeYear ?? 0, shift });
    }
  }
  console.log("escolas:", schools.size, "| turmas:", classes.size);

  for (const [norm, s] of schools) {
    const found = (await pool.query("select id from schools where slug = $1", [s.slug])).rows[0];
    if (found) schoolMap.set(norm, found.id);
    else { const r = await pool.query("insert into schools (name, slug) values ($1, $2) returning id", [s.name, s.slug]); schoolMap.set(norm, r.rows[0].id); }
  }

  for (const [key, c] of classes) {
    const schoolId = schoolMap.get(normalizeName(c.schoolName));
    if (!schoolId) continue;
    const found = (await pool.query("select id from classes where school_id = $1 and name = $2 and academic_year = 2026", [schoolId, c.name])).rows[0];
    if (found) classMap.set(key, found.id);
    else { const r = await pool.query("insert into classes (school_id, name, grade_year, shift, academic_year) values ($1, $2, $3, $4, 2026) returning id", [schoolId, c.name, c.gradeYear, c.shift || null]); classMap.set(key, r.rows[0].id); }
  }
  console.log("escolas:", schoolMap.size, "| turmas:", classMap.size);

  const students = [];
  for (const row of rows) {
    const school = (row["ESCOLA"] || "").trim();
    const className = (row["NOME DA TURMA"] || "").trim();
    const studentName = (row["NOME"] || "").trim();
    const rawGrade = (row["ANO/SÉRIE"] || "").trim() || className;
    const sex = (row["SEXO"] || "").trim();
    const birthDate = (row["DATA NASCIMENTO"] || "").trim();
    const race = (row["RAÇA"] || "").trim();
    const neighborhood = (row["BAIRRO"] || "").trim();
    const gradeYear = parseGradeYear(rawGrade);
    if (!school || !className || !studentName) continue;
    if (studentName.split(" ").filter(Boolean).length < 2) continue;
    const schoolId = schoolMap.get(normalizeName(school));
    const classKey = `${normalizeName(school)}|${normalizeName(className)}`;
    const classId = classMap.get(classKey);
    if (!schoolId || !classId) continue;
    students.push({ schoolId, classId, studentName, normalized: normalizeName(studentName), sex: sex || null, birthDate: birthDate || null, race: race || null, neighborhood: neighborhood || null });
  }
  console.log("alunos válidos:", students.length);

  let inserted = 0, updated = 0;
  const BATCH = 500;
  for (let i = 0; i < students.length; i += BATCH) {
    const batch = students.slice(i, i + BATCH);
    for (const s of batch) {
      const existing = (await pool.query("select id from students where school_id = $1 and normalized_name = $2", [s.schoolId, s.normalized])).rows[0];
      let studentId;
      if (existing) {
        studentId = existing.id;
        await pool.query("update students set full_name = $1, sex = $2, birth_date = $3, race = $4, neighborhood = $5, active = true where id = $6", [s.studentName, s.sex, s.birthDate, s.race, s.neighborhood, studentId]);
        updated++;
      } else {
        const r = await pool.query("insert into students (school_id, full_name, normalized_name, sex, birth_date, race, neighborhood) values ($1, $2, $3, $4, $5, $6, $7) returning id", [s.schoolId, s.studentName, s.normalized, s.sex, s.birthDate, s.race, s.neighborhood]);
        studentId = r.rows[0].id;
        inserted++;
      }
      await pool.query("insert into student_enrollments (student_id, class_id, academic_year) values ($1, $2, 2026) on conflict do nothing", [studentId, s.classId]);
      await pool.query("insert into profiles (role, full_name, password_hash, school_id, student_id, must_change_password) values ('student', $1, $2, $3, $4, true) on conflict do nothing", [s.studentName, defaultHash, s.schoolId, studentId]);
    }
    console.log(`progresso: ${Math.min(i + BATCH, students.length)}/${students.length} | inseridos: ${inserted} | atualizados: ${updated}`);
  }

  const s = await pool.query("select count(*)::int c from students");
  console.log(`\nTOTAL students no banco: ${s.rows[0].c}`);
  await pool.end();
})();
