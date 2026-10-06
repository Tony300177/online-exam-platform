import { audit, errorResponse, HttpError, requireUser } from "@/lib/auth";
import { startOrResumeAttempt } from "@/lib/attempts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireUser(["student"]);
    const body = (await request.json()) as { assessmentId?: string };
    if (!body.assessmentId) throw new HttpError(400, "Avaliação não informada.");
    const attemptId = await startOrResumeAttempt(user, body.assessmentId);
    await audit(user, "attempt_started", "attempts", attemptId);
    return Response.json({ attemptId });
  } catch (e) {
    return errorResponse(e);
  }
}
