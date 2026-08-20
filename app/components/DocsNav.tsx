export function DocsNav({ active }: { active: "guide" | "reference" | "errors" | "attribution" }) {
  return (
    <aside className="docs-nav">
      <span>Documentation</span>
      <a className={active === "guide" ? "active" : ""} href="/docs">Quickstart &amp; concepts</a>
      <a className={active === "reference" ? "active" : ""} href="/docs/api-reference">API reference</a>
      <a className={active === "errors" ? "active" : ""} href="/docs/errors">Errors</a>
      <a className={active === "attribution" ? "active" : ""} href="/docs/attribution">Attribution &amp; licenses</a>
      <span>On this page</span>
      {active === "guide" && (
        <>
          <a href="#quickstart">Five-minute quickstart</a>
          <a href="#model">Data model</a>
          <a href="#dates">Dates &amp; periods</a>
          <a href="#revisions">Revisions</a>
          <a href="#caching">Caching &amp; limits</a>
          <a href="#versioning">Versioning</a>
        </>
      )}
      <a className="docs-playground-link" href="/playground">Open playground →</a>
    </aside>
  );
}

