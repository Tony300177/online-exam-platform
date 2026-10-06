"use client";

import { btnGhost } from "@/components/ui";

export default function PrintButton() {
  return (
    <button type="button" className={btnGhost} onClick={() => window.print()}>
      Gerar PDF (impressão)
    </button>
  );
}
