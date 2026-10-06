// One-off: re-import the 18 real schools that were backed up before the legacy
// schema was dropped. Column mapping (legacy -> new):
//   name        -> name
//   name_key    -> (used as slug source, same as the app's slugify())
//   code        -> NOT MAPPED: the target `schools` table has no code column.
//                 The values are preserved in the backup JSON.
//   school_type -> network  (was null on every row)
//   status      -> (not mapped)
//   created_at  -> created_at
//
// Idempotent: keyed on slug, so re-running updates instead of duplicating.
import "dotenv/config";
import { readFileSync } from "node:fs";
import pg from "pg";

const BACKUP =
  process.argv[2] ?? "C:/Users/DELL/AppData/Local/Temp/opencode/legacy-schools-backup.json";

// Mirrors slugify() in src/lib/actions.ts
function slugify(v) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const dump = JSON.parse(readFileSync(BACKUP, "utf8"));
const legacy = dump.schools ?? [];

let inserted = 0;
let updated = 0;
const unmapped = [];

for (const s of legacy) {
  let slug = slugify(s.name);
  if (!slug) continue;

  // Guarantee slug uniqueness (schools_slug_uq) by suffixing on collision.
  const clash = await pool.query("select 1 from schools where slug = $1", [slug]);
  if (clash.rowCount > 0) {
    const base = slug;
    let n = 2;
    for (;;) {
      const candidate = `${base}-${n}`;
      const c = await pool.query("select 1 from schools where slug = $1", [candidate]);
      if (c.rowCount === 0) {
        slug = candidate;
        break;
      }
      n += 1;
    }
  }

  const existed = await pool.query("select id from schools where slug = $1", [slug]);
  const values = [
    s.name,
    slug,
    s.city ?? null,
    s.school_type ?? null,
    s.created_at ?? new Date(),
  ];

  if (existed.rowCount > 0) {
    await pool.query(
      `update schools set name=$1, city=$3, network=$4 where slug=$2`,
      values,
    );
    updated += 1;
  } else {
    await pool.query(
      `insert into schools (name, slug, city, network, created_at)
       values ($1,$2,$3,$4,$5)`,
      values,
    );
    inserted += 1;
  }

  if (s.code) unmapped.push({ name: s.name, code: s.code });
}

console.log(`inserted: ${inserted}  updated: ${updated}  total legacy: ${legacy.length}`);

if (unmapped.length) {
  console.log(`\n!! ${unmapped.length} legacy codes have no target column (kept in backup):`);
  for (const u of unmapped) console.log(`   ${u.code}  ${u.name}`);
}

const check = await pool.query("select count(*)::int c from schools");
console.log(`\nschools now in db: ${check.rows[0].c}`);
await pool.end();