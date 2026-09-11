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
    path: "/privacy",
    title: locale === "pt-br" ? "Política de privacidade | Open Economics" : "Privacy policy | Open Economics",
    description: locale === "pt-br" ? "Como o Open Economics trata dados de uso da API, do MCP e do site." : "How Open Economics handles API, MCP, and website usage data.",
  });
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const pt = locale === "pt-br";

  return <main className="atlas-page atlas-utility">
    <SiteHeader locale={locale} />
    <section className="atlas-docs-head compact"><div className="atlas-shell">
      <p className="atlas-kicker">{pt ? "PRIVACIDADE" : "PRIVACY"}</p>
      <h1>{pt ? "Política de privacidade" : "Privacy policy"}</h1>
      <p>{pt ? "Vigente desde 10 de setembro de 2026. Esta política cobre o site, a API pública e o servidor MCP do Open Economics." : "Effective September 10, 2026. This policy covers the Open Economics website, public API, and MCP server."}</p>
    </div></section>
    <div className="atlas-docs-layout atlas-shell">
      <aside className="atlas-docs-nav"><strong>{pt ? "Nesta página" : "On this page"}</strong><a href="#service">{pt ? "Serviço" : "Service"}</a><a href="#data">{pt ? "Dados coletados" : "Data collected"}</a><a href="#use">{pt ? "Como usamos" : "How we use it"}</a><a href="#sharing">{pt ? "Compartilhamento" : "Sharing"}</a><a href="#choices">{pt ? "Suas escolhas" : "Your choices"}</a><a href="#contact">{pt ? "Contato" : "Contact"}</a></aside>
      <article className="atlas-docs-content">
        <section id="service"><p className="atlas-kicker">01 / {pt ? "SERVIÇO" : "SERVICE"}</p><h2>{pt ? "Acesso público, sem conta." : "Public access, with no account."}</h2><p>{pt ? "O Open Economics oferece acesso somente leitura a dados econômicos publicados por órgãos oficiais brasileiros. Não exigimos cadastro, chave de API ou autenticação e não solicitamos nome, e-mail ou dados de pagamento." : "Open Economics provides read-only access to economic data published by official Brazilian agencies. We require no registration, API key, or authentication, and we do not ask for names, email addresses, or payment information."}</p></section>
        <section id="data"><p className="atlas-kicker">02 / {pt ? "DADOS COLETADOS" : "DATA COLLECTED"}</p><h2>{pt ? "Métricas limitadas de uso e confiabilidade." : "Limited usage and reliability metrics."}</h2><p>{pt ? "No site, geramos identificadores aleatórios no navegador para estimar visitantes únicos, sessões e uso repetido. O servidor armazena apenas versões criptograficamente resumidas desses identificadores. Também registramos caminho da página, domínio de referência, parâmetros UTM, idioma, classe de dispositivo, faixas de tempo de carregamento, erros do navegador, pesquisas sanitizadas e ações de produto como executar uma receita ou copiar uma configuração." : "On the website, we generate random browser identifiers to estimate unique visitors, sessions, and repeat use. The server stores only cryptographic hashes of those identifiers. We also record page path, referring domain, UTM parameters, language, device class, loading-time bands, browser errors, sanitized searches, and product actions such as running a recipe or copying configuration."}</p><p>{pt ? "Para solicitações à API e ao MCP, registramos contagens agregadas por rota, status, ferramenta MCP e dia. O Open Economics não armazena o conteúdo completo das respostas nem endereços IP em seu banco de métricas." : "For API and MCP requests, we record aggregate counts by route, status, MCP tool, and day. Open Economics does not store full response content or IP addresses in its metrics database."}</p></section>
        <section id="use"><p className="atlas-kicker">03 / {pt ? "USO" : "USE"}</p><h2>{pt ? "Operar e melhorar o produto." : "Operate and improve the product."}</h2><p>{pt ? "Usamos essas métricas para medir adoção, encontrar falhas, melhorar desempenho, priorizar documentação e proteger a disponibilidade do serviço. Não usamos os dados para publicidade direcionada nem os vendemos." : "We use these metrics to measure adoption, find failures, improve performance, prioritize documentation, and protect service availability. We do not use the data for targeted advertising or sell it."}</p></section>
        <section id="sharing"><p className="atlas-kicker">04 / {pt ? "COMPARTILHAMENTO" : "SHARING"}</p><h2>{pt ? "Infraestrutura e fontes oficiais." : "Infrastructure and official sources."}</h2><p>{pt ? "O serviço é hospedado em infraestrutura Cloudflare por meio do OpenAI Sites. Consultas podem ser encaminhadas aos serviços públicos dos órgãos indicados na resposta, incluindo BCB, IBGE, Tesouro Nacional, MDIC, ANP, EPE, MTE e CVM. Esses provedores processam solicitações segundo seus próprios termos. Podemos divulgar informações quando exigido por lei ou necessário para proteger o serviço." : "The service is hosted on Cloudflare infrastructure through OpenAI Sites. Queries may be forwarded to the public services of agencies named in the response, including BCB, IBGE, Tesouro Nacional, MDIC, ANP, EPE, MTE, and CVM. Those providers process requests under their own terms. We may disclose information when required by law or necessary to protect the service."}</p></section>
        <section id="choices"><p className="atlas-kicker">05 / {pt ? "ESCOLHAS" : "CHOICES"}</p><h2>{pt ? "Controle local e solicitações." : "Local control and requests."}</h2><p>{pt ? "Você pode apagar os dados locais do site nas configurações do navegador ou bloquear o armazenamento local. Para dúvidas ou pedidos relacionados a privacidade, abra uma issue no repositório público. Como não mantemos contas e os identificadores armazenados são resumidos, talvez não seja possível vincular uma métrica a uma pessoa específica." : "You can clear the site’s local data in your browser settings or block local storage. For privacy questions or requests, open an issue in the public repository. Because we do not maintain accounts and stored identifiers are hashed, we may be unable to associate a metric with a specific person."}</p></section>
        <section id="contact"><p className="atlas-kicker">06 / {pt ? "CONTATO" : "CONTACT"}</p><h2>{pt ? "Suporte público e auditável." : "Public, auditable support."}</h2><p>{pt ? "Use o rastreador de issues do Open Economics para perguntas, solicitações de privacidade ou relatos de segurança." : "Use the Open Economics issue tracker for questions, privacy requests, or security reports."}</p><a className="atlas-button" href="https://github.com/felipegambettadesouza6-jpg/open-economics/issues" target="_blank" rel="noreferrer">GitHub Issues ↗</a></section>
      </article>
    </div>
    <SiteFooter locale={locale} />
  </main>;
}
