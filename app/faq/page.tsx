import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";

export const metadata = { title: "FAQ — DeGeldHeld" };

export default function FAQPage() {
  return (
    <>
      <header className="bg-brand-50 px-6 py-12 text-center">
        <h1 className="text-4xl font-bold text-brand-700">Veelgestelde vragen</h1>
        <p className="mt-2 text-slate-600">Antwoorden op de meest gestelde vragen</p>
      </header>
      <FAQ />
      <Footer />
    </>
  );
}
