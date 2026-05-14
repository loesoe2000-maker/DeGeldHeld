// Placeholder — F3 vervangt met SavingsCard + NegotiationList + EmptyState
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?from=/dashboard");

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
      <p className="mt-2 text-slate-600">Welkom, {session.user.email}.</p>
    </main>
  );
}
