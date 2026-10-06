import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { attempts } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { assessmentsForStudent } from "@/lib/attempts";
import StartButton from "./start-button";

export const dynamic = "force-dynamic";

export default async function AlunoHome() {
  const user = await getSessionUser();
  if (!user) redirect("/aluno/login");
  if (user.role !== "student" || !user.studentId) redirect("/painel");

  const list = await assessmentsForStudent(user.studentId);
  const myAttempts = await db.select().from(attempts).where(eq(attempts.studentId, user.studentId));
  const now = new Date();

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-black text-slate-900">Olá, {user.fullName.split(" ")[0]}! 👋</h1>
        <p className="mt-1 text-base text-slate-600">
          Aqui estão as suas provas. Leia com calma e clique em <strong>Começar</strong> quando estiver pronto.
        </p>
      </section>

      {list.length === 0 && (
        <p className="rounded-2xl border-2 border-dashed border-sky-200 bg-white p-8 text-center text-lg text-slate-500">
          Você ainda não tem provas para fazer. 🎉
        </p>
      )}

      <ul className="flex flex-col gap-4">
        {list.map((a) => {
          const mine = myAttempts.filter((t) => t.assessmentId === a.id);
          const open = mine.find((t) => t.status === "em_andamento");
          const done = mine.filter((t) => t.status !== "em_andamento").length;
          const windowOpen =
            a.status === "publicada" &&
            (!a.availableFrom || a.availableFrom <= now) &&
            (!a.availableUntil || a.availableUntil >= now);
          const canStart = windowOpen && (open || done < a.maxAttempts);

          return (
            <li key={a.id} className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">{a.title}</h2>
              {a.description && <p className="mt-1 text-base text-slate-600">{a.description}</p>}
              <p className="mt-2 text-sm text-slate-500">
                ⏱️ {a.durationMinutes} minutos · {a.maxAttempts} tentativa(s) ·{" "}
                {a.availableUntil ? `até ${new Date(a.availableUntil).toLocaleString("pt-BR")}` : "sem prazo final"}
              </p>
              <div className="mt-4">
                {canStart ? (
                  <StartButton assessmentId={a.id} resume={Boolean(open)} />
                ) : (
                  <p className="text-base font-semibold text-slate-500">
                    {done > 0 ? "Prova entregue ✅" : "Prova indisponível no momento."}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
