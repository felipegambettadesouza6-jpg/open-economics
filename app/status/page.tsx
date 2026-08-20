import type { Metadata } from "next";
import { ApiStatus } from "@/app/components/ApiStatus";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";

export const metadata: Metadata = {
  title: "API status | Open Economics API",
  description: "Live readiness checks for the Open Economics API, IBGE Aggregates, and Banco Central do Brasil SGS.",
};

export default function StatusPage() {
  return (
    <main>
      <SiteHeader />
      <section className="page-hero status-hero shell">
        <div>
          <p className="eyebrow"><span /> Live status</p>
          <h1>Trust starts with<br /><em>visible failure states.</em></h1>
        </div>
        <p>
          The checks below call this deployment and representative official-source series.
          Outages and stale snapshots are shown instead of hidden.
        </p>
      </section>
      <section className="status-page shell">
        <ApiStatus />
        <div className="status-notes">
          <div><strong>Readiness</strong><p>The health endpoint checks routing and catalog integrity without amplifying traffic to official publishers.</p></div>
          <div><strong>Publisher checks</strong><p>One IBGE and one BCB request confirm real normalization paths and source reachability.</p></div>
          <div><strong>Stale fallback</strong><p>A last-known-good database snapshot is labeled with <code>meta.stale</code> and HTTP Warning 110.</p></div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

