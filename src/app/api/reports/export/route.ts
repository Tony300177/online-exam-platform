import * as XLSX from "xlsx";
import { allowedSchoolIds, audit, errorResponse, requireUser } from "@/lib/auth";
import { getAnalytics } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireUser(["admin", "manager", "teacher"]);
    const allowed = await allowedSchoolIds(user);
    const url = new URL(request.url);
    const p = (k: string) => url.searchParams.get(k) || undefined;
    const format = (p("formato") ?? "csv").toLowerCase();

    const data = await getAnalytics({
      allowedSchoolIds: allowed,
      schoolId: p("escola"),
      classId: p("turma"),
      gradeYear: p("ano") ? Number(p("ano")) : undefined,
      subjectId: p("componente"),
      assessmentId: p("avaliacao"),
      studentId: p("aluno"),
      from: p("de"),
      to: p("ate"),
    });

    const indicadores = [
      { indicador: "Participação (%)", valor: data.totals.participationRate.toFixed(1), n: data.totals.assignedStudents },
      { indicador: "Taxa de acerto (%)", valor: data.totals.accuracy.toFixed(1), n: data.totals.answers },
      { indicador: "Média (%)", valor: data.totals.average.toFixed(1), n: data.totals.submitted },
      { indicador: "Mediana (%)", valor: data.totals.median.toFixed(1), n: data.totals.submitted },
      { indicador: "Respostas em branco", valor: String(data.totals.blanks), n: data.totals.answers },
      { indicador: "Gerado em", valor: new Date().toLocaleString("pt-BR"), n: "" },
    ];

    const habilidades = data.bySkill.map((s) => ({
      codigo_bncc: s.code,
      descricao: s.description,
      aproveitamento_percentual: s.value.toFixed(1),
      respostas_consideradas: s.n,
    }));

    const matriz = data.matrix.rows.map((r) => {
      const row: Record<string, string> = { aluno: r };
      for (const c of data.matrix.columns) {
        const v = data.matrix.values[r]?.[c.code];
        row[c.code] = v === null || v === undefined ? "" : v.toFixed(1);
      }
      return row;
    });

    await audit(user, "report_exported", "reports", undefined, { format });

    if (format === "xlsx") {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(indicadores), "Indicadores");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(habilidades), "Habilidades BNCC");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matriz.length ? matriz : [{ aluno: "" }]), "Aluno x Habilidade");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
      return new Response(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="relatorio-avaliacao.xlsx"`,
        },
      });
    }

    const lines: string[] = [];
    lines.push("INDICADORES");
    lines.push("indicador;valor;respostas_consideradas");
    for (const i of indicadores) lines.push(`${i.indicador};${i.valor};${i.n}`);
    lines.push("");
    lines.push("DESEMPENHO POR HABILIDADE BNCC");
    lines.push("codigo;descricao;aproveitamento_percentual;respostas");
    for (const h of habilidades)
      lines.push(`${h.codigo_bncc};"${h.descricao.replace(/"/g, "'")}";${h.aproveitamento_percentual};${h.respostas_consideradas}`);
    lines.push("");
    lines.push("MATRIZ ALUNO x HABILIDADE");
    lines.push(["aluno", ...data.matrix.columns.map((c) => c.code)].join(";"));
    for (const r of matriz) lines.push([r.aluno, ...data.matrix.columns.map((c) => r[c.code] ?? "")].join(";"));

    return new Response("\uFEFF" + lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="relatorio-avaliacao.csv"`,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
