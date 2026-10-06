"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Field, inputClass } from "@/components/ui";

type Option = { id: string; name: string };

export default function StudentLogin() {
  const router = useRouter();
  const [schools, setSchools] = useState<Option[]>([]);
  const [classes, setClasses] = useState<Option[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [classId, setClassId] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/public/schools")
      .then((r) => r.json())
      .then((d) => setSchools(d.schools ?? []))
      .catch(() => setError("Não foi possível carregar as escolas."));
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    fetch(`/api/public/classes?schoolId=${schoolId}`)
      .then((r) => r.json())
      .then((d) => setClasses(d.classes ?? []))
      .catch(() => setError("Não foi possível carregar as turmas."));
  }, [schoolId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/student-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId, classId, fullName, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível entrar.");
      router.push(data.redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen">
      <aside className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-sky-600 via-sky-700 to-indigo-800 p-12 text-white lg:flex">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur">
              📝
            </span>
            <span className="text-xl font-bold tracking-tight">Avalia BNCC</span>
          </div>
          <h1 className="mt-16 text-4xl font-extrabold leading-tight">
            Sua prova online,
            <br />
            <span className="text-sky-200">simples e rápida.</span>
          </h1>
          <p className="mt-4 max-w-md text-lg text-sky-100/90">
            Acesse com os dados que sua escola informou e comece a responder.
          </p>
        </div>
        <div className="space-y-3 text-sm text-sky-100/80">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs">✓</span>
            Questões alinhadas à BNCC
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs">✓</span>
            Correção automática
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs">✓</span>
            Resultados em tempo real
          </div>
        </div>
      </aside>

      <section className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-white px-5 py-10">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-sky-700 hover:text-sky-800">
            <span aria-hidden>←</span> Voltar ao início
          </Link>

          <div className="rounded-3xl border border-sky-100 bg-white p-8 shadow-xl shadow-sky-100/50">
            <div className="mb-6 text-center">
              <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-3xl">
                🧒
              </span>
              <h2 className="text-2xl font-extrabold text-slate-900">Área do Aluno</h2>
              <p className="mt-1 text-sm text-slate-500">
                Escolha sua escola, turma e entre com seus dados.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <Field label="Escola" htmlFor="school">
                <select
                  id="school"
                  required
                  className={`${inputClass} py-3`}
                  value={schoolId}
                  onChange={(e) => {
                    setSchoolId(e.target.value);
                    setClassId("");
                    setClasses([]);
                  }}
                >
                  <option value="">Selecione sua escola</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Turma" htmlFor="class">
                <select
                  id="class"
                  required
                  disabled={!schoolId}
                  className={`${inputClass} py-3 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400`}
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                >
                  <option value="">
                    {schoolId ? "Selecione sua turma" : "Escolha a escola primeiro"}
                  </option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Nome completo" htmlFor="name">
                <input
                  id="name"
                  required
                  autoComplete="name"
                  placeholder="Como está na matrícula"
                  className={`${inputClass} py-3`}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </Field>

              <Field label="Senha" htmlFor="pwd">
                <input
                  id="pwd"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  className={`${inputClass} py-3`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>

              {error && (
                <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-sky-600 px-6 py-4 text-lg font-bold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300 disabled:opacity-60"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Entrando…
                  </span>
                ) : (
                  "Entrar"
                )}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            Problemas para acessar? Fale com a coordenação da sua escola.
          </p>
        </div>
      </section>
    </main>
  );
}