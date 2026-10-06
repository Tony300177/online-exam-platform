require("dotenv").config();
const fs = require("fs");
const pg = require("pg");
(async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const dump = JSON.parse(fs.readFileSync("C:/Users/DELL/AppData/Local/Temp/opencode/legacy-schools-backup.json", "utf8"));
  const legacy = dump.schools ?? [];
  let updated = 0;
  for (const s of legacy) {
    if (!s.code) continue;
    const r = await pool.query("update schools set code = $1 where slug = $2", [s.code, s.name_key ? slugify(s.name_key) : null]);
    if (r.rowCount > 0) updated++;
  }
  function slugify(v) {
    return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  const check = await pool.query("select count(*)::int c from schools where code is not null");
  console.log(`atualizadas: ${updated} | schools com code: ${check.rows[0].c}`);
  await pool.end();
})();
