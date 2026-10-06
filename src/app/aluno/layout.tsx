import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/account";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AlunoLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();

  // A tela de login do aluno é pública; as páginas protegidas verificam a sessão por conta própria.
  if (!user) return <>{children}</>;
  if (user.role !== "student") redirect("/painel");

  return (
    <div className="min-h-screen bg-sky-50">
      <header className="border-b border-sky-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href="/aluno" className="text-xl font-black text-sky-900">
            🎒 Meu painel
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden font-semibold text-slate-700 sm:inline">{user.fullName}</span>
            <Link href="/aluno/resultados" className="font-semibold text-sky-800 hover:underline">
              Meus resultados
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
