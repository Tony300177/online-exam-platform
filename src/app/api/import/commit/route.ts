import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  importBatches,
  profiles,
  schools,
  studentEnrollments,
  students,
} from "@/db/schema";
import {
  allowedSchoolIds,
  audit,
  errorResponse,
  hashPassword,
  HttpError,
  requireUser,
} from "@/lib/auth";
import { normalizeName, parseWorkbook, validateRows, type Mapping, type RowIssue } from "@/lib/import";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function slugify(v: string) {
  return normalizeName(v).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(["admin", "manager"]);
    const allowed = await allowedSchoolIds(user);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "Arquivo ausente.");
    const mapping = JSON.parse(String(form.get("mapping") ?? "{}")) as Mapping;
    if (!mapping.school || !mapping.className || !mapping.studentName)
      throw new HttpError(400, "Mapeamento incompleto.");

    const sheets = parseWorkbook(await file.arrayBuffer(), file.name);
    const sheetName = String(form.get("sheet") ?? "") || sheets[0].name;
    const sheet = sheets.find((s) => s.name === sheetName);
    if (!sheet) throw new HttpError(400, "Aba não encontrada.");

    const { valid, issues } = validateRows(sheet.rows, mapping);
    const errors: RowIssue[] = [...issues];
    let inserted = 0;
    let updated = 0;
    let rejected = issues.filter((i) => i.level === "erro").length;

    const schoolCache = new Map<string, string>();
    const classCache = new Map<string, string>();
    const defaultHash = await hashPassword("123456");

    for (const row of valid) {
      try {
        // ---- escola (não duplica) ----
        const sKey = normalizeName(row.school);
        let schoolId = schoolCache.get(sKey);
        if (!schoolId) {
          const slug = slugify(row.school);
          const found = (await db.select().from(schools).where(eq(schools.slug, slug)).limit(1))[0];
          if (found) {
            schoolId = found.id;
          } else {
            if (user.role !== "admin") {
              errors.push({
                line: row.line,
                level: "erro",
                message: `Escola "${row.school}" não existe e seu perfil não pode criar escolas.`,
              });
              rejected++;
              continue;
            }
            const [created] = await db
              .insert(schools)
              .values({ name: row.school, slug })
              .returning({ id: schools.id });
            schoolId = created.id;
          }
          schoolCache.set(sKey, schoolId);
        }
        if (allowed !== null && !allowed.includes(schoolId)) {
          errors.push({
            line: row.line,
            level: "erro",
            message: `Sem permissão para importar alunos da escola "${row.school}".`,
          });
          rejected++;
          continue;
        }

        // ---- turma (não duplica) ----
        const cKey = `${schoolId}|${normalizeName(row.className)}`;
        let classId = classCache.get(cKey);
        if (!classId) {
          const found = (
            await db
              .select()
              .from(classes)
              .where(
                and(
                  eq(classes.schoolId, schoolId),
                  eq(classes.name, row.className),
                  eq(classes.academicYear, 2026),
                ),
              )
              .limit(1)
          )[0];
          if (found) {
            classId = found.id;
          } else {
            const [created] = await db
              .insert(classes)
              .values({
                schoolId,
                name: row.className,
                gradeYear: row.gradeYear,
                shift: row.shift || null,
                academicYear: 2026,
              })
              .returning({ id: classes.id });
            classId = created.id;
          }
          classCache.set(cKey, classId);
        }

        // ---- aluno ----
        const normalized = normalizeName(row.studentName);
        const existing = (
          await db
            .select()
            .from(students)
            .where(and(eq(students.schoolId, schoolId), eq(students.normalizedName, normalized)))
            .limit(1)
        )[0];

        let studentId: string;
        if (existing) {
          studentId = existing.id;
          await db
            .update(students)
            .set({
              fullName: row.studentName,
              registration: row.registration ?? existing.registration,
              birthDate: row.birthDate ?? existing.birthDate,
              sex: row.sex ?? existing.sex,
              race: row.race ?? existing.race,
              neighborhood: row.neighborhood ?? existing.neighborhood,
              active: true,
            })
            .where(eq(students.id, studentId));
          updated++;
        } else {
          const [created] = await db
            .insert(students)
            .values({
              schoolId,
              fullName: row.studentName,
              normalizedName: normalized,
              registration: row.registration,
              birthDate: row.birthDate,
              sex: row.sex,
              race: row.race,
              neighborhood: row.neighborhood,
            })
            .returning({ id: students.id });
          studentId = created.id;
          inserted++;
        }

        await db
          .insert(studentEnrollments)
          .values({ studentId, classId, academicYear: 2026 })
          .onConflictDoNothing();

        await db
          .insert(profiles)
          .values({
            role: "student",
            fullName: row.studentName,
            passwordHash: defaultHash,
            schoolId,
            studentId,
            mustChangePassword: true,
          })
          .onConflictDoNothing();
      } catch {
        rejected++;
        errors.push({ line: row.line, level: "erro", message: "Falha ao gravar o registro." });
      }
    }

    const [batch] = await db
      .insert(importBatches)
      .values({
        actorId: user.id,
        fileName: file.name,
        inserted,
        updated,
        rejected,
        report: { issues: errors.slice(0, 500) },
      })
      .returning({ id: importBatches.id });

    await audit(user, "students_imported", "import_batches", batch.id, {
      inserted,
      updated,
      rejected,
    });

    return Response.json({
      ok: true,
      inserted,
      updated,
      rejected,
      issues: errors.slice(0, 200),
      issuesTotal: errors.length,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
