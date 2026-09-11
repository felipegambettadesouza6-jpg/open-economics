import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";
import { isLocale, type Locale } from "@/lib/i18n";
import { localizedMetadata } from "@/lib/metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return localizedMetadata({
    locale,
    path: "/terms",
    title: locale === "pt-br" ? "Termos de uso | Open Economics" : "Terms of use | Open Economics",
    description: locale === "pt-br" ? "Termos para usar o site, a API pública e o servidor MCP do Open Economics." : "Terms for using the Open Economics website, public API, and MCP server.",
  });
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const pt = locale === "pt-br";

  return <main className="atlas-page atlas-utility">
    <SiteHeader locale={locale} />
    <section className="atlas-docs-head compact"><div className="atlas-shell">
      <p className="atlas-kicker">{pt ? "TERMOS" : "TERMS"}</p>
      <h1>{pt ? "Termos de uso" : "Terms of use"}</h1>
      <p>{pt ? "Vigentes desde 10 de setembro de 2026. Ao usar o site, a API ou o MCP, você concorda com estes termos." : "Effective September 10, 2026. By using the website, API, or MCP server, you agree to these terms."}</p>
    </div></section>
    <div className="atlas-docs-layout atlas-shell">
      <aside className="atlas-docs-nav"><strong>{pt ? "Nesta página" : "On this page"}</strong><a href="#service">{pt ? "Serviço" : "Service"}</a><a href="#sources">{pt ? "Fontes" : "Sources"}</a><a href="#acceptable-use">{pt ? "Uso aceitável" : "Acceptable use"}</a><a href="#availability">{pt ? "Disponibilidade" : "Availability"}</a><a href="#warranty">{pt ? "Garantias" : "Warranties"}</a><a href="#contact">{pt ? "Contato" : "Contact"}</a></aside>
      <article className="atlas-docs-content">
        <section id="service"><p className="atlas-kicker">01 / {pt ? "SERVIÇO" : "SERVICE"}</p><h2>{pt ? "Dados para pesquisa e construção." : "Data for research and building."}</h2><p>{pt ? "O Open Economics fornece acesso gratuito e somente leitura a dados econômicos oficiais. Você pode usar a API e o MCP em análises, aplicativos, agentes e materiais publicados, sujeito a estes termos e às licenças das fontes." : "Open Economics provides free, read-only access to official economic data. You may use the API and MCP in analysis, applications, agents, and published material, subject to these terms and source licenses."}</p></section>
        <section id="sources"><p className="atlas-kicker">02 / {pt ? "FONTES" : "SOURCES"}</p><h2>{pt ? "A autoria permanece com cada publicador." : "Each publisher retains authorship."}</h2><p>{pt ? "O Open Economics normaliza o acesso, mas não produz nem endossa os dados oficiais. Preserve a fonte, o identificador, a unidade, o período, a metodologia e os avisos devolvidos pelo serviço. As licenças e os termos do órgão publicador continuam aplicáveis." : "Open Economics normalizes access but does not produce or endorse the official data. Preserve the source, identifier, unit, period, methodology, and warnings returned by the service. The publishing agency’s licenses and terms continue to apply."}</p></section>
        <section id="acceptable-use"><p className="atlas-kicker">03 / {pt ? "USO ACEITÁVEL" : "ACCEPTABLE USE"}</p><h2>{pt ? "Compartilhe a infraestrutura." : "Share the infrastructure."}</h2><p>{pt ? "Não tente interromper, sobrecarregar, contornar limites, sondar vulnerabilidades ou usar o serviço de forma ilegal. Use cache, intervalos limitados e concorrência razoável. Podemos limitar ou bloquear tráfego abusivo para manter o acesso público." : "Do not attempt to disrupt or overload the service, evade limits, probe vulnerabilities, or use it unlawfully. Use caching, bounded date ranges, and reasonable concurrency. We may rate-limit or block abusive traffic to preserve public access."}</p></section>
        <section id="availability"><p className="atlas-kicker">04 / {pt ? "DISPONIBILIDADE" : "AVAILABILITY"}</p><h2>{pt ? "Um serviço público em evolução." : "An evolving public service."}</h2><p>{pt ? "Podemos alterar rotas, ferramentas, limites ou cobertura, e interromper o serviço para manutenção. Procuramos manter contratos versionados e estados de erro explícitos, mas não prometemos disponibilidade contínua nem atualização imediata das fontes." : "We may change routes, tools, limits, or coverage and interrupt the service for maintenance. We aim to keep versioned contracts and explicit error states, but do not promise uninterrupted availability or immediate upstream updates."}</p></section>
        <section id="warranty"><p className="atlas-kicker">05 / {pt ? "GARANTIAS" : "WARRANTIES"}</p><h2>{pt ? "Verifique decisões importantes na fonte." : "Verify consequential decisions at the source."}</h2><p>{pt ? "O serviço e os dados são fornecidos como estão, sem garantias de precisão, completude, adequação a uma finalidade ou ausência de erros. Eles não constituem aconselhamento financeiro, jurídico, tributário ou de investimento. Na extensão permitida por lei, o projeto não responde por perdas decorrentes do uso ou da indisponibilidade do serviço." : "The service and data are provided as is, without warranties of accuracy, completeness, fitness for a purpose, or freedom from errors. They are not financial, legal, tax, or investment advice. To the extent permitted by law, the project is not liable for losses resulting from use or unavailability of the service."}</p></section>
        <section id="contact"><p className="atlas-kicker">06 / {pt ? "CONTATO" : "CONTACT"}</p><h2>{pt ? "Perguntas e problemas." : "Questions and problems."}</h2><p>{pt ? "Abra uma issue pública para suporte, correções de dados, privacidade ou segurança." : "Open a public issue for support, data corrections, privacy, or security."}</p><a className="atlas-button" href="https://github.com/felipegambettadesouza6-jpg/open-economics/issues" target="_blank" rel="noreferrer">GitHub Issues ↗</a></section>
      </article>
    </div>
    <SiteFooter locale={locale} />
  </main>;
}
