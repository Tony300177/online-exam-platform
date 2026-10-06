import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { students, studentEnrollments, classes } from "@/db/schema";
import { errorResponse, HttpError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const schoolId = url.searchParams.get("schoolId");
    const classId = url.searchParams.get("classId");
    if (!schoolId || !classId) throw new HttpError(400, "Informe escola e turma.");

    const rows = await db
      .select({ id: students.id, fullName: students.fullName })
      .from(students)
      .innerJoin(studentEnrollments, eq(studentEnrollments.studentId, students.id))
      .where(
        and(
          eq(students.schoolId, schoolId),
          eq(studentEnrollments.classId, classId),
          eq(studentEnrollments.active, true),
        ),
      )
      .orderBy(asc(students.fullName));

    return Response.json({ students: rows });
  } catch (e) {
    return errorResponse(e);
  }
}