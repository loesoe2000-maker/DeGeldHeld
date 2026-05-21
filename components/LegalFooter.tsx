import Link from "next/link";

/**
 * Slim, global legal strip rendered on EVERY page via the root layout, so
 * the privacy + terms links are always reachable (the authenticated app
 * pages don't render the rich marketing <Footer />). Kept minimal to sit
 * unobtrusively under whatever page content or marketing footer precedes it.
 */
export default function LegalFooter() {
  return (
    <div className="border-t border-slate-200 bg-white px-6 py-4 text-center text-xs text-slate-400">
      <span>© {new Date().getFullYear()} DeGeldHeld B.V.</span>
      <span className="mx-2">·</span>
      <Link href="/privacy" className="underline hover:text-slate-600">Privacy</Link>
      <span className="mx-2">·</span>
      <Link href="/voorwaarden" className="underline hover:text-slate-600">Voorwaarden</Link>
      <span className="mx-2">·</span>
      <span>Geen financieel advies</span>
    </div>
  );
}
