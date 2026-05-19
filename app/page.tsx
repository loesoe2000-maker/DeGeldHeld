import Hero from "@/components/Hero";
import Problem from "@/components/Problem";
import HowItWorks from "@/components/HowItWorks";
import Examples from "@/components/Examples";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";
import ActivityFeed from "@/components/ActivityFeed";

const APP_URL = process.env.APP_URL ?? "https://degeldheld.com";

const organisationLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "DeGeldHeld",
  url: APP_URL,
  email: "hallo@degeldheld.com",
  description:
    "Automatisch onderhandelen op je Nederlandse maandlasten met AI.",
};

const websiteLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "DeGeldHeld",
  url: APP_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: `${APP_URL}/onderhandel?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organisationLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteLd) }}
      />
      <Hero />
      <Problem />
      <HowItWorks />
      <Examples />
      <FAQ />
      <Footer />
      <ActivityFeed />
    </>
  );
}
