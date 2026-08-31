import { SITE_ORIGIN } from "@/lib/metadata";

export function GET() {
  return new Response(
    `User-agent: *\nAllow: /\nAllow: /api/v1/openapi.json\nDisallow: /api/\nDisallow: /_events\nSitemap: ${SITE_ORIGIN}/sitemap.xml\nHost: ${SITE_ORIGIN}\n`,
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400", "Content-Type": "text/plain; charset=utf-8" } },
  );
}
