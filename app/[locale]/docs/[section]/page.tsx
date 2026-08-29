import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";
import { isLocale, localized } from "@/lib/i18n";
import { localizedMetadata } from "@/lib/metadata";

const sections = ["api-reference", "errors", "attribution"] as const;

export function generateStaticParams() {
  return ["en", "pt-br"].flatMap((locale) => sections.map((section) => ({ locale, section })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; section: string }> }): Promise<Metadata> {
  const { locale, section } = await params;
  if (!isLocale(locale) || !sections.includes(section as (typeof sections)[number])) return {};
  const pt = locale === "pt-br";
  const copy = section === "api-reference"
    ? { title: pt ? "Referência da API | Open Economics" : "API reference | Open Economics", description: pt ? "Endpoints públicos da Open Economics API, com respostas JSON e CSV." : "Public Open Economics API endpoints with JSON and CSV responses." }
    : section === "errors"
      ? { title: pt ? "Erros da API | Open Economics" : "API errors | Open Economics", description: pt ? "Códigos de erro e respostas Problem Details da Open Economics API." : "Error codes and Problem Details responses from the Open Economics API." }
      : { title: pt ? "Atribuição e licenças | Open Economics" : "Attribution and licensing | Open Economics", description: pt ? "Como preservar autoria, licenças e proveniência ao usar dados oficiais." : "How to preserve authorship, licenses, and provenance when using official data." };
  return localizedMetadata({ locale, path: `/docs/${section}`, ...copy });
}

export default async function ReferencePage({ params }: { params: Promise<{ locale: string; section: string }> }) {
  const { locale: value, section } = await params; if (!isLocale(value) || !sections.includes(section as (typeof sections)[number])) notFound(); const locale = value; const pt = locale === "pt-br";
  const content = section === "api-reference" ? { eyebrow: "API / v1", title: pt ? "Referência da API" : "API reference", intro: pt ? "Endpoints públicos, somente leitura, com JSON e CSV." : "Public, read-only endpoints with JSON and CSV.", rows: [["GET /api/v1/indicators", pt ? "Lista e busca indicadores" : "List and search indicators"], ["GET /api/v1/indicators/{id}", pt ? "Metadados da série" : "Series metadata"], ["GET /api/v1/indicators/{id}/observations", pt ? "Observações por período" : "Range observations"], ["GET /api/v1/indicators/{id}/latest", pt ? "Última observação" : "Latest observation"], ["GET /api/v1/openapi.json", "OpenAPI 3.1"]] } : section === "errors" ? { eyebrow: "Errors / RFC 9457", title: pt ? "Erros explícitos" : "Explicit errors", intro: pt ? "Falhas usam Problem Details; indisponibilidade nunca vira um valor inventado." : "Failures use Problem Details; source unavailability never becomes an invented value.", rows: [["400", pt ? "Parâmetro inválido ou desconhecido" : "Invalid or unknown parameter"], ["404", pt ? "Indicador não encontrado" : "Indicator not found"], ["422", pt ? "Período ou limite inválido" : "Invalid range or limit"], ["502 / 503", pt ? "Fonte oficial indisponível" : "Official source unavailable"]] } : { eyebrow: "Provenance / Licensing", title: pt ? "Atribuição e licenças" : "Attribution and licensing", intro: pt ? "A autoria oficial permanece ligada a cada resposta." : "Official authorship remains attached to every response.", rows: [["BCB / SGS", "Open Data Commons ODbL · series code + source URL"], ["IBGE / SIDRA", pt ? "Atribua tabela, variável e link metodológico" : "Attribute table, variable, and methodology link"], ["Transformations", pt ? "Divulgue toda transformação aplicada" : "Disclose every applied transformation"], ["Retrieved at", pt ? "Preserve o momento de recuperação" : "Preserve the retrieval timestamp"]] };
  return <main className="atlas-page atlas-utility"><SiteHeader locale={locale} /><section className="atlas-docs-head compact"><div className="atlas-shell"><p className="atlas-kicker">{content.eyebrow}</p><h1>{content.title}</h1><p>{content.intro}</p></div></section><div className="atlas-reference atlas-shell"><aside><a href={localized(locale, "/docs")}>← {pt ? "Voltar ao guia" : "Back to guide"}</a><a href="/api/v1/openapi.json">OpenAPI ↗</a></aside><article>{content.rows.map(([label, description]) => <div key={label}><code>{label}</code><p>{description}</p></div>)}</article></div><SiteFooter locale={locale} /></main>;
}
