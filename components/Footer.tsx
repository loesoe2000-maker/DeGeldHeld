import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-slate-900 px-6 py-12 text-slate-300">
      <div className="mx-auto max-w-5xl grid gap-8 sm:grid-cols-4">
        <div>
          <div className="text-xl font-bold text-white">DeGeldHeld</div>
          <p className="mt-2 text-sm">
            Automatisch onderhandelen op je Nederlandse maandlasten.
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
          <div className="font-semibold text-white">Besparen</div>
          <ul className="mt-2 space-y-1 text-sm">
            <li><Link href="/telecom-besparen" className="hover:text-brand-300">Telecom besparen</Link></li>
            <li><Link href="/energie-besparen" className="hover:text-brand-300">Energie besparen</Link></li>
            <li><Link href="/verzekering-besparen" className="hover:text-brand-300">Verzekering besparen</Link></li>
            <li><Link href="/hypotheek-besparen" className="hover:text-brand-300">Hypotheek besparen</Link></li>
            <li><Link href="/onderhandelen-met-kpn" className="hover:text-brand-300">Onderhandelen met KPN</Link></li>
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
        © {new Date().getFullYear()} DeGeldHeld B.V. — KvK 00000000 — Geen financieel advies.
      </div>
    </footer>
  );
}
