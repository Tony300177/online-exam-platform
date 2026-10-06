// One-off: full backup of legacy tables before the schema reset.
// Writes JSON outside the repo (temp dir) so real data is never committed.
import "dotenv/config";
import { writeFileSync } from "node:fs";
import pg from "pg";

const OUT =
  process.argv[2] ?? "C:/Users/DELL/AppData/Local/Temp/opencode/legacy-schools-backup.json";

const TABLES = [
  "schools",
  "profiles",
  "audit_log",
  "admin_access_log",
  "student_credentials",
  "classes",
  "students",
];

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const dump = {};
for (const t of TABLES) {
  const { rows } = await pool.query(`select * from "${t}"`).catch(() => ({ rows: [] }));
  dump[t] = rows;
  console.log(`${String(rows.length).padStart(4)}  ${t}`);
}
writeFileSync(OUT, JSON.stringify(dump, null, 2), "utf8");
console.log(`\nbackup -> ${OUT}`);
await pool.end();