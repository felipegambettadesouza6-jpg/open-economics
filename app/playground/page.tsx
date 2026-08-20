import type { Metadata } from "next";
import { Playground } from "@/app/components/Playground";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";
import { indicators } from "@/lib/catalog/indicators";

export const metadata: Metadata = {
  title: "API playground | Open Economics API",
  description: "Build and execute real Open Economics API requests, inspect responses, and copy working code examples.",
};

export default function PlaygroundPage() {
  const options = indicators.map((indicator) => ({
    id: indicator.id,
    name: indicator.name,
    source: indicator.sourceAgency,
    frequency: indicator.frequency,
  }));

  return (
    <main>
      <SiteHeader />
      <section className="page-hero playground-hero shell">
        <div>
          <p className="eyebrow"><span /> Interactive API explorer</p>
          <h1>Build it. Run it.<br /><em>Understand it.</em></h1>
        </div>
        <p>
          Execute real read-only requests against official data. The URL, response,
          headers, timing, and code examples all come from the same state.
        </p>
      </section>
      <section className="playground-shell shell">
        <Playground indicators={options} />
      </section>
      <SiteFooter />
    </main>
  );
}

