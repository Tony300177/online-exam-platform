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
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-5 py-10">
      <Link href="/" className="mb-5 text-base font-semibold text-sky-700 hover:underline">
        ← Voltar
      </Link>
      <form onSubmit={submit} className="rounded-3xl border-2 border-sky-200 bg-white p-7 shadow-md">
        <h1 className="text-3xl font-black text-slate-900">Entrar no painel do aluno 🧒</h1>
        <p className="mt-2 text-base text-slate-600">
          Escolha sua escola e sua turma, escreva seu nome completo e digite sua senha.
        </p>

        <div className="mt-6 flex flex-col gap-5 text-lg">
          <Field label="Escola" htmlFor="school">
            <select
              id="school"
              required
              className={`${inputClass} py-3 text-lg`}
              value={schoolId}
              onChange={(e) => {
                  setSchoolId(e.target.value);
                  setClassId("");
                  setClasses([]);
                }}
            >
              <option value="">Selecione a escola</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Turma" htmlFor="class" hint="As turmas aparecem depois de escolher a escola.">
            <select
              id="class"
              required
              disabled={!schoolId}
              className={`${inputClass} py-3 text-lg`}
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              <option value="">Selecione a turma</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Nome completo (como está na matrícula)" htmlFor="name">
            <input
              id="name"
              required
              autoComplete="name"
              className={`${inputClass} py-3 text-lg`}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </Field>

          <Field label="Senha" htmlFor="pwd" hint="Na primeira vez, use a senha que a escola informou.">
            <input
              id="pwd"
              type="password"
              required
              autoComplete="current-password"
              className={`${inputClass} py-3 text-lg`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-base font-semibold text-rose-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-sky-700 px-6 py-4 text-xl font-bold text-white shadow-md transition hover:bg-sky-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300 disabled:opacity-60"
          >
            {loading ? "Entrando…" : "Entrar no painel do aluno"}
          </button>
        </div>
      </form>
    </main>
  );
}
