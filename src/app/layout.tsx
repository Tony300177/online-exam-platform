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
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
