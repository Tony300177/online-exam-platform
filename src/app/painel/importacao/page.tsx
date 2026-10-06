import { Card } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import ImportWizard from "./wizard";

export const dynamic = "force-dynamic";

export default async function ImportacaoPage() {
  await requirePage(["admin", "manager"]);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Importação de alunos (XLSX/CSV)</h1>
        <p className="text-sm text-slate-600">
          Selecione o arquivo, confira o mapeamento das colunas, revise a pré-visualização e confirme
          a gravação. Escolas e turmas já existentes não são duplicadas e nenhum dado pessoal ausente
          é preenchido automaticamente.
        </p>
      </div>
      <Card>
        <ImportWizard />
      </Card>
    </div>
  );
}
