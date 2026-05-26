import Link from "next/link";
import { isEnabled } from "@/lib/feature-flags";

/**
 * v33 SEO landing pages — sticky breadcrumb. Server-component (geen client-
 * side state nodig), gegate op MONEYFINDER_HUB_ENABLED voor de hub-link.
 *
 * Bewust géén interactivity: alleen ankers. JSON-LD BreadcrumbList wordt in
 * de pagina zelf gegenereerd (voor structured data SEO).
 */
export type SeoBreadcrumbItem = {
  label: string;
  /** Optioneel — laatste crumb krijgt geen href (huidige pagina). */
  href?: string;
};

export default function SeoBreadcrumb({ trail }: { trail: ReadonlyArray<SeoBreadcrumbItem> }) {
  const hubOn = isEnabled("MONEYFINDER_HUB_ENABLED");
  const full: SeoBreadcrumbItem[] = [
    { label: "DeGeldHeld", href: "/" },
    ...(hubOn ? [{ label: "Vind al je geld", href: "/vind-al-je-geld" }] : []),
    ...trail,
  ];
  return (
    <nav
      data-testid="seo-breadcrumb"
      aria-label="Kruimelpad"
      className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-2 text-xs text-slate-600 backdrop-blur sm:px-6"
    >
      <ol className="mx-auto flex max-w-3xl flex-wrap items-center gap-1">
        {full.map((c, i) => {
          const last = i === full.length - 1;
          return (
            <li key={c.label} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden className="text-slate-400">›</span>}
              {c.href && !last ? (
                <Link href={c.href} className="text-brand-700 hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span className="text-slate-900" aria-current={last ? "page" : undefined}>
                  {c.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
