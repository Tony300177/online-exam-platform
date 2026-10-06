import Link from "next/link";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <span className="w-fit rounded-full bg-sky-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-sky-800">
          Avaliação educacional · BNCC
        </span>
        <h1 className="text-4xl font-black text-slate-900 sm:text-5xl">
          Plataforma on-line de aplicação de provas
        </h1>
        <p className="max-w-2xl text-lg text-slate-600">
          Cadastro de escolas, turmas e alunos; banco de questões alinhado às habilidades da BNCC;
          aplicação segura das avaliações; correção automática e manual; dashboards e relatórios
          pedagógicos com controle de acesso por perfil.
        </p>
      </header>

      {user && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          Você está conectado como <strong>{user.fullName}</strong> ({user.role}).{" "}
          <Link className="font-semibold underline" href={user.role === "student" ? "/aluno" : "/painel"}>
            Ir para o painel
          </Link>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <Link
          href="/aluno/login"
          className="group rounded-2xl border-2 border-sky-700 bg-sky-700 p-8 text-white shadow-lg transition hover:bg-sky-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300"
        >
          <p className="text-3xl">🧒</p>
          <h2 className="mt-3 text-2xl font-bold">Sou aluno</h2>
          <p className="mt-1 text-sky-100">Entrar no painel do aluno e fazer minha prova.</p>
        </Link>
        <Link
          href="/login"
          className="group rounded-2xl border-2 border-slate-300 bg-white p-8 shadow-sm transition hover:border-sky-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300"
        >
          <p className="text-3xl">🏫</p>
          <h2 className="mt-3 text-2xl font-bold text-slate-900">Equipe escolar</h2>
          <p className="mt-1 text-slate-600">Administrador, gestor/coordenação ou professor.</p>
        </Link>
      </div>

      <footer className="text-xs text-slate-500">
        Dados pessoais de estudantes são tratados conforme a LGPD. Resultados individuais são
        visíveis apenas a pessoas autorizadas; a plataforma não publica rankings de crianças.
        <br />
        Desenvolvido pelo Departamento de Tecnologia da SME.
      </footer>
    </main>
  );
}
