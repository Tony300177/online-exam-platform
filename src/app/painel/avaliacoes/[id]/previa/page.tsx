import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assessmentQuestions, assessments, questionOptions, questions } from "@/db/schema";
import { Card, EmptyState } from "@/components/ui";
import { assertSchoolAccessPage, requirePage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage(["admin", "teacher"]);
  const { id } = await params;
  const a = (await db.select().from(assessments).where(eq(assessments.id, id)).limit(1))[0];
  if (!a) notFound();
  await assertSchoolAccessPage(user, a.schoolId);

  const items = await db
    .select({
      id: questions.id,
      statement: questions.statement,
      support: questions.supportText,
      type: questions.type,
      points: assessmentQuestions.points,
    })
    .from(assessmentQuestions)
    .innerJoin(questions, eq(questions.id, assessmentQuestions.questionId))
    .where(eq(assessmentQuestions.assessmentId, id))
    .orderBy(asc(assessmentQuestions.position));

  const options = await db.select().from(questionOptions).orderBy(asc(questionOptions.position));

  return (
    <div className="flex flex-col gap-5">
      <Link href={`/painel/avaliacoes/${id}`} className="text-sm text-sky-700 hover:underline">
        ← Voltar à avaliação
      </Link>
      <Card title={`Prévia: ${a.title}`} subtitle="Visualização idêntica à ordem apresentada ao aluno (gabarito destacado apenas para o professor).">
        {items.length === 0 ? (
          <EmptyState message="Nenhuma questão adicionada." />
        ) : (
          <ol className="flex flex-col gap-6">
            {items.map((q, i) => (
              <li key={q.id}>
                {q.support && <p className="mb-2 rounded bg-slate-50 p-3 text-sm italic text-slate-700">{q.support}</p>}
                <p className="font-semibold text-slate-900">
                  {i + 1}. {q.statement}{" "}
                  <span className="text-xs font-normal text-slate-500">({Number(q.points).toFixed(2)} pt)</span>
                </p>
                <ul className="mt-2 flex flex-col gap-1 text-sm">
                  {options
                    .filter((o) => o.questionId === q.id)
                    .map((o) => (
                      <li key={o.id} className={o.isCorrect ? "font-semibold text-emerald-700" : "text-slate-700"}>
                        {o.label}) {o.content} {o.isCorrect && "✓ gabarito"}
                      </li>
                    ))}
                  {q.type === "short_answer" && <li className="text-slate-500">[campo de resposta curta]</li>}
                  {q.type === "open_answer" && <li className="text-slate-500">[campo de resposta aberta]</li>}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
