import Link from "next/link";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { answers, assessments, attempts, classes, questions, schools, students } from "@/db/schema";
import { Card, Stat, Badge, EmptyState } from "@/components/ui";
import { allowedSchoolIds, requirePage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PainelHome() {
  const user = await requirePage(["admin", "manager", "teacher"]);
  const allowed = await allowedSchoolIds(user);
  const scope = allowed === null ? undefined : allowed.length ? allowed : ["00000000-0000-0000-0000-000000000000"];

  const count = async (table: "schools" | "classes" | "students" | "assessments") => {
    if (table === "schools") {
      const rows = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(schools)
        .where(scope ? inArray(schools.id, scope) : undefined);
      return rows[0].c;
    }
    if (table === "classes") {
      const rows = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(classes)
        .where(scope ? inArray(classes.schoolId, scope) : undefined);
      return rows[0].c;
    }
    if (table === "students") {
      const rows = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(students)
        .where(scope ? inArray(students.schoolId, scope) : undefined);
      return rows[0].c;
    }
    const rows = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(assessments)
      .where(scope ? inArray(assessments.schoolId, scope) : undefined);
    return rows[0].c;
  };

  const [schoolCount, classCount, studentCount, assessmentCount] = await Promise.all([
    count("schools"),
    count("classes"),
    count("students"),
    count("assessments"),
  ]);

  const questionCount = (await db.select({ c: sql<number>`count(*)::int` }).from(questions))[0].c;

  const pendingGrading = (
    await db
      .select({ c: sql<number>`count(*)::int` })
      .from(answers)
      .innerJoin(attempts, eq(attempts.id, answers.attemptId))
      .innerJoin(assessments, eq(assessments.id, attempts.assessmentId))
      .where(
        scope
          ? and(eq(answers.gradingStatus, "pendente"), inArray(assessments.schoolId, scope))
          : eq(answers.gradingStatus, "pendente"),
      )
  )[0].c;

  const latest = await db
    .select({
      id: assessments.id,
      title: assessments.title,
      status: assessments.status,
      gradeYear: assessments.gradeYear,
      school: schools.name,
    })
    .from(assessments)
    .innerJoin(schools, eq(schools.id, assessments.schoolId))
    .where(scope ? inArray(assessments.schoolId, scope) : undefined)
    .orderBy(desc(assessments.createdAt))
    .limit(6);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Visão geral</h1>
        <p className="text-sm text-slate-600">
          Indicadores operacionais das escolas às quais o seu perfil tem acesso.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Escolas" value={schoolCount} />
        <Stat label="Turmas" value={classCount} />
        <Stat label="Alunos" value={studentCount} />
        <Stat label="Avaliações" value={assessmentCount} />
        <Stat label="Questões no banco" value={questionCount} />
        <Stat label="Correções pendentes" value={pendingGrading} hint="Questões abertas aguardando" />
      </div>

      <Card title="Avaliações recentes">
        {latest.length === 0 ? (
          <EmptyState message="Nenhuma avaliação cadastrada ainda." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {latest.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <Link href={`/painel/avaliacoes/${a.id}`} className="font-semibold text-sky-800 hover:underline">
                    {a.title}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {a.school} · {a.gradeYear}º ano
                  </p>
                </div>
                <Badge tone={a.status === "publicada" ? "green" : a.status === "rascunho" ? "slate" : "blue"}>
                  {a.status.replace("_", " ")}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Boas práticas de uso dos indicadores">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Os percentuais são recursos analíticos da plataforma, não diagnósticos definitivos da aprendizagem.</li>
          <li>A BNCC define as habilidades; os gráficos apenas organizam evidências das respostas registradas.</li>
          <li>Avaliações com estrutura ou escala diferentes não são comparadas entre si na evolução temporal.</li>
          <li>Resultados individuais são restritos a profissionais autorizados — não há rankings públicos.</li>
        </ul>
      </Card>
    </div>
  );
}
