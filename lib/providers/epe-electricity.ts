import snapshot from "@/lib/catalog/generated/epe-electricity.generated.json";

export const EPE_ELECTRICITY_CLASSES = ["Comercial", "Industrial", "Outros", "Residencial", "Rural"] as const;
export const EPE_ELECTRICITY_MARKETS = ["Cativo", "Livre"] as const;
export const EPE_ELECTRICITY_GEOGRAPHIES = ["country", "region", "state"] as const;

export type EpeElectricityClass = (typeof EPE_ELECTRICITY_CLASSES)[number];
export type EpeElectricityMarket = (typeof EPE_ELECTRICITY_MARKETS)[number];
export type EpeElectricityGeography = (typeof EPE_ELECTRICITY_GEOGRAPHIES)[number];

type CompactRow = [string, string, string, EpeElectricityClass, EpeElectricityMarket, number, number];

interface EpeSnapshot {
  schema_version: number;
  synced_at: string;
  source_version: string;
  source_url: string;
  source_page: string;
  columns: string[];
  rows: CompactRow[];
}

export interface EpeElectricitySelection {
  from: string;
  to: string;
  geography: EpeElectricityGeography;
  states: string[];
  regions: string[];
  classes: EpeElectricityClass[];
  markets: EpeElectricityMarket[];
}

const data = snapshot as EpeSnapshot;

export const epeElectricityMetadata = {
  schemaVersion: data.schema_version,
  syncedAt: data.synced_at,
  sourceVersion: data.source_version,
  sourceUrl: data.source_url,
  sourcePage: data.source_page,
  startPeriod: data.rows[0]?.[0] ?? null,
  endPeriod: data.rows.at(-1)?.[0] ?? null,
  sourceRows: data.rows.length,
};

function rounded(value: number) {
  return Number(value.toFixed(3));
}

export function queryEpeElectricity(selection: EpeElectricitySelection) {
  const states = new Set(selection.states);
  const regions = new Set(selection.regions);
  const classes = new Set(selection.classes);
  const markets = new Set(selection.markets);
  const aggregates = new Map<string, {
    period: string;
    geography: { level: EpeElectricityGeography; id: string; name: string; region: string | null };
    electricityClass: EpeElectricityClass;
    market: EpeElectricityMarket;
    consumption: number;
    consumers: number;
    sourceRows: number;
  }>();

  for (const [period, state, region, electricityClass, market, consumption, consumers] of data.rows) {
    if (period < selection.from.replace("-", "") || period > selection.to.replace("-", "")) continue;
    if (states.size && !states.has(state)) continue;
    if (regions.size && !regions.has(region)) continue;
    if (classes.size && !classes.has(electricityClass)) continue;
    if (markets.size && !markets.has(market)) continue;
    const geography = selection.geography === "country"
      ? { level: "country" as const, id: "BR", name: "Brasil", region: null }
      : selection.geography === "region"
        ? { level: "region" as const, id: region, name: region, region }
        : { level: "state" as const, id: state, name: state, region };
    const key = [period, geography.level, geography.id, electricityClass, market].join("|");
    const current = aggregates.get(key) ?? { period, geography, electricityClass, market, consumption: 0, consumers: 0, sourceRows: 0 };
    current.consumption += consumption;
    current.consumers += consumers;
    current.sourceRows += 1;
    aggregates.set(key, current);
  }

  return [...aggregates.values()]
    .sort((left, right) => left.period.localeCompare(right.period) || left.geography.id.localeCompare(right.geography.id) || left.electricityClass.localeCompare(right.electricityClass) || left.market.localeCompare(right.market))
    .map((row) => ({
      period: `${row.period.slice(0, 4)}-${row.period.slice(4)}`,
      date: `${row.period.slice(0, 4)}-${row.period.slice(4)}-01`,
      geography: row.geography,
      class: row.electricityClass,
      market: row.market,
      consumption_mwh: rounded(row.consumption),
      consumers: row.consumers,
      source_rows: row.sourceRows,
    }));
}
