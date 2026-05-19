"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * v15 DEEL 4 — homepage live activity feed.
 *
 * Floating widget bottom-right on desktop; collapsible inline strip
 * on mobile. Polls /api/activity every 30 seconds. Dismissable via
 * an X-button; the choice persists in dgh_activity_dismissed cookie
 * (set by document.cookie since this is a client component).
 */

export type ActivityItem = {
  provider: string;
  savingsCents: number;
  country: string;
  ageSeconds: number;
};

const POLL_INTERVAL_MS = 30_000;
const DISMISS_COOKIE = "dgh_activity_dismissed";

function readDismissed(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim().startsWith(`${DISMISS_COOKIE}=1`));
}

function setDismissedCookie(): void {
  if (typeof document === "undefined") return;
  const oneWeek = 60 * 60 * 24 * 7;
  document.cookie = `${DISMISS_COOKIE}=1; max-age=${oneWeek}; path=/; samesite=lax`;
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s geleden`;
  const min = Math.floor(seconds / 60);
  if (min < 60) return `${min} min geleden`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} uur geleden`;
  const days = Math.floor(hour / 24);
  return `${days} dag${days === 1 ? "" : "en"} geleden`;
}

function formatEuro(cents: number): string {
  return `€${Math.round(cents / 100).toLocaleString("nl-NL")}`;
}

export default function ActivityFeed() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(true); // mobile-collapsed by default

  const fetchItems = useCallback(async () => {
    try {
      const r = await fetch("/api/activity", { cache: "no-store" });
      if (!r.ok) return;
      const data = (await r.json()) as { items?: ActivityItem[] };
      if (data.items) setItems(data.items);
    } catch {
      // ignore — keep last-known list rendered
    }
  }, []);

  useEffect(() => {
    setDismissed(readDismissed());
    void fetchItems();
    const id = setInterval(fetchItems, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchItems]);

  if (dismissed) return null;

  const top = items.slice(0, 5);

  function onDismiss() {
    setDismissedCookie();
    setDismissed(true);
  }

  return (
    <div
      data-testid="activity-feed"
      className="fixed bottom-4 right-4 z-30 hidden w-80 rounded-xl border border-slate-200 bg-white shadow-lg sm:block"
    >
      <div className="flex items-center justify-between border-b border-slate-100 p-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          Live besparingen
        </span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Sluit live-feed"
          data-testid="activity-dismiss"
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          ✕
        </button>
      </div>
      {top.length === 0 ? (
        <p className="p-3 text-sm text-slate-500">Nog geen recente activiteit.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {top.map((it, i) => (
            <li
              key={`${it.provider}-${it.ageSeconds}-${i}`}
              className="flex items-center gap-2 p-3 text-sm"
            >
              <span className="text-emerald-600">🟢</span>
              <span className="text-slate-500">{formatAge(it.ageSeconds)}</span>
              <span className="ml-auto font-semibold text-slate-900">
                {formatEuro(it.savingsCents)}
              </span>
              <span className="text-slate-500">bij {it.provider}</span>
            </li>
          ))}
        </ul>
      )}
      {/* Mobile inline strip — single-line summary */}
      <div className="block border-t border-slate-100 p-2 text-center text-xs text-slate-500 sm:hidden">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="underline"
        >
          {collapsed ? `Live: ${items.length}+ besparingen vandaag` : "Verberg"}
        </button>
      </div>
    </div>
  );
}
