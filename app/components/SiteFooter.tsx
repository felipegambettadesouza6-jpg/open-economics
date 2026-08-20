/* eslint-disable @next/next/no-html-link-for-pages */

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <a className="brand footer-brand" href="/">
            <span className="brand-mark" aria-hidden="true">OE</span>
            <span>Open Economics</span>
          </a>
          <p>
            A free, open interface for authoritative economic data.
            Brazil first, built to expand.
          </p>
        </div>
        <div className="footer-links">
          <div>
            <strong>Data</strong>
            <a href="/catalog">Catalog</a>
            <a href="/sources">Sources</a>
            <a href="/status">Status</a>
          </div>
          <div>
            <strong>Developers</strong>
            <a href="/docs">Quickstart</a>
            <a href="/docs/api-reference">API reference</a>
            <a href="/playground">Playground</a>
          </div>
          <div>
            <strong>Project</strong>
            <a href="/docs/attribution">Attribution</a>
            <a href="/docs#revisions">Revision policy</a>
            <a href="/api/v1/openapi.json">OpenAPI</a>
          </div>
        </div>
      </div>
      <div className="shell footer-bottom">
        <span>API code released under MIT. Upstream data licenses apply.</span>
        <span>Data is never fabricated · Transformations are disclosed</span>
      </div>
    </footer>
  );
}
