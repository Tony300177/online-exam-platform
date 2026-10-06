import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/account";
import { Card } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Card title="Trocar senha" subtitle={`Perfil: ${user.fullName}`}>
        <ChangePasswordForm forced={user.mustChangePassword} />
      </Card>
    </main>
  );
}
