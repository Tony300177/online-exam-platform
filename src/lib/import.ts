import * as XLSX from "xlsx";

export type SheetData = { name: string; headers: string[]; rows: Record<string, string>[] };

export function parseWorkbook(buffer: ArrayBuffer, fileName = ""): SheetData[] {
  const isCsv = /\.csv$/i.test(fileName);
  const wb = isCsv
    ? XLSX.read(new TextDecoder("utf-8").decode(buffer), { type: "string", raw: false })
    : XLSX.read(buffer, { type: "array", codepage: 65001 });
  return wb.SheetNames.map((name) => {
    const sheet = wb.Sheets[name];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
    const headers = json.length ? Object.keys(json[0]) : [];
    const rows = json.map((r) => {
      const out: Record<string, string> = {};
      for (const k of headers) out[k] = String(r[k] ?? "").trim();
      return out;
    });
    return { name, headers, rows };
  });
}

export type Mapping = {
  school: string;
  className: string;
  gradeYear: string;
  studentName: string;
  registration?: string;
  sex?: string;
  birthDate?: string;
  race?: string;
  neighborhood?: string;
  shift?: string;
};

export type RowIssue = { line: number; level: "erro" | "aviso"; message: string };

export function parseGradeYear(value: string): number | null {
  if (!value) return null;
  const m = value.match(/\d+/);
  if (m) {
    const n = Number(m[0]);
    return n >= 1 && n <= 9 ? n : null;
  }
  const v = normalizeName(value);
  if (v.includes("PRE I") || v.includes("MATERNAL") || v.includes("BERCARIO") || v.includes("BERÇÁRIO")) return 0;
  if (v.includes("PRE II") || v.includes("JARDIM") || v.includes("PRE II")) return 0;
  return null;
}

export function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export type ValidatedRow = {
  line: number;
  school: string;
  className: string;
  gradeYear: number;
  studentName: string;
  registration: string | null;
  sex: string | null;
  birthDate: string | null;
  race: string | null;
  neighborhood: string | null;
  shift: string | null;
};

export function validateRows(rows: Record<string, string>[], map: Mapping) {
  const valid: ValidatedRow[] = [];
  const issues: RowIssue[] = [];
  const seen = new Map<string, number>();

  rows.forEach((row, idx) => {
    const line = idx + 2; // considera cabeçalho na linha 1
    const school = (row[map.school] ?? "").trim();
    const className = (row[map.className] ?? "").trim();
    const rawGrade = (row[map.gradeYear] ?? "").trim() || className;
    const studentName = (row[map.studentName] ?? "").trim();
    const registration = map.registration ? (row[map.registration] ?? "").trim() : "";
    const sex = map.sex ? (row[map.sex] ?? "").trim() : "";
    const birthDate = map.birthDate ? (row[map.birthDate] ?? "").trim() : "";
    const race = map.race ? (row[map.race] ?? "").trim() : "";
    const neighborhood = map.neighborhood ? (row[map.neighborhood] ?? "").trim() : "";
    const shift = map.shift ? (row[map.shift] ?? "").trim() : "";

    if (!school && !className && !studentName) return; // linha vazia é ignorada
    if (!school) {
      issues.push({ line, level: "erro", message: "Escola não informada." });
      return;
    }
    if (!className) {
      issues.push({ line, level: "erro", message: "Turma não informada." });
      return;
    }
    if (!studentName || studentName.split(" ").filter(Boolean).length < 2) {
      issues.push({ line, level: "erro", message: "Nome do aluno ausente ou incompleto." });
      return;
    }
    const grade = parseGradeYear(rawGrade);
    if (!grade) {
      issues.push({
        line,
        level: "erro",
        message: "Ano escolar não identificado (use 1 a 9 ou um nome de turma que contenha o ano).",
      });
      return;
    }

    const key = `${normalizeName(school)}|${normalizeName(studentName)}`;
    if (seen.has(key)) {
      issues.push({
        line,
        level: "aviso",
        message: `Duplicidade na planilha: mesmo aluno já aparece na linha ${seen.get(key)}. Linha ignorada.`,
      });
      return;
    }
    seen.set(key, line);

    valid.push({
      line,
      school,
      className,
      gradeYear: grade,
      studentName,
      registration: registration || null,
      sex: sex || null,
      birthDate: birthDate || null,
      race: race || null,
      neighborhood: neighborhood || null,
      shift: shift || null,
    });
  });

  return { valid, issues };
}

export function guessMapping(headers: string[]): Partial<Mapping> {
  const find = (...terms: string[]) =>
    headers.find((h) => terms.some((t) => normalizeName(h).includes(normalizeName(t))));
  return {
    school: find("escola", "unidade", "colegio"),
    className: find("nome da turma", "turma", "classe"),
    gradeYear: find("ano escolar", "ano/série", "ano/serie", "ano", "serie", "série"),
    studentName: find("nome do aluno", "aluno", "estudante", "nome"),
    registration: find("matricula", "matrícula", "ra", "codigo do aluno"),
    sex: find("sexo", "genero", "gênero"),
    birthDate: find("data nascimento", "data de nascimento", "nascimento"),
    race: find("raça", "raca", "cor"),
    neighborhood: find("bairro", "bairro"),
    shift: find("turno", "periodo", "período"),
  };
}
