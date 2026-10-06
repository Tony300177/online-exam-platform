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
  if (m) {
    const n = Number(m[0]);
    return n >= 1 && n <= 9 ? n : null;
  }
  const v = normalizeName(value);
  if (v.includes("PRE I") || v.includes("MATERNAL")) return 0;
  if (v.includes("PRE II") || v.includes("JARDIM")) return 0;
  return null;
}

(async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const wb = XLSX.readFile("planilha-organizada-importacao.xlsx");
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  console.log("linhas na planilha:", rows.length);

  const schoolCache = new Map();
  const classCache = new Map();
  const defaultHash = bcrypt.hashSync("123456", 10);
  let inserted = 0, updated = 0, rejected = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const line = i + 2;
    const school = (row["ESCOLA"] || "").trim();
    const className = (row["NOME DA TURMA"] || "").trim();
    const studentName = (row["NOME"] || "").trim();
    const rawGrade = (row["ANO/SÉRIE"] || "").trim() || className;
    const sex = (row["SEXO"] || "").trim();
    const birthDate = (row["DATA NASCIMENTO"] || "").trim();
    const race = (row["RAÇA"] || "").trim();
    const neighborhood = (row["BAIRRO"] || "").trim();
    const shift = (row["TURNO"] || "").trim();

    if (!school || !className || !studentName) { rejected++; errors.push(`linha ${line}: dados incompletos`); continue; }
    const gradeYear = parseGradeYear(rawGrade);
    if (gradeYear === null) { rejected++; errors.push(`linha ${line}: ano/série não identificado: ${rawGrade}`); continue; }
    if (studentName.split(" ").filter(Boolean).length < 2) { rejected++; errors.push(`linha ${line}: nome incompleto: ${studentName}`); continue; }

    try {
      // school
      const sKey = normalizeName(school);
      let schoolId = schoolCache.get(sKey);
      if (!schoolId) {
        const slug = slugify(school);
        const found = (await pool.query("select id from schools where slug = $1", [slug])).rows[0];
        if (found) schoolId = found.id;
        else {
          const r = await pool.query("insert into schools (name, slug) values ($1, $2) returning id", [school, slug]);
          schoolId = r.rows[0].id;
        }
        schoolCache.set(sKey, schoolId);
      }

      // class
      const cKey = `${schoolId}|${normalizeName(className)}`;
      let classId = classCache.get(cKey);
      if (!classId) {
        const found = (await pool.query("select id from classes where school_id = $1 and name = $2 and academic_year = 2026", [schoolId, className])).rows[0];
        if (found) classId = found.id;
        else {
          const r = await pool.query("insert into classes (school_id, name, grade_year, shift, academic_year) values ($1, $2, $3, $4, 2026) returning id", [schoolId, className, gradeYear, shift || null]);
          classId = r.rows[0].id;
        }
        classCache.set(cKey, classId);
      }

      // student
      const normalized = normalizeName(studentName);
      const existing = (await pool.query("select id from students where school_id = $1 and normalized_name = $2", [schoolId, normalized])).rows[0];
      let studentId;
      if (existing) {
        studentId = existing.id;
        await pool.query("update students set full_name = $1, sex = $2, birth_date = $3, race = $4, neighborhood = $5, active = true where id = $6", [studentName, sex || null, birthDate || null, race || null, neighborhood || null, studentId]);
        updated++;
      } else {
        const r = await pool.query("insert into students (school_id, full_name, normalized_name, sex, birth_date, race, neighborhood) values ($1, $2, $3, $4, $5, $6, $7) returning id", [schoolId, studentName, normalized, sex || null, birthDate || null, race || null, neighborhood || null]);
        studentId = r.rows[0].id;
        inserted++;
      }

      await pool.query("insert into student_enrollments (student_id, class_id, academic_year) values ($1, $2, 2026) on conflict do nothing", [studentId, classId]);
      await pool.query("insert into profiles (role, full_name, password_hash, school_id, student_id, must_change_password) values ('student', $1, $2, $3, $4, true) on conflict do nothing", [studentName, defaultHash, schoolId, studentId]);
    } catch (e) {
      rejected++;
      errors.push(`linha ${line}: ${e.message}`);
    }
  }

  console.log(`\ninseridos: ${inserted}`);
  console.log(`atualizados: ${updated}`);
  console.log(`rejeitados: ${rejected}`);
  if (errors.length) console.log(`erros (primeiros 10):\n  ${errors.slice(0, 10).join("\n  ")}`);

  const s = await pool.query("select count(*)::int c from students");
  console.log(`\ntotal students no banco: ${s.rows[0].c}`);
  await pool.end();
})();
