"use client";

import { useEffect, useState } from "react";

/**
 * Shows a small "geen verbinding" banner when `online` becomes false.
 * Re-mounts/disappears when connectivity returns. Includes a manual
 * "Opnieuw proberen" button that fires the passed onRetry callback.
 */
export default function NetworkRetry({ onRetry }: { onRetry?: () => void }) {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const goOn = () => setOnline(true);
    const goOff = () => setOnline(false);
    window.addEventListener("online", goOn);
    window.addEventListener("offline", goOff);
    return () => {
      window.removeEventListener("online", goOn);
      window.removeEventListener("offline", goOff);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 shadow-lg sm:left-auto sm:right-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-rose-700">Geen internetverbinding</div>
          <div className="text-sm text-rose-600">Controleer je verbinding en probeer opnieuw.</div>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
          >
            Opnieuw
          </button>
        )}
      </div>
    </div>
  );
}
