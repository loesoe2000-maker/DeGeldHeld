"use client";

import BillUpload from "@/components/BillUpload";
import { useRouter } from "next/navigation";

export default function OnderhandelPage() {
  const router = useRouter();
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-900">Nieuwe onderhandeling</h1>
      <p className="mt-2 text-slate-600">
        Upload een foto van je rekening. Wij lezen provider en bedrag automatisch in.
      </p>
      <div className="mt-8">
        <BillUpload
          onUploaded={(r) => {
            if (r.billId) {
              const path = r.needsManual
                ? `/onderhandel/${r.billId}/manual`
                : `/onderhandel/analyse?bill=${r.billId}`;
              router.push(path);
            }
          }}
        />
      </div>
    </main>
  );
}
