import { notFound } from "next/navigation";
import { ApiStatus } from "@/app/components/ApiStatus";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";
import { isLocale } from "@/lib/i18n";

export default async function StatusPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: value } = await params; if (!isLocale(value)) notFound(); const locale = value; const pt = locale === "pt-br";
  return <main className="atlas-page atlas-utility"><SiteHeader locale={locale} /><section className="atlas-page-hero atlas-shell compact"><p className="atlas-kicker">07 / {pt ? "Status ao vivo" : "Live status"}</p><div><h1>{pt ? "Falhas também são dados." : "Failure is data, too."}</h1><p>{pt ? "Verificações reais desta implantação e das fontes oficiais. Indisponibilidade e snapshots desatualizados nunca ficam escondidos." : "Real checks of this deployment and official sources. Outages and stale snapshots are never hidden."}</p></div></section><section className="atlas-status-page atlas-shell"><ApiStatus locale={locale} /></section><SiteFooter locale={locale} /></main>;
}
