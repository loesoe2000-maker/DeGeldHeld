import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin_auth";
import { prisma } from "@/lib/db";
import TrainingReviewForm from "@/components/TrainingReviewForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · OCR training — DeGeldHeld" };

export default async function AdminTrainingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?from=/admin/training");
  if (!(await isAdmin())) redirect("/");

  const pending = await prisma.ocrTrainingSample.findMany({
    where: { reviewed: false },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const totalReviewed = await prisma.ocrTrainingSample.count({ where: { reviewed: true } });

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-900">OCR training queue</h1>
      <p className="mt-1 text-sm text-slate-500">
        {pending.length} pending · {totalReviewed} reviewed (target: 500+ before training run)
      </p>

      {pending.length === 0 ? (
        <p className="mt-10 rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          Geen pending samples. Wacht tot users met opt-in nieuwe facturen uploaden.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {pending.map((s) => (
            <li key={s.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{s.id.slice(0, 8)} · {s.billCategory} · {s.country}</span>
                <span>{s.createdAt.toLocaleDateString("nl-NL")}</span>
              </div>
              <TrainingReviewForm sampleId={s.id} initialJson={s.anonymizedJson} />
            </li>
          ))}
        </ul>
      )}

      <section className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm">
        <h2 className="font-semibold text-slate-900">Export</h2>
        <p className="mt-1 text-slate-600">
          Wanneer je ≥500 reviewed samples hebt, draai{" "}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">npx tsx scripts/export-training-dataset.ts</code>
          {" "}om JSONL te genereren voor Replicate / HuggingFace fine-tuning.
        </p>
      </section>
    </main>
  );
}
