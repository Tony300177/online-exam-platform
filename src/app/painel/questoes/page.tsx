import { and, asc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { bnccSkills, questionOptions, questionSkills, questions, subjects } from "@/db/schema";
import { Badge, btnPrimary, Card, EmptyState, Field, inputClass } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { createQuestionAction, updateQuestionStatusAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  multiple_choice: "Múltipla escolha",
  true_false: "Verdadeiro ou falso",
  short_answer: "Resposta curta",
  open_answer: "Resposta aberta",
};

export default async function QuestoesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePage(["admin", "teacher"]);
  const sp = await searchParams;

  const subjectList = await db.select().from(subjects).orderBy(asc(subjects.name));
  const skillList = await db
    .select({
      id: bnccSkills.id,
      code: bnccSkills.code,
      description: bnccSkills.description,
      gradeYear: bnccSkills.gradeYear,
      subjectId: bnccSkills.subjectId,
      unit: bnccSkills.thematicUnit,
    })
    .from(bnccSkills)
    .orderBy(asc(bnccSkills.code));

  const conds: SQL[] = [];
  if (sp.ano) conds.push(eq(questions.gradeYear, Number(sp.ano)));
  if (sp.componente) conds.push(eq(questions.subjectId, sp.componente));
  if (sp.tipo)
    conds.push(
      eq(questions.type, sp.tipo as "multiple_choice" | "true_false" | "short_answer" | "open_answer"),
    );
  if (sp.dificuldade) conds.push(eq(questions.difficulty, sp.dificuldade as "facil" | "medio" | "dificil"));
  if (sp.status)
    conds.push(eq(questions.reviewStatus, sp.status as "rascunho" | "em_revisao" | "aprovada" | "arquivada"));
  if (sp.busca) conds.push(ilike(questions.statement, `%${sp.busca}%`));
  if (sp.habilidade)
    conds.push(
      sql`exists (select 1 from ${questionSkills} qs join ${bnccSkills} b on b.id = qs.skill_id
        where qs.question_id = ${questions.id} and (b.code ilike ${"%" + sp.habilidade + "%"} or b.description ilike ${"%" + sp.habilidade + "%"} or b.thematic_unit ilike ${"%" + sp.habilidade + "%"}))`,
    );

  const list = await db
    .select({
      id: questions.id,
      statement: questions.statement,
      type: questions.type,
      gradeYear: questions.gradeYear,
      difficulty: questions.difficulty,
      status: questions.reviewStatus,
      points: questions.points,
      subject: subjects.name,
      skills: sql<string>`coalesce((select string_agg(b.code, ', ') from ${questionSkills} qs join ${bnccSkills} b on b.id = qs.skill_id where qs.question_id = ${questions.id}), '—')`,
      options: sql<string>`coalesce((select string_agg(o.label || ') ' || o.content, ' | ' order by o.position) from ${questionOptions} o where o.question_id = ${questions.id}), '')`,
    })
    .from(questions)
    .innerJoin(subjects, eq(subjects.id, questions.subjectId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(questions.gradeYear), asc(questions.createdAt))
    .limit(100);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">Banco de questões</h1>

      <Card title="Filtros">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" method="get">
          <Field label="Ano escolar" htmlFor="f-ano">
            <select id="f-ano" name="ano" defaultValue={sp.ano ?? ""} className={inputClass}>
              <option value="">Todos</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
                <option key={g} value={g}>
                  {g}º ano
                </option>
              ))}
            </select>
          </Field>
          <Field label="Componente curricular" htmlFor="f-comp">
            <select id="f-comp" name="componente" defaultValue={sp.componente ?? ""} className={inputClass}>
              <option value="">Todos</option>
              {subjectList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Habilidade BNCC / unidade temática" htmlFor="f-hab">
            <input id="f-hab" name="habilidade" defaultValue={sp.habilidade ?? ""} className={inputClass} placeholder="EF05MA03, frações…" />
          </Field>
          <Field label="Tipo de questão" htmlFor="f-tipo">
            <select id="f-tipo" name="tipo" defaultValue={sp.tipo ?? ""} className={inputClass}>
              <option value="">Todos</option>
              {Object.entries(TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Dificuldade" htmlFor="f-dif">
            <select id="f-dif" name="dificuldade" defaultValue={sp.dificuldade ?? ""} className={inputClass}>
              <option value="">Todas</option>
              <option value="facil">Fácil</option>
              <option value="medio">Médio</option>
              <option value="dificil">Difícil</option>
            </select>
          </Field>
          <Field label="Status de revisão" htmlFor="f-status">
            <select id="f-status" name="status" defaultValue={sp.status ?? ""} className={inputClass}>
              <option value="">Todos</option>
              <option value="rascunho">Rascunho</option>
              <option value="em_revisao">Em revisão</option>
              <option value="aprovada">Aprovada</option>
              <option value="arquivada">Arquivada</option>
            </select>
          </Field>
          <Field label="Buscar no enunciado" htmlFor="f-busca">
            <input id="f-busca" name="busca" defaultValue={sp.busca ?? ""} className={inputClass} />
          </Field>
          <div className="flex items-end">
            <button className={btnPrimary}>Filtrar</button>
          </div>
        </form>
      </Card>

      <Card title={`Questões (${list.length})`}>
        {list.length === 0 ? (
          <EmptyState message="Nenhuma questão encontrada com os filtros atuais." />
        ) : (
          <ul className="flex flex-col gap-3">
            {list.map((q) => (
              <li key={q.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge tone="blue">{q.gradeYear}º ano</Badge>
                  <Badge>{q.subject}</Badge>
                  <Badge>{TYPE_LABEL[q.type]}</Badge>
                  <Badge tone={q.difficulty === "dificil" ? "red" : q.difficulty === "facil" ? "green" : "amber"}>
                    {q.difficulty}
                  </Badge>
                  <Badge tone={q.status === "aprovada" ? "green" : "slate"}>{q.status}</Badge>
                  <Badge tone="blue">BNCC: {q.skills}</Badge>
                  <Badge>{Number(q.points).toFixed(2)} pt</Badge>
                </div>
                <p className="mt-2 text-sm font-medium text-slate-800">{q.statement}</p>
                {q.options && <p className="mt-1 text-xs text-slate-500">{q.options}</p>}
                <form action={updateQuestionStatusAction} className="mt-3 flex items-center gap-2">
                  <input type="hidden" name="questionId" value={q.id} />
                  <label className="sr-only" htmlFor={`st-${q.id}`}>
                    Novo status de revisão
                  </label>
                  <select id={`st-${q.id}`} name="reviewStatus" defaultValue={q.status} className={`${inputClass} w-44 py-1 text-xs`}>
                    <option value="rascunho">Rascunho</option>
                    <option value="em_revisao">Em revisão</option>
                    <option value="aprovada">Aprovada</option>
                    <option value="arquivada">Arquivada</option>
                  </select>
                  <button className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold hover:bg-slate-50">
                    Atualizar status
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Nova questão"
        subtitle="Associe sempre uma habilidade oficial da BNCC e revise pedagogicamente antes de aprovar."
      >
        <form action={createQuestionAction} className="grid gap-4 lg:grid-cols-2">
          <Field label="Componente curricular *" htmlFor="n-subject">
            <select id="n-subject" name="subjectId" required className={inputClass} defaultValue="">
              <option value="" disabled>
                Selecione
              </option>
              {subjectList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ano escolar *" htmlFor="n-grade">
            <select id="n-grade" name="gradeYear" required className={inputClass} defaultValue="">
              <option value="" disabled>
                Selecione
              </option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
                <option key={g} value={g}>
                  {g}º ano
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tipo de questão *" htmlFor="n-type">
            <select id="n-type" name="type" required className={inputClass} defaultValue="multiple_choice">
              {Object.entries(TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Habilidade BNCC *" htmlFor="n-skill" hint="Somente códigos oficiais cadastrados.">
            <select id="n-skill" name="skillId" required className={inputClass} defaultValue="">
              <option value="" disabled>
                Selecione a habilidade
              </option>
              {skillList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} ({s.gradeYear}º) — {s.description.slice(0, 90)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Texto de apoio (opcional)" htmlFor="n-support">
            <textarea id="n-support" name="supportText" rows={3} className={inputClass} />
          </Field>
          <Field label="Enunciado *" htmlFor="n-statement">
            <textarea id="n-statement" name="statement" rows={3} required className={inputClass} />
          </Field>
          {["A", "B", "C", "D", "E"].map((l) => (
            <Field key={l} label={`Alternativa ${l} (múltipla escolha)`} htmlFor={`n-opt-${l}`}>
              <input id={`n-opt-${l}`} name={`option${l}`} className={inputClass} />
            </Field>
          ))}
          <Field label="Alternativa correta" htmlFor="n-correct">
            <select id="n-correct" name="correctOption" className={inputClass} defaultValue="A">
              {["A", "B", "C", "D", "E"].map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Gabarito (verdadeiro ou falso)" htmlFor="n-tf">
            <select id="n-tf" name="tfAnswer" className={inputClass} defaultValue="V">
              <option value="V">Verdadeiro</option>
              <option value="F">Falso</option>
            </select>
          </Field>
          <Field label="Resposta esperada (resposta curta)" htmlFor="n-key">
            <input id="n-key" name="answerKeyText" className={inputClass} />
          </Field>
          <Field label="Critérios de correção (resposta aberta)" htmlFor="n-crit">
            <textarea id="n-crit" name="correctionCriteria" rows={2} className={inputClass} />
          </Field>
          <Field label="Pontuação" htmlFor="n-points">
            <input id="n-points" name="points" defaultValue="1.00" className={inputClass} />
          </Field>
          <Field label="Nível de dificuldade" htmlFor="n-dif">
            <select id="n-dif" name="difficulty" className={inputClass} defaultValue="medio">
              <option value="facil">Fácil</option>
              <option value="medio">Médio</option>
              <option value="dificil">Difícil</option>
            </select>
          </Field>
          <Field label="Status de revisão" htmlFor="n-status">
            <select id="n-status" name="reviewStatus" className={inputClass} defaultValue="em_revisao">
              <option value="rascunho">Rascunho</option>
              <option value="em_revisao">Em revisão</option>
              <option value="aprovada">Aprovada</option>
            </select>
          </Field>
          <div className="flex items-center gap-2">
            <input id="n-valid" name="skillValidated" type="checkbox" className="h-4 w-4" />
            <label htmlFor="n-valid" className="text-sm text-slate-700">
              Associação curricular validada por revisão pedagógica
            </label>
          </div>
          <div className="lg:col-span-2">
            <button className={btnPrimary}>Salvar questão</button>
          </div>
        </form>
      </Card>
    </div>
  );
}
