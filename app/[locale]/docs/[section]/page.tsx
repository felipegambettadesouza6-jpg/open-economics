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
  const content = section === "api-reference"
    ? { eyebrow: "API / v2 + v1", title: pt ? "Referência da API" : "API reference", intro: pt ? "Descoberta semântica e dados multidimensionais na v2; atalhos de séries compatíveis na v1." : "Semantic discovery and multidimensional data in v2; compatible series shortcuts in v1.", rows: [["GET /api/v2/search", pt ? "Resolve uma necessidade e encontra dados oficiais" : "Resolve a need and find official data"], ["GET /api/v2/datasets/{id}/schema", pt ? "Medidas, dimensões, unidade e metodologia" : "Measures, dimensions, unit, and methodology"], ["GET /api/v2/datasets/{id}/observations", pt ? "Consulta a seleção oficial explícita" : "Query the explicit official selection"], ["POST /api/mcp", pt ? "Dezenove ferramentas MCP somente leitura" : "Nineteen read-only MCP tools"], ["GET /api/v1/indicators/{id}/observations", pt ? "Atalho compatível de série estável" : "Compatible stable-series shortcut"], ["GET /api/v2/openapi.json", "OpenAPI 3.1"]] }
    : section === "errors"
      ? { eyebrow: "Errors / RFC 9457", title: pt ? "Erros explícitos" : "Explicit errors", intro: pt ? "Falhas usam Problem Details; indisponibilidade nunca vira um valor inventado." : "Failures use Problem Details; source unavailability never becomes an invented value.", rows: [["400", pt ? "Parâmetro inválido ou dimensão ausente" : "Invalid parameter or missing dimension"], ["404", pt ? "Indicador ou conjunto não encontrado" : "Indicator or dataset not found"], ["unresolved", pt ? "A necessidade não atingiu o limiar de confiança" : "The need did not clear the confidence threshold"], ["source-not-integrated", pt ? "Conceito entendido, fonte ainda sem integração" : "Concept understood, source not integrated yet"], ["502 / 503", pt ? "Fonte oficial indisponível" : "Official source unavailable"]] }
      : { eyebrow: "Provenance / Licensing", title: pt ? "Atribuição e licenças" : "Attribution and licensing", intro: pt ? "A autoria oficial permanece ligada a cada resposta." : "Official authorship remains attached to every response.", rows: [["BCB / SGS", "Open Data Commons ODbL · series code + source URL"], ["IBGE / SIDRA", pt ? "Atribua tabela, variável e link metodológico" : "Attribute table, variable, and methodology link"], ["Tesouro / SICONFI", pt ? "Preserve ente, período, anexo, conta, coluna e valor oficial" : "Preserve entity, period, annex, account, column, and official value"], ["Tesouro / RTN", pt ? "Preserve conta, hierarquia, período, unidade, base fiscal e versão" : "Preserve account, hierarchy, period, unit, fiscal basis, and version"], ["Tesouro / RMD", pt ? "Preserve tabela, categoria, período, unidade, notas e versão" : "Preserve table, category, period, unit, footnotes, and version"], ["MDIC / Comex Stat", pt ? "Preserve fluxo, período, códigos, dimensões e métricas" : "Preserve flow, period, codes, dimensions, and metrics"], ["ANP / LPC", pt ? "Preserve produto, geografia, amostra, unidade e transformação" : "Preserve product, geography, sample, unit, and transformation"], ["EPE / Consumo", pt ? "Preserve período, UF, classe, mercado, medida e versão" : "Preserve period, state, class, market, measure, and version"], ["MTE / Novo Caged", pt ? "Preserve período, estoque versus fluxos, recorte, ajuste e versão" : "Preserve period, stock-versus-flow meaning, breakdown, adjustment, and version"], ["CVM / Informe Diário", pt ? "Preserve fundo/classe, data, medida, unidade, completude e versão" : "Preserve fund/class, date, measure, unit, completeness, and version"], ["Transformations", pt ? "Divulgue toda transformação aplicada" : "Disclose every transformation applied"], ["Retrieved at", pt ? "Preserve o momento de recuperação" : "Preserve the retrieval timestamp"]] };
  return <main className="atlas-page atlas-utility"><SiteHeader locale={locale} /><section className="atlas-docs-head compact"><div className="atlas-shell"><p className="atlas-kicker">{content.eyebrow}</p><h1>{content.title}</h1><p>{content.intro}</p></div></section><div className="atlas-reference atlas-shell"><aside><a href={localized(locale, "/docs")}>← {pt ? "Voltar ao guia" : "Back to guide"}</a><a href="/api/v2/openapi.json">OpenAPI v2 ↗</a><a href="/api/v1/openapi.json">OpenAPI v1 ↗</a></aside><article>{content.rows.map(([label, description]) => <div key={label}><code>{label}</code><p>{description}</p></div>)}</article></div><SiteFooter locale={locale} /></main>;
}
