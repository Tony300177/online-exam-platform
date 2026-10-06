import { audit, errorResponse, requireUser } from "@/lib/auth";
import { submitAttempt } from "@/lib/attempts";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(["student"]);
    const { id } = await context.params;
    await submitAttempt(user, id);
    await audit(user, "attempt_submitted", "attempts", id);
    return Response.json({ ok: true, redirect: "/aluno/resultados" });
  } catch (e) {
    return errorResponse(e);
  }
}
