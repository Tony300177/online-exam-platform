import { asc } from "drizzle-orm";
import { db } from "@/db";
import { schools } from "@/db/schema";
import { errorResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db
      .select({ id: schools.id, name: schools.name })
      .from(schools)
      .orderBy(asc(schools.name));
    return Response.json({ schools: rows });
  } catch (e) {
    return errorResponse(e);
  }
}
