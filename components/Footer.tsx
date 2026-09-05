import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-slate-900 px-6 py-12 text-slate-300">
      <div className="mx-auto max-w-5xl grid gap-8 sm:grid-cols-4">
        <div>
          <div className="text-xl font-bold text-white">DeGeldHeld</div>
          <p className="mt-2 text-sm">
            Vind het geld dat je laat liggen — onderhandel je rekeningen, check
            je toeslagen, claim wat je terug krijgt.
          </p>
        </div>
        <div>
          <div className="font-semibold text-white">Product</div>
          <ul className="mt-2 space-y-1 text-sm">
            <li><a href="#hoe-werkt-het" className="hover:text-brand-300">Hoe werkt het</a></li>
            <li><a href="#voorbeelden" className="hover:text-brand-300">Voorbeelden</a></li>
            <li><Link href="/faq" className="hover:text-brand-300">FAQ</Link></li>
            <li><Link href="/proof" className="hover:text-brand-300">Track record</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold text-white">Vind je geld</div>
          <ul className="mt-2 space-y-1 text-sm">
            <li><Link href="/zorgtoeslag-2026-misgelopen" className="hover:text-brand-300">Toeslagen-check</Link></li>
            <li><Link href="/box3-rechtsherstel-aanvragen-2026" className="hover:text-brand-300">Box 3-rechtsherstel</Link></li>
            <li><Link href="/ns-geld-terug-vertraging" className="hover:text-brand-300">NS-vertraging</Link></li>
            <li><Link href="/zorgkostenaftrek-aangifte-2026" className="hover:text-brand-300">Zorgkostenaftrek</Link></li>
            <li><Link href="/energie-besparen" className="hover:text-brand-300">Energie-onderhandeling</Link></li>
            <li><Link href="/vind-al-je-geld" className="font-semibold text-brand-300 hover:text-brand-200">→ Alles op één plek</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold text-white">Juridisch</div>
          <ul className="mt-2 space-y-1 text-sm">
            <li><Link href="/voorwaarden" className="hover:text-brand-300">Voorwaarden</Link></li>
            <li><Link href="/privacy" className="hover:text-brand-300">Privacy</Link></li>
            <li><Link href="/over-ons" className="hover:text-brand-300">Over ons</Link></li>
            <li><Link href="/contact" className="hover:text-brand-300">Contact</Link></li>
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-5xl border-t border-slate-700 pt-6 text-xs text-slate-400">
        © {new Date().getFullYear()} DeGeldHeld — Techz B.V. — KvK 84079398 — Indicatie, geen financieel advies.
      </div>
    </footer>
  );
}
