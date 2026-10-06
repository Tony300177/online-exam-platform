import { errorResponse, HttpError, requireUser } from "@/lib/auth";
import { guessMapping, parseWorkbook, validateRows, type Mapping } from "@/lib/import";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    await requireUser(["admin", "manager"]);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "Envie um arquivo XLSX ou CSV.");
    if (file.size > 8 * 1024 * 1024) throw new HttpError(400, "Arquivo maior que 8 MB.");

    const sheets = parseWorkbook(await file.arrayBuffer(), file.name);
    if (!sheets.length) throw new HttpError(400, "Não foi possível ler nenhuma aba da planilha.");

    const sheetName = String(form.get("sheet") ?? "") || sheets[0].name;
    const sheet = sheets.find((s) => s.name === sheetName) ?? sheets[0];

    const mappingRaw = form.get("mapping");
    const mapping: Mapping | null = mappingRaw ? (JSON.parse(String(mappingRaw)) as Mapping) : null;
    const effective = mapping ?? ({ ...guessMapping(sheet.headers) } as Mapping);

    let preview: ReturnType<typeof validateRows> | null = null;
    if (effective.school && effective.className && effective.studentName) {
      preview = validateRows(sheet.rows, { ...effective, gradeYear: effective.gradeYear ?? "" });
    }

    return Response.json({
      sheets: sheets.map((s) => ({ name: s.name, headers: s.headers, totalRows: s.rows.length })),
      sheet: sheet.name,
      headers: sheet.headers,
      suggestedMapping: effective,
      sample: sheet.rows.slice(0, 15),
      validation: preview
        ? {
            validCount: preview.valid.length,
            issues: preview.issues.slice(0, 100),
            issuesTotal: preview.issues.length,
            validSample: preview.valid.slice(0, 15),
          }
        : null,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
