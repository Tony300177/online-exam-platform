"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Q = {
  questionId: string;
  statement: string;
  support: string | null;
  type: string;
  points: number;
  options: { id: string; label: string; content: string }[];
  savedOptionId: string | null;
  savedText: string;
};

type SaveState = "idle" | "saving" | "saved" | "offline";

export default function ExamRunner({
  attemptId,
  title,
  instructions,
  deadline,
  questions,
}: {
  attemptId: string;
  title: string;
  instructions: string | null;
  deadline: string | null;
  questions: Q[];
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState<Record<string, { optionId: string | null; text: string }>>(() =>
    Object.fromEntries(
      questions.map((q) => [q.questionId, { optionId: q.savedOptionId, text: q.savedText }]),
    ),
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const queue = useRef<Record<string, { optionId: string | null; text: string }>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const pending = Object.entries(queue.current);
    if (!pending.length) return;
    setSaveState("saving");
    try {
      for (const [questionId, v] of pending) {
        const res = await fetch(`/api/attempts/${attemptId}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId, optionId: v.optionId, text: v.text }),
        });
        if (!res.ok) throw new Error("falha");
        delete queue.current[questionId];
      }
      setSaveState("saved");
    } catch {
      setSaveState("offline"); // mantém na fila para nova tentativa
    }
  }, [attemptId]);

  const scheduleSave = useCallback(
    (questionId: string, value: { optionId: string | null; text: string }) => {
      queue.current[questionId] = value;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 800);
    },
    [flush],
  );

  // tentativa periódica de reenvio (perda temporária de conexão)
  useEffect(() => {
    const i = setInterval(() => {
      if (Object.keys(queue.current).length) void flush();
    }, 8000);
    return () => clearInterval(i);
  }, [flush]);

  // aviso ao sair com respostas não salvas
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (Object.keys(queue.current).length) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  useEffect(() => {
    if (!deadline) return;
    const i = setInterval(() => {
      const ms = new Date(deadline).getTime() - Date.now();
      setRemaining(Math.max(0, Math.floor(ms / 1000)));
    }, 1000);
    return () => clearInterval(i);
  }, [deadline]);

  async function submit() {
    await flush();
    const res = await fetch(`/api/attempts/${attemptId}/submit`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Não foi possível entregar a prova.");
      return;
    }
    router.push("/aluno/resultados");
    router.refresh();
  }

  const q = questions[index];
  const answeredCount = questions.filter(
    (item) => values[item.questionId]?.optionId || values[item.questionId]?.text?.trim(),
  ).length;

  return (
    <div className="flex flex-col gap-5">
      <header className="rounded-2xl bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-black text-slate-900">{title}</h1>
        {instructions && <p className="mt-1 text-base text-slate-600">{instructions}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full bg-sky-100 px-3 py-1 font-semibold text-sky-900">
            Questão {index + 1} de {questions.length}
          </span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-900">
            {answeredCount} respondida(s)
          </span>
          {remaining !== null && (
            <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-900">
              ⏱️ {Math.floor(remaining / 60)}min {remaining % 60}s
            </span>
          )}
          <span
            aria-live="polite"
            className={`rounded-full px-3 py-1 font-semibold ${
              saveState === "offline" ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-700"
            }`}
          >
            {saveState === "saving"
              ? "Salvando…"
              : saveState === "saved"
                ? "Tudo salvo ✓"
                : saveState === "offline"
                  ? "Sem conexão — tentando salvar de novo"
                  : "Salvamento automático ativo"}
          </span>
        </div>
      </header>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        {q.support && <p className="mb-3 rounded-xl bg-slate-50 p-4 text-base italic text-slate-700">{q.support}</p>}
        <h2 className="text-xl font-bold text-slate-900">{q.statement}</h2>

        <div className="mt-4 flex flex-col gap-3">
          {q.options.length > 0 &&
            q.options.map((o) => {
              const selected = values[q.questionId]?.optionId === o.id;
              return (
                <label
                  key={o.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 text-lg transition ${
                    selected ? "border-sky-700 bg-sky-50 font-semibold" : "border-slate-200 hover:border-sky-300"
                  }`}
                >
                  <input
                    type="radio"
                    name={`q-${q.questionId}`}
                    className="h-5 w-5"
                    checked={selected}
                    onChange={() => {
                      const next = { optionId: o.id, text: "" };
                      setValues((v) => ({ ...v, [q.questionId]: next }));
                      scheduleSave(q.questionId, next);
                    }}
                  />
                  <span>
                    <strong className="mr-2">{o.label})</strong>
                    {o.content}
                  </span>
                </label>
              );
            })}

          {q.options.length === 0 && (
            <>
              <label htmlFor={`t-${q.questionId}`} className="text-base font-semibold text-slate-700">
                Escreva sua resposta:
              </label>
              <textarea
                id={`t-${q.questionId}`}
                rows={q.type === "short_answer" ? 2 : 6}
                className="w-full rounded-2xl border-2 border-slate-200 p-4 text-lg focus:border-sky-500 focus:outline-none"
                value={values[q.questionId]?.text ?? ""}
                onChange={(e) => {
                  const next = { optionId: null, text: e.target.value };
                  setValues((v) => ({ ...v, [q.questionId]: next }));
                  scheduleSave(q.questionId, next);
                }}
              />
            </>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className="rounded-2xl border-2 border-slate-300 px-6 py-3 text-lg font-bold text-slate-700 disabled:opacity-40"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            ← Voltar
          </button>
          {index < questions.length - 1 ? (
            <button
              type="button"
              className="rounded-2xl bg-sky-700 px-6 py-3 text-lg font-bold text-white hover:bg-sky-800"
              onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
            >
              Próxima →
            </button>
          ) : (
            <button
              type="button"
              className="rounded-2xl bg-emerald-700 px-6 py-3 text-lg font-bold text-white hover:bg-emerald-800"
              onClick={() => setConfirming(true)}
            >
              Entregar prova ✅
            </button>
          )}
        </div>
      </section>

      <nav aria-label="Ir para questão" className="flex flex-wrap gap-2">
        {questions.map((item, i) => {
          const answered = values[item.questionId]?.optionId || values[item.questionId]?.text?.trim();
          return (
            <button
              key={item.questionId}
              type="button"
              onClick={() => setIndex(i)}
              className={`h-11 w-11 rounded-xl text-base font-bold ${
                i === index
                  ? "bg-sky-700 text-white"
                  : answered
                    ? "bg-emerald-100 text-emerald-900"
                    : "bg-white text-slate-500"
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </nav>

      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 p-4 text-base font-semibold text-rose-700">
          {error}
        </p>
      )}

      {confirming && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-black text-slate-900">Deseja entregar a prova?</h2>
            <p className="mt-2 text-base text-slate-600">
              Você respondeu {answeredCount} de {questions.length} questões. Depois de entregar, não é
              possível mudar as respostas.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                className="flex-1 rounded-2xl border-2 border-slate-300 px-4 py-3 text-lg font-bold text-slate-700"
                onClick={() => setConfirming(false)}
              >
                Revisar
              </button>
              <button
                type="button"
                className="flex-1 rounded-2xl bg-emerald-700 px-4 py-3 text-lg font-bold text-white"
                onClick={submit}
              >
                Entregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
