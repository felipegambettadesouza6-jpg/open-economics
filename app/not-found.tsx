/* eslint-disable @next/next/no-html-link-for-pages */
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";

export default function NotFound() {
  return (
    <main>
      <SiteHeader />
      <section className="not-found shell">
        <span>404</span>
        <h1>This series<br /><em>isn&apos;t in the catalog.</em></h1>
        <p>Search the current indicator IDs, names, Portuguese aliases, and official source codes.</p>
        <div>
          <a className="button primary" href="/catalog">Search the catalog →</a>
          <a className="button secondary" href="/docs/api-reference">API reference</a>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
