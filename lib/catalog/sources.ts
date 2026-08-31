import type { SourceDefinition } from "@/lib/domain/types";

export const sources: SourceDefinition[] = [
  {
    id: "bcb",
    name: "Banco Central do Brasil",
    shortName: "BCB",
    description:
      "Brazil's central bank publishes monetary, credit, fiscal, external-sector, and financial time series through its open-data services.",
    homepage: "https://www.bcb.gov.br/",
    catalogUrl: "https://dadosabertos.bcb.gov.br/",
    license: "Open Data Commons Open Database License (ODbL)",
    licenseUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
    attribution: "Source: Banco Central do Brasil (BCB).",
  },
  {
    id: "ibge",
    name: "Instituto Brasileiro de Geografia e Estatística",
    shortName: "IBGE",
    description:
      "Brazil's official statistics institute publishes national accounts, prices, industry, commerce, services, and labor-market data.",
    homepage: "https://www.ibge.gov.br/",
    catalogUrl: "https://servicodados.ibge.gov.br/api/docs/agregados?versao=3",
    license: "IBGE terms of use",
    licenseUrl: "https://www.ibge.gov.br/termos-de-uso.html",
    attribution: "Source: IBGE. Preserve the official series name and reference period.",
  },
];

export function getSource(id: string) {
  return sources.find((source) => source.id === id);
}

