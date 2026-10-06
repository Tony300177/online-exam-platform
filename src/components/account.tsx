"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btnGhost, btnPrimary, Field, inputClass } from "@/components/ui";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className={btnGhost}
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
    >
      Sair
    </button>
  );
}

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      setMsg({ type: "err", text: "A confirmação não confere com a nova senha." });
      return;
    }
    setLoading(true);
    setMsg(null);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMsg({ type: "err", text: data.error ?? "Não foi possível alterar a senha." });
      return;
    }
    setMsg({ type: "ok", text: "Senha alterada! Faça login novamente com a nova senha." });
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1500);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {forced && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
          Por segurança, troque a senha inicial antes de continuar.
        </p>
      )}
      <Field label="Senha atual" htmlFor="cur">
        <input id="cur" type="password" required className={inputClass} value={currentPassword} onChange={(e) => setCurrent(e.target.value)} />
      </Field>
      <Field label="Nova senha" htmlFor="new" hint="Mínimo de 6 caracteres e diferente da senha padrão.">
        <input id="new" type="password" required minLength={6} className={inputClass} value={newPassword} onChange={(e) => setNew(e.target.value)} />
      </Field>
      <Field label="Confirmar nova senha" htmlFor="conf">
        <input id="conf" type="password" required minLength={6} className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      {msg && (
        <p
          role="alert"
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            msg.type === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"
          }`}
        >
          {msg.text}
        </p>
      )}
      <button type="submit" className={btnPrimary} disabled={loading}>
        {loading ? "Salvando…" : "Salvar nova senha"}
      </button>
    </form>
  );
}
