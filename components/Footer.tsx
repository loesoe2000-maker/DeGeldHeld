import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-slate-900 px-6 py-12 text-slate-300">
      <div className="mx-auto max-w-5xl grid gap-8 sm:grid-cols-3">
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
            <li><Link href="/api/proof" className="hover:text-brand-300">Track record</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold text-white">Juridisch</div>
          <ul className="mt-2 space-y-1 text-sm">
            <li><Link href="/voorwaarden" className="hover:text-brand-300">Voorwaarden</Link></li>
            <li><Link href="/privacy" className="hover:text-brand-300">Privacy</Link></li>
            <li><a href="mailto:hallo@degeldheld.com" className="hover:text-brand-300">Contact</a></li>
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-5xl border-t border-slate-700 pt-6 text-xs text-slate-400">
        © {new Date().getFullYear()} DeGeldHeld B.V. — KvK 00000000 — Geen financieel advies.
      </div>
    </footer>
  );
}
