import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CopyButton } from "@/app/components/CopyButton";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";
import { isLocale, localized, type Locale } from "@/lib/i18n";

const endpoint = "https://open-economics-data.knbf982hkn.chatgpt.site/api/mcp";
const config = JSON.stringify({ mcpServers: { "open-economics": { type: "http", url: endpoint } } }, null, 2);

export const metadata: Metadata = {
  title: "Open Economics MCP server — 19 tools for official Brazilian data",
  description: "Connect an AI client to 19 read-only tools for official Brazilian economic and financial data. Public remote MCP, no key required.",
};

export default async function McpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const pt = locale === "pt-br";
  return <main className="atlas-page mcp-page"><SiteHeader locale={locale} />
    <section className="mcp-hero atlas-shell">
      <div><p className="atlas-kicker">REMOTE MCP · PUBLIC · READ-ONLY</p><h1>{pt ? <>Dados oficiais do Brasil,<br /><em>prontos para agentes.</em></> : <>Brazil’s official data,<br /><em>ready for agents.</em></>}</h1><p>{pt ? "Dezenove ferramentas para encontrar o conjunto correto, verificar seu significado e consultar a fonte oficial. Sem chave de API." : "Nineteen tools to find the right dataset, verify its meaning, and query the official source. No API key required."}</p></div>
      <aside><span>{pt ? "ENDPOINT DO SERVIDOR" : "SERVER ENDPOINT"}</span><code>{endpoint}</code><CopyButton value={endpoint} label={pt ? "Copiar endpoint" : "Copy endpoint"} successLabel={pt ? "Endpoint copiado" : "Endpoint copied"} activation="mcp_config_copy" /><small>{pt ? "Streamable HTTP · MCP 2025-11-25" : "Streamable HTTP · MCP 2025-11-25"}</small></aside>
    </section>
    <section className="mcp-connect atlas-shell">
      <div><p className="atlas-kicker">01 / {pt ? "CONECTAR" : "CONNECT"}</p><h2>{pt ? "Cole uma URL. Comece pela busca." : "Paste one URL. Start with search."}</h2><p>{pt ? "Adicione o servidor remoto ao seu cliente MCP. Clientes que usam configuração JSON aceitam este formato; em outros, informe apenas o endpoint acima." : "Add the remote server to your MCP client. Clients that use JSON configuration accept this shape; in others, provide the endpoint above."}</p></div>
      <div className="mcp-code"><header><span>mcp.json</span><CopyButton value={config} label={pt ? "Copiar configuração" : "Copy config"} successLabel={pt ? "Configuração copiada" : "Config copied"} activation="mcp_config_copy" /></header><pre><code>{config}</code></pre></div>
    </section>
    <section className="mcp-workflow atlas-shell">
      <p className="atlas-kicker">02 / {pt ? "FLUXO CONFIÁVEL" : "RELIABLE WORKFLOW"}</p>
      <div><article><span>01</span><h3>search_official_data</h3><p>{pt ? "Resolva a necessidade em português ou inglês sem adivinhar uma série próxima." : "Resolve the need in Portuguese or English without guessing a nearby series."}</p></article><article><span>02</span><h3>{pt ? "Inspecionar schema" : "Inspect the schema"}</h3><p>{pt ? "Confirme medida, dimensão, unidade, período e metodologia antes da consulta." : "Confirm measure, dimensions, unit, period, and methodology before querying."}</p></article><article><span>03</span><h3>{pt ? "Consultar a fonte" : "Query the source"}</h3><p>{pt ? "Receba observações com valores brutos, IDs oficiais e links de proveniência." : "Receive observations with raw values, official IDs, and provenance links."}</p></article></div>
    </section>
    <section className="mcp-prompts atlas-shell" data-nav-theme="dark"><div><p className="atlas-kicker">03 / {pt ? "TESTE AGORA" : "TRY IT NOW"}</p><h2>{pt ? "Três perguntas que atravessam fontes diferentes." : "Three questions across different sources."}</h2><a href={localized(locale, "/ask")}>{pt ? "Executar no navegador" : "Run in the browser"}<span>→</span></a></div><ul><li>{pt ? "Qual é a meta Selic atual e quando ela passou a valer?" : "What is the current Selic target and when did it take effect?"}</li><li>{pt ? "Compare o saldo de empregos formais de SP e MG em 2025." : "Compare formal-employment balances in SP and MG during 2025."}</li><li>{pt ? "Encontre a série oficial de desemprego do Brasil e explique sua unidade." : "Find Brazil’s official unemployment series and explain its unit."}</li></ul></section>
    <SiteFooter locale={locale} />
  </main>;
}
