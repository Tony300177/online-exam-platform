import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/account";
import { Badge } from "@/components/ui";
import { getSessionUser, type Role } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NAV: { href: string; label: string; roles: Role[] }[] = [
  { href: "/painel", label: "Visão geral", roles: ["admin", "manager", "teacher"] },
  { href: "/painel/escolas", label: "Escolas e turmas", roles: ["admin", "manager"] },
  { href: "/painel/importacao", label: "Importar alunos", roles: ["admin", "manager"] },
  { href: "/painel/usuarios", label: "Usuários", roles: ["admin"] },
  { href: "/painel/questoes", label: "Banco de questões", roles: ["admin", "teacher"] },
  { href: "/painel/avaliacoes", label: "Avaliações", roles: ["admin", "teacher"] },
  { href: "/painel/correcao", label: "Correção", roles: ["admin", "teacher"] },
  { href: "/painel/analises", label: "Dashboard pedagógico", roles: ["admin", "manager", "teacher"] },
  { href: "/painel/relatorios", label: "Relatórios", roles: ["admin", "manager", "teacher"] },
];

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  manager: "Gestor/Coordenação",
  teacher: "Professor(a)",
};

export default async function PainelLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "student") redirect("/aluno");
  if (user.mustChangePassword) redirect("/trocar-senha");

  const items = NAV.filter((n) => n.roles.includes(user.role));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/painel" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-sky-700 text-sm font-black text-white">
              AB
            </span>
            <span className="text-lg font-bold text-slate-900">Avalia BNCC</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-600 sm:inline">{user.fullName}</span>
            <Badge tone="blue">{ROLE_LABEL[user.role]}</Badge>
            <Link href="/trocar-senha" className="text-slate-600 hover:underline">
              Senha
            </Link>
            <LogoutButton />
          </div>
        </div>
        <nav aria-label="Navegação principal" className="mx-auto max-w-7xl overflow-x-auto px-4">
          <ul className="flex gap-1 pb-2 text-sm">
            {items.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  className="inline-block whitespace-nowrap rounded-lg px-3 py-2 font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
