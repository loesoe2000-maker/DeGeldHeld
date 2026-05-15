"use client";

import BillUpload from "@/components/BillUpload";
import { useToast } from "@/components/Toast";
import { useRouter } from "next/navigation";

export default function OnderhandelPage() {
  const router = useRouter();
  const { toast } = useToast();
  return (
    <main className="mx-auto max-w-3xl px-6 pb-32 pt-12">
      <h1 className="text-3xl font-bold text-slate-900">Nieuwe onderhandeling</h1>
      <p className="mt-2 text-slate-600">
        Upload een foto of PDF van je rekening. Wij lezen provider en bedrag automatisch in.
      </p>
      <div className="mt-8">
        <BillUpload
          onUploaded={(r) => {
            if (r.billId) {
              if (r.cached) {
                toast("Eerder verwerkt — we hergebruiken de analyse.", "info");
              } else if (r.needsManual) {
                toast("Kon niet automatisch uitlezen — vul handmatig in.", "info");
              } else {
                toast("Rekening uitgelezen — analyse loopt.", "success");
              }
              // /analyse handles both the success case and the OCR-failed
              // fallback. The `/onderhandel/[id]/manual` route doesn't exist
              // yet, so don't send the user into a 404.
              router.push(`/onderhandel/analyse?bill=${r.billId}`);
            }
          }}
        />
      </div>
      {/* Sticky bottom CTA — visible op mobiel terwijl gescrolt wordt */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 p-4 backdrop-blur sm:hidden">
        <button
          type="button"
          onClick={() => document.getElementById("bill-file")?.click()}
          className="w-full rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white"
        >
          Kies rekening
        </button>
      </div>
    </main>
  );
}
