"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Candidate = {
  id: string;
  name: string;
  country: string;
  retentionJson: string;
  status: string;
  createdAt: Date | string;
};

export default function ProviderCandidateRow({ candidate }: { candidate: Candidate }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  let retention: Record<string, string> = {};
  try {
    retention = JSON.parse(candidate.retentionJson) as Record<string, string>;
  } catch {
    retention = {};
  }

  async function setStatus(status: "APPROVED" | "REJECTED") {
    setPending(true);
    try {
      const resp = await fetch(`/api/providers/candidates/${candidate.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!resp.ok) {
        setPending(false);
        return;
      }
      router.refresh();
    } catch {
      setPending(false);
    }
  }

  return (
    <li className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-900">
            {candidate.name}{" "}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
              {candidate.country}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-1 text-sm text-slate-600 sm:grid-cols-2">
            {Object.entries(retention).map(([k, v]) => (
              <div key={k}>
                <span className="font-medium">{k}:</span> {v}
              </div>
            ))}
          </div>
        </div>
        {candidate.status === "PENDING" && (
          <div className="flex flex-shrink-0 gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setStatus("APPROVED")}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setStatus("REJECTED")}
              className="rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        )}
        {candidate.status !== "PENDING" && (
          <span className="flex-shrink-0 self-center rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
            {candidate.status}
          </span>
        )}
      </div>
    </li>
  );
}
