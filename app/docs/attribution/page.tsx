import type { Metadata } from "next";
import { DocsNav } from "@/app/components/DocsNav";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";

export const metadata: Metadata = {
  title: "Attribution and licenses | Open Economics API",
  description: "Publisher attribution, upstream licenses, derived-data obligations, and usage guidance.",
};

export default function AttributionPage() {
  return (
    <main>
      <SiteHeader />
      <section className="docs-hero compact-docs-hero">
        <div className="shell">
          <p className="eyebrow"><span /> Data policy</p>
          <h1>Open data still has<br /><em>a source.</em></h1>
          <p>Open Economics keeps publisher credit and license context attached to every series.</p>
        </div>
      </section>
      <div className="docs-layout shell">
        <DocsNav active="attribution" />
        <article className="docs-content">
          <section>
            <p className="kicker">Core rule</p>
            <h2>Attribute the official publisher</h2>
            <p>
              API code and documentation are separate from upstream datasets. Each API response identifies
              the publisher, official series/table and variable, source link, data license or terms, retrieval
              time, and any transformation. Downstream users should preserve that context.
            </p>
          </section>
          <section>
            <h2>Banco Central do Brasil</h2>
            <div className="license-card">
              <div><span>Recommended credit</span><strong>Source: Banco Central do Brasil (BCB), SGS series [code].</strong></div>
              <div><span>Catalog</span><a href="https://dadosabertos.bcb.gov.br/" target="_blank" rel="noreferrer">dadosabertos.bcb.gov.br ↗</a></div>
              <div><span>License</span><a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">Open Data Commons ODbL 1.0 ↗</a></div>
            </div>
            <p>
              The selected BCB catalog entries explicitly report ODbL. That license includes attribution
              and share-alike obligations for adapted databases. Consult the license for your use; this page
              is practical guidance, not legal advice.
            </p>
          </section>
          <section>
            <h2>IBGE / SIDRA</h2>
            <div className="license-card">
              <div><span>Recommended credit</span><strong>Source: IBGE/SIDRA, table [table], variable [variable].</strong></div>
              <div><span>API documentation</span><a href="https://servicodados.ibge.gov.br/api/docs/agregados?versao=3" target="_blank" rel="noreferrer">IBGE Aggregates API v3 ↗</a></div>
              <div><span>Usage</span><a href="https://www.ibge.gov.br/termos-de-uso.html" target="_blank" rel="noreferrer">IBGE terms of use ↗</a></div>
            </div>
            <p>
              IBGE aggregate responses do not expose an SPDX or per-table license field. Open Economics
              therefore links the official terms and does not relabel IBGE data as ODbL or Creative Commons.
              Preserve the official series name, reference period, and methodology link.
            </p>
          </section>
          <section>
            <p className="kicker">Transformations</p>
            <h2>Do not hide the math</h2>
            <p>
              Current catalog series expose source values without mathematical transformations. When derived
              measures are added, responses will name every operation and preserve the upstream value path.
              Resampling, seasonal adjustment, sign inversion, forward-filling, and currency conversion are
              never implicit.
            </p>
            <div className="docs-callout">
              <strong>Fiscal sign convention</strong>
              BCB NFSP series 5793 and 5727 use financing-requirement semantics: a positive value indicates
              a financing need. Open Economics preserves that sign and does not silently present it as a surplus.
            </div>
          </section>
          <section>
            <p className="kicker">Project license</p>
            <h2>API implementation</h2>
            <p>
              The software in this repository is prepared for release under the MIT License. This does not
              replace, sublicense, or override the terms attached to upstream databases.
            </p>
          </section>
        </article>
      </div>
      <SiteFooter />
    </main>
  );
}

