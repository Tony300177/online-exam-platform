import type { ReactNode } from "react";

export function Card({
  title,
  subtitle,
  children,
  actions,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h2 className="text-base font-semibold text-slate-800">{title}</h2>}
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-rose-100 text-rose-800",
    blue: "bg-sky-100 text-sky-800",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone] ?? tones.slate}`}>
      {children}
    </span>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 disabled:opacity-60";

export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2";

/* ------------------------- Gráficos (SVG puro) ------------------------- */

export function BarsH({
  data,
  unit = "%",
}: {
  data: { label: string; value: number; n?: number; title?: string }[];
  unit?: string;
}) {
  if (!data.length) return <EmptyState message="Sem dados suficientes para este gráfico." />;
  return (
    <ul className="flex flex-col gap-3">
      {data.map((d) => (
        <li key={d.label}>
          <div className="flex items-baseline justify-between gap-3 text-xs text-slate-600">
            <span className="font-semibold text-slate-800" title={d.title}>
              {d.label}
            </span>
            <span>
              {d.value.toFixed(1)}
              {unit}
              {d.n !== undefined && <span className="ml-2 text-slate-400">n={d.n}</span>}
            </span>
          </div>
          <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-3 rounded-full ${
                d.value >= 70 ? "bg-emerald-500" : d.value >= 50 ? "bg-amber-500" : "bg-rose-500"
              }`}
              style={{ width: `${Math.max(0, Math.min(100, d.value))}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Histogram({ buckets }: { buckets: { label: string; count: number }[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  if (!buckets.length) return <EmptyState message="Sem dados." />;
  return (
    <div className="flex h-48 items-end gap-2">
      {buckets.map((b) => (
        <div key={b.label} className="flex flex-1 flex-col items-center justify-end gap-1">
          <span className="text-xs font-semibold text-slate-600">{b.count}</span>
          <div
            className="w-full rounded-t bg-sky-600"
            style={{ height: `${(b.count / max) * 100}%`, minHeight: b.count ? 4 : 0 }}
            title={`${b.label}: ${b.count}`}
          />
          <span className="text-[10px] text-slate-500">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

export function LineChart({ points }: { points: { label: string; value: number }[] }) {
  if (points.length < 2)
    return <EmptyState message="É necessário ao menos duas avaliações comparáveis para a evolução." />;
  const w = 600;
  const h = 180;
  const pad = 28;
  const step = (w - pad * 2) / (points.length - 1);
  const coords = points.map((p, i) => [pad + i * step, h - pad - (Math.min(100, p.value) / 100) * (h - pad * 2)]);
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(" ");
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="min-w-[520px]" role="img" aria-label="Evolução temporal">
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#cbd5e1" />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#cbd5e1" />
        <path d={path} fill="none" stroke="#0369a1" strokeWidth={2.5} />
        {coords.map((c, i) => (
          <g key={i}>
            <circle cx={c[0]} cy={c[1]} r={4} fill="#0369a1" />
            <text x={c[0]} y={h - pad + 14} textAnchor="middle" fontSize="9" fill="#64748b">
              {points[i].label.slice(0, 16)}
            </text>
            <text x={c[0]} y={c[1] - 8} textAnchor="middle" fontSize="9" fill="#0f172a">
              {points[i].value.toFixed(0)}%
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function Heatmap({
  rows,
  columns,
  values,
}: {
  rows: string[];
  columns: { code: string; label: string }[];
  values: Record<string, Record<string, number | null>>;
}) {
  if (!rows.length || !columns.length) return <EmptyState message="Sem dados para a matriz aluno × habilidade." />;
  const color = (v: number | null) => {
    if (v === null) return "#f1f5f9";
    if (v >= 80) return "#047857";
    if (v >= 60) return "#10b981";
    if (v >= 40) return "#f59e0b";
    if (v >= 20) return "#fb7185";
    return "#e11d48";
  };
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-white px-2 py-1 text-left font-semibold text-slate-700">Aluno</th>
            {columns.map((c) => (
              <th key={c.code} className="px-1 py-1 text-center font-semibold text-slate-600" title={c.label}>
                {c.code}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}>
              <td className="sticky left-0 whitespace-nowrap bg-white px-2 py-1 text-slate-700">{r}</td>
              {columns.map((c) => {
                const v = values[r]?.[c.code] ?? null;
                return (
                  <td key={c.code} className="px-1 py-1">
                    <div
                      className="flex h-7 w-12 items-center justify-center rounded text-[10px] font-semibold text-white"
                      style={{ background: color(v), color: v === null ? "#94a3b8" : "#fff" }}
                      title={`${r} • ${c.code}: ${v === null ? "sem dados" : v.toFixed(0) + "%"}`}
                    >
                      {v === null ? "—" : `${v.toFixed(0)}%`}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
