"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function StartButton({ assessmentId, resume }: { assessmentId: string; resume: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={loading}
        className="rounded-2xl bg-sky-700 px-8 py-4 text-xl font-bold text-white shadow-md transition hover:bg-sky-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300 disabled:opacity-60"
        onClick={async () => {
          setLoading(true);
          setError(null);
          const res = await fetch("/api/attempts/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assessmentId }),
          });
          const data = await res.json();
          setLoading(false);
          if (!res.ok) {
            setError(data.error ?? "Não foi possível abrir a prova.");
            return;
          }
          router.push(`/aluno/prova/${data.attemptId}`);
        }}
      >
        {loading ? "Abrindo…" : resume ? "Continuar prova ▶️" : "Começar ▶️"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-base font-semibold text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
