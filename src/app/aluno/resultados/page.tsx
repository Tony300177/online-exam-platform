import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { answers, assessments, attempts, bnccSkills, questionSkills } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ResultadosPage() {
  const user = await getSessionUser();
  if (!user) redirect("/aluno/login");
  if (user.role !== "student" || !user.studentId) redirect("/painel");

  const rows = await db
    .select({
      attemptId: attempts.id,
      title: assessments.title,
      status: attempts.status,
      total: attempts.totalScore,
      max: attempts.maxScore,
      submittedAt: attempts.submittedAt,
      released: assessments.releaseResults,
    })
    .from(attempts)
    .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
    .where(eq(attempts.studentId, user.studentId))
    .orderBy(desc(attempts.submittedAt));

  const skillRows = await db
    .select({
      attemptId: answers.attemptId,
      code: bnccSkills.code,
      description: bnccSkills.description,
      score: answers.score,
      max: answers.maxScore,
      released: assessments.releaseResults,
    })
    .from(answers)
    .innerJoin(attempts, eq(attempts.id, answers.attemptId))
    .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
    .innerJoin(questionSkills, eq(questionSkills.questionId, answers.questionId))
    .innerJoin(bnccSkills, eq(bnccSkills.id, questionSkills.skillId))
    .where(eq(attempts.studentId, user.studentId));

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-black text-slate-900">Meus resultados 📊</h1>

      {rows.length === 0 && (
        <p className="rounded-2xl bg-white p-8 text-center text-lg text-slate-500">
          Você ainda não entregou nenhuma prova.
        </p>
      )}

      <ul className="flex flex-col gap-4">
        {rows.map((r) => {
          const pct = Number(r.max) > 0 ? (Number(r.total) / Number(r.max)) * 100 : 0;
          const skills = skillRows.filter((s) => s.attemptId === r.attemptId);
          const bySkill = new Map<string, { got: number; max: number; description: string }>();
          for (const s of skills) {
            const cur = bySkill.get(s.code) ?? { got: 0, max: 0, description: s.description };
            cur.got += Number(s.score ?? 0);
            cur.max += Number(s.max);
            bySkill.set(s.code, cur);
          }
          return (
            <li key={r.attemptId} className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">{r.title}</h2>
              <p className="text-sm text-slate-500">
                Entregue em {r.submittedAt ? new Date(r.submittedAt).toLocaleString("pt-BR") : "—"}
              </p>
              {!r.released ? (
                <p className="mt-3 rounded-xl bg-amber-50 p-4 text-base font-semibold text-amber-900">
                  ✅ Prova entregue! O resultado será liberado pelo seu professor.
                </p>
              ) : (
                <>
                  <p className="mt-3 text-3xl font-black text-sky-800">
                    {Number(r.total).toFixed(1)} de {Number(r.max).toFixed(1)} pontos ({pct.toFixed(0)}%)
                  </p>
                  {bySkill.size > 0 && (
                    <ul className="mt-4 flex flex-col gap-2">
                      {[...bySkill.entries()].map(([code, v]) => {
                        const p = v.max > 0 ? (v.got / v.max) * 100 : 0;
                        return (
                          <li key={code}>
                            <div className="flex justify-between text-sm text-slate-600">
                              <span className="font-semibold">{code}</span>
                              <span>{p.toFixed(0)}%</span>
                            </div>
                            <p className="text-xs text-slate-500">{v.description}</p>
                            <div className="mt-1 h-3 w-full rounded-full bg-slate-100">
                              <div
                                className={`h-3 rounded-full ${p >= 70 ? "bg-emerald-500" : p >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
                                style={{ width: `${Math.min(100, p)}%` }}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
