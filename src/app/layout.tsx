import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Avalia BNCC — Plataforma de Provas On-line",
  description:
    "Plataforma de aplicação de provas on-line para escolas: cadastro de alunos, banco de questões BNCC, aplicação, correção e análise pedagógica.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased">
        {children}
        <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
          <p className="font-bold text-[10px]">Desenvolvido Pelo Departamento de Tecnologia da SME.</p>
        </footer>
      </body>
    </html>
  );
}
