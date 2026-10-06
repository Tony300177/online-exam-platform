import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes } from "@/db/schema";
import { errorResponse, HttpError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const schoolId = new URL(request.url).searchParams.get("schoolId");
    if (!schoolId) throw new HttpError(400, "Informe a escola.");
    const rows = await db
      .select({ id: classes.id, name: classes.name, gradeYear: classes.gradeYear })
      .from(classes)
      .where(and(eq(classes.schoolId, schoolId), eq(classes.academicYear, 2026)))
      .orderBy(asc(classes.gradeYear), asc(classes.name));
    return Response.json({ classes: rows });
  } catch (e) {
    return errorResponse(e);
  }
}
