/* eslint-disable @next/next/no-html-link-for-pages */

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell nav">
        <a className="brand" href="/" aria-label="Open Economics API home">
          <span className="brand-mark" aria-hidden="true">OE</span>
          <span>Open Economics</span>
        </a>
        <nav className="nav-links" aria-label="Primary navigation">
          <a href="/catalog">Data catalog</a>
          <a href="/docs">Docs</a>
          <a href="/playground">Playground</a>
          <a href="/sources">Sources</a>
        </nav>
        <a className="status-link" href="/status">
          <span className="status-dot" aria-hidden="true" />
          API status
        </a>
      </div>
    </header>
  );
}
