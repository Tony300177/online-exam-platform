"use client";

import { useState } from "react";
import { btnGhost, btnPrimary, Field, inputClass } from "@/components/ui";

type Preview = {
  sheets: { name: string; headers: string[]; totalRows: number }[];
  sheet: string;
  headers: string[];
  suggestedMapping: Record<string, string | undefined>;
  sample: Record<string, string>[];
  validation: {
    validCount: number;
    issues: { line: number; level: string; message: string }[];
    issuesTotal: number;
    validSample: {
      line: number;
      school: string;
      className: string;
      gradeYear: number;
      studentName: string;
      registration: string | null;
    }[];
  } | null;
};

type Result = {
  inserted: number;
  updated: number;
  rejected: number;
  issues: { line: number; level: string; message: string }[];
  issuesTotal: number;
};

const FIELDS: { key: string; label: string; required: boolean }[] = [
  { key: "school", label: "Escola", required: true },
  { key: "className", label: "Turma", required: true },
  { key: "gradeYear", label: "Ano escolar", required: false },
  { key: "studentName", label: "Nome do aluno", required: true },
  { key: "registration", label: "Matrícula (opcional)", required: false },
];

export default function ImportWizard() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [sheet, setSheet] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function analyze(selected: File, sheetName?: string, map?: Record<string, string>) {
    setLoading(true);
    setError(null);
    setResult(null);
    const fd = new FormData();
    fd.append("file", selected);
    if (sheetName) fd.append("sheet", sheetName);
    if (map) fd.append("mapping", JSON.stringify(map));
    const res = await fetch("/api/import/preview", { method: "POST", body: fd });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Falha ao ler o arquivo.");
      return;
    }
    setPreview(data);
    setSheet(data.sheet);
    if (!map) {
      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(data.suggestedMapping ?? {})) if (v) clean[k] = String(v);
      setMapping(clean);
    }
  }

  async function commit() {
    if (!file) return;
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("sheet", sheet);
    fd.append("mapping", JSON.stringify(mapping));
    const res = await fetch("/api/import/commit", { method: "POST", body: fd });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Falha na importação.");
      return;
    }
    setResult(data);
  }

  const canCommit = mapping.school && mapping.className && mapping.studentName;

  return (
    <div className="flex flex-col gap-6">
      <Field label="1. Arquivo da planilha (.xlsx, .xls ou .csv)" htmlFor="file">
        <input
          id="file"
          type="file"
          accept=".xlsx,.xls,.csv"
          className={inputClass}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            setPreview(null);
            setResult(null);
            if (f) void analyze(f);
          }}
        />
      </Field>

      {loading && <p className="text-sm text-slate-500">Processando…</p>}
      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}

      {preview && (
        <>
          <Field label="2. Aba da planilha" htmlFor="sheet">
            <select
              id="sheet"
              className={inputClass}
              value={sheet}
              onChange={(e) => {
                setSheet(e.target.value);
                if (file) void analyze(file, e.target.value);
              }}
            >
              {preview.sheets.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} ({s.totalRows} linhas)
                </option>
              ))}
            </select>
          </Field>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">3. Mapeamento de colunas</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FIELDS.map((f) => (
                <Field key={f.key} label={`${f.label}${f.required ? " *" : ""}`} htmlFor={`map-${f.key}`}>
                  <select
                    id={`map-${f.key}`}
                    className={inputClass}
                    value={mapping[f.key] ?? ""}
                    onChange={(e) => {
                      const next = { ...mapping, [f.key]: e.target.value };
                      if (!e.target.value) delete next[f.key];
                      setMapping(next);
                      if (file) void analyze(file, sheet, next);
                    }}
                  >
                    <option value="">— não usar —</option>
                    {preview.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </Field>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">4. Pré-visualização do arquivo</h3>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    {preview.headers.map((h) => (
                      <th key={h} className="px-2 py-2 text-left font-semibold text-slate-600">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      {preview.headers.map((h) => (
                        <td key={h} className="px-2 py-1 text-slate-700">
                          {r[h]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {preview.validation && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <p className="font-semibold">{preview.validation.validCount} linhas válidas</p>
                <p className="mt-1 text-xs">
                  Registros prontos para gravação com vínculo escola → turma → aluno.
                </p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">{preview.validation.issuesTotal} ocorrências</p>
                <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-4 text-xs">
                  {preview.validation.issues.map((i, idx) => (
                    <li key={idx}>
                      Linha {i.line} — [{i.level}] {i.message}
                    </li>
                  ))}
                  {preview.validation.issuesTotal === 0 && <li>Nenhum problema detectado.</li>}
                </ul>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button type="button" className={btnPrimary} disabled={!canCommit || loading} onClick={commit}>
              5. Confirmar e gravar importação
            </button>
            <button
              type="button"
              className={btnGhost}
              onClick={() => {
                setFile(null);
                setPreview(null);
                setResult(null);
              }}
            >
              Cancelar
            </button>
          </div>
        </>
      )}

      {result && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-5">
          <h3 className="text-base font-bold text-sky-900">Resumo da importação</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <p className="rounded-lg bg-white p-3 text-sm">
              <strong className="block text-2xl text-emerald-700">{result.inserted}</strong> inseridos
            </p>
            <p className="rounded-lg bg-white p-3 text-sm">
              <strong className="block text-2xl text-sky-700">{result.updated}</strong> atualizados
            </p>
            <p className="rounded-lg bg-white p-3 text-sm">
              <strong className="block text-2xl text-rose-700">{result.rejected}</strong> rejeitados
            </p>
          </div>
          {result.issues.length > 0 && (
            <ul className="mt-3 max-h-48 list-disc overflow-y-auto pl-5 text-xs text-slate-700">
              {result.issues.map((i, idx) => (
                <li key={idx}>
                  Linha {i.line} — [{i.level}] {i.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
