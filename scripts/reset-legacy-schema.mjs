// One-off: drop the legacy (pre-Drizzle) schema so the new Drizzle schema can be
// created cleanly. The legacy tables use an incompatible shape (e.g. profiles has
// display_name instead of full_name) and share table names with the new schema,
// so they must be removed rather than migrated in place.
//
// Real data was already exported by backup-legacy-schools.mjs.
import "dotenv/config";
import pg from "pg";

const LEGACY_TABLES = [
  "admin_access_log",
  "answers",
  "applications",
  "assessment_classes",
  "assessment_questions",
  "assessments",
  "audit_log",
  "classes",
  "profiles",
  "question_answer_keys",
  "question_options",
  "questions",
  "schools",
  "student_credentials",
  "students",
];

const LEGACY_ENUMS = ["app_role", "application_status", "assessment_status"];

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const q = (sql, params) => pool.query(sql, params);

await q("drop schema if exists drizzle cascade");

for (const t of LEGACY_TABLES) {
  await q(`drop table if exists "${t}" cascade`).catch((e) => console.log(`  skip ${t}: ${e.code}`));
  console.log(`dropped table ${t}`);
}

// Enums last: dependents (columns) must be gone first.
for (const e of LEGACY_ENUMS) {
  await q(`drop type if exists "${e}" cascade`).catch((err) => console.log(`  skip ${e}: ${err.code}`));
  console.log(`dropped type ${e}`);
}

const left = await q(
  `select table_name from information_schema.tables where table_schema='public' order by 1`,
);
console.log(`\nremaining public tables: ${left.rows.map((r) => r.table_name).join(", ") || "(none)"}`);
await pool.end();