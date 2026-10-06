"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { btnPrimary, Field, inputClass } from "@/components/ui";

export default function StaffLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha no acesso.");
      router.push(data.redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no acesso.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-6 text-sm font-semibold text-sky-700 hover:underline">
        ← Voltar
      </Link>
      <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Acesso da equipe escolar</h1>
        <p className="mt-1 text-sm text-slate-600">Administrador, gestor/coordenação ou professor.</p>

        <div className="mt-6 flex flex-col gap-4">
          <Field label="Usuário" htmlFor="username">
            <input
              id="username"
              type="text"
              autoComplete="username"
              required
              className={inputClass}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </Field>
          <Field label="Senha" htmlFor="password">
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
              {error}
            </p>
          )}
          <button type="submit" className={btnPrimary} disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">
          Acesso restrito à equipe escolar. Em caso de dúvidas, procure o administrador do sistema.
        </p>
      </form>
    </main>
  );
}
