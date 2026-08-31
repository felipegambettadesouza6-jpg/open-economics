import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Playground } from "@/app/components/Playground";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";
import { indicators } from "@/lib/catalog/indicators";
import { isLocale } from "@/lib/i18n";
import { localizedMetadata } from "@/lib/metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return localizedMetadata({
    locale,
    path: "/playground",
    title: locale === "pt-br" ? "Playground da API | Open Economics" : "API playground | Open Economics",
    description: locale === "pt-br" ? "Monte, execute, entenda e compartilhe uma requisição real da Open Economics API." : "Build, execute, understand, and share a real Open Economics API request.",
  });
}
export default async function PlaygroundPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: value } = await params; if (!isLocale(value)) notFound(); const locale = value; const pt = locale === "pt-br";
  const options = indicators.map((indicator) => ({ id: indicator.id, name: indicator.name, officialName: indicator.officialName, source: indicator.sourceAgency, frequency: indicator.frequency }));
  return <main className="atlas-page atlas-utility"><SiteHeader locale={locale} /><section className="atlas-page-hero atlas-shell compact"><p className="atlas-kicker">04 / API playground</p><div><h1>{pt ? "Monte. Execute. Entenda." : "Build it. Run it. Understand it."}</h1><p>{pt ? "Uma requisição real, seus parâmetros, código e resposta em um único espaço compartilhável." : "One real request, its parameters, code, and response in a single shareable workspace."}</p></div></section><section className="atlas-playground atlas-shell"><Playground indicators={options} locale={locale} /></section><SiteFooter locale={locale} /></main>;
}
