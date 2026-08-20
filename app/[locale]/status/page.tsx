import { notFound } from "next/navigation";
import { ApiStatus } from "@/app/components/ApiStatus";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";
import { isLocale } from "@/lib/i18n";

export default async function StatusPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: value } = await params; if (!isLocale(value)) notFound(); const locale = value; const pt = locale === "pt-br";
  return <main className="atlas-page atlas-utility"><SiteHeader locale={locale} /><section className="atlas-page-hero atlas-shell compact"><p className="atlas-kicker">07 / Live status</p><div><h1>{pt ? "Falhas também são dados." : "Failure is data, too."}</h1><p>{pt ? "Verificações reais desta implantação e das fontes oficiais. Indisponibilidade e snapshots desatualizados nunca ficam escondidos." : "Real checks of this deployment and official sources. Outages and stale snapshots are never hidden."}</p></div></section><section className="atlas-status-page atlas-shell"><ApiStatus locale={locale} /><div className="status-principles"><div><span>01</span><b>Readiness</b><p>{pt ? "Roteamento e integridade do catálogo." : "Routing and catalog integrity."}</p></div><div><span>02</span><b>Publishers</b><p>{pt ? "Uma requisição IBGE e uma BCB." : "One IBGE and one BCB request."}</p></div><div><span>03</span><b>Stale</b><p>{pt ? "Snapshot anterior sempre identificado." : "Prior snapshots are always labeled."}</p></div></div></section><SiteFooter locale={locale} /></main>;
}
