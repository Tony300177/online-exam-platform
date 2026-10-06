import { errorResponse, HttpError, requireUser } from "@/lib/auth";
import { saveAnswer } from "@/lib/attempts";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(["student"]);
    const { id } = await context.params;
    const body = (await request.json()) as {
      questionId?: string;
      optionId?: string | null;
      text?: string | null;
    };
    if (!body.questionId) throw new HttpError(400, "Questão não informada.");
    await saveAnswer(user, id, {
      questionId: body.questionId,
      optionId: body.optionId ?? null,
      text: body.text ?? null,
    });
    return Response.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (e) {
    return errorResponse(e);
  }
}
