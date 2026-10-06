"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Field, inputClass } from "@/components/ui";

type Option = { id: string; name: string };

function IconSchool() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

export default function StudentLogin() {
  const router = useRouter();
  const [schools, setSchools] = useState<Option[]>([]);
  const [classes, setClasses] = useState<Option[]>([]);
  const [students, setStudents] = useState<Option[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [classId, setClassId] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("123456");
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

  useEffect(() => {
    if (!classId) return;
    fetch(`/api/public/students?schoolId=${schoolId}&classId=${classId}`)
      .then((r) => r.json())
      .then((d) => setStudents((d.students ?? []).map((s: { id: string; fullName: string }) => ({ id: s.id, name: s.fullName }))))
      .catch(() => setError("Não foi possível carregar os alunos."));
  }, [classId, schoolId]);

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
    <main className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-1/2 flex-col justify-between bg-slate-900 p-12 text-white lg:flex">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
              <IconClipboard />
            </span>
            <span className="text-lg font-semibold tracking-tight">Avalia BNCC</span>
          </div>
          <h1 className="mt-20 text-4xl font-bold leading-tight tracking-tight">
            Avaliações online
            <br />
            <span className="text-blue-400">para sua escola.</span>
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-slate-400">
            Acesse com os dados fornecidos pela sua escola e responda às avaliações disponíveis.
          </p>
        </div>
        <div className="space-y-4">
          {[
            { icon: <IconSchool />, text: "Banco de questões alinhado à BNCC" },
            { icon: <IconUsers />, text: "Gestão de turmas e estudantes" },
            { icon: <IconChart />, text: "Relatórios e análises de desempenho" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-slate-400">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-blue-400">
                {item.icon}
              </span>
              {item.text}
            </div>
          ))}
        </div>
      </aside>

      <section className="flex flex-1 flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-700">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Voltar
          </Link>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-8">
              <h2 className="text-xl font-bold text-slate-900">Acesso do Aluno</h2>
              <p className="mt-1 text-sm text-slate-500">
                Selecione sua escola e turma para continuar.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-5">
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
                    setStudents([]);
                    setFullName("");
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
                  onChange={(e) => {
                    setClassId(e.target.value);
                    setStudents([]);
                    setFullName("");
                  }}
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
                <select
                  id="name"
                  required
                  disabled={!classId}
                  className={`${inputClass} py-3 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400`}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                >
                  <option value="">
                    {classId ? "Selecione seu nome" : "Escolha a turma primeiro"}
                  </option>
                  {students.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Senha" htmlFor="pwd">
                <input
                  id="pwd"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Senha padrão da escola"
                  className={`${inputClass} py-3`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>

              {error && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 px-6 py-3.5 text-base font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:opacity-60"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Verificando…
                  </span>
                ) : (
                  "Entrar"
                )}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            Em caso de dúvidas, procure a coordenação da sua escola.
          </p>
        </div>
      </section>
    </main>
  );
}