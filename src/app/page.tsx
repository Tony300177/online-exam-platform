import Link from "next/link";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-sky-50">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-6 py-16">
        <header className="flex flex-col items-center gap-5 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-sky-600 text-white shadow-lg shadow-sky-200">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.875 6.75h13.5m-13.5 3h13.5m-13.5 3h13.5m-13.5 3h13.5" />
            </svg>
          </div>
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              Avalia <span className="text-sky-600">BNCC</span>
            </h1>
            <p className="mt-3 max-w-2xl text-lg text-slate-600">
              Plataforma on-line de avaliações para escolas municipais. Questões alinhadas à BNCC, correção automática e relatórios pedagógicos.
            </p>
          </div>
        </header>

        {user && (
          <div className="mx-auto w-full max-w-2xl rounded-xl border border-sky-200 bg-sky-50 p-4 text-center text-sm text-sky-900">
            Você está conectado como <strong>{user.fullName}</strong>.{" "}
            <Link className="font-semibold underline" href={user.role === "student" ? "/aluno" : "/painel"}>
              Ir para o painel
            </Link>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Link
            href="/aluno/login"
            className="group rounded-2xl border border-sky-200 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:border-sky-400 hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 text-sky-700 group-hover:bg-sky-200">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900">Sou aluno</h2>
            <p className="mt-1 text-slate-600">Acesso às provas e aos meus resultados.</p>
          </Link>

          <Link
            href="/login"
            className="group rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:border-slate-400 hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700 group-hover:bg-slate-200">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900">Equipe escolar</h2>
            <p className="mt-1 text-slate-600">Administrador, gestor ou professor.</p>
          </Link>
        </div>
      </div>

      <footer className="border-t border-slate-200 bg-white/80 py-6 text-center text-xs text-slate-500 backdrop-blur">
        <p>Dados pessoais de estudantes são tratados conforme a LGPD. Resultados individuais são visíveis apenas a pessoas autorizadas.</p>
        <p className="mt-1">Desenvolvido pelo Departamento de Tecnologia da SME.</p>
      </footer>
    </main>
  );
}