import snapshot from "@/lib/catalog/generated/tesouro-dpf.generated.json";

export const TESOURO_DPF_TABLES = ["composition", "holders", "average-maturity", "average-maturity-by-indexer", "monthly-cost", "twelve-month-cost"] as const;
export type TesouroDpfTable = (typeof TESOURO_DPF_TABLES)[number];

type ObservationRow = [string, string, string, number, number | null];
type TableMetadata = {
  sheet: string;
  title: string;
  unit: "BRL billion" | "years" | "% p.a.";
  coverage: { start: string; end: string };
  categories: [string, string][];
  footnotes: string[];
  observations: number;
};

type DpfSnapshot = {
  schema_version: number;
  synced_at: string;
  source_version: string;
  publication_period: string;
  publication_url: string;
  annex_url: string;
  source_page: string;
  source_file: string;
  coverage: { start: string; end: string };
  tables: Record<TesouroDpfTable, TableMetadata>;
};

type DpfObservationSnapshot = {
  tables: Record<TesouroDpfTable, ObservationRow[]>;
};

export interface TesouroDpfSelection {
  table: TesouroDpfTable;
  from: string;
  to: string;
  categories: string[];
  query: string;
}

const data = snapshot as DpfSnapshot;

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export const TESOURO_DPF_TABLE_METADATA = Object.fromEntries(TESOURO_DPF_TABLES.map((id) => [id, data.tables[id]])) as Record<TesouroDpfTable, TableMetadata>;

export const tesouroDpfMetadata = {
  schemaVersion: data.schema_version,
  syncedAt: data.synced_at,
  sourceVersion: data.source_version,
  publicationPeriod: data.publication_period,
  publicationUrl: data.publication_url,
  annexUrl: data.annex_url,
  sourcePage: data.source_page,
  sourceFile: data.source_file,
  startPeriod: data.coverage.start,
  endPeriod: data.coverage.end,
  tables: TESOURO_DPF_TABLES.length,
  observations: TESOURO_DPF_TABLES.reduce((total, id) => total + data.tables[id].observations, 0),
};

export function tesouroDpfCategories(table: TesouroDpfTable) {
  return TESOURO_DPF_TABLE_METADATA[table].categories.map(([id, label]) => ({ id, label }));
}

export async function queryTesouroDpf(selection: TesouroDpfSelection) {
  const observationSnapshot = (await import("@/lib/catalog/generated/tesouro-dpf-observations.generated.json")).default as DpfObservationSnapshot;
  const selected = new Set(selection.categories);
  const terms = normalize(selection.query).split(" ").filter(Boolean);
  const table = TESOURO_DPF_TABLE_METADATA[selection.table];

  return observationSnapshot.tables[selection.table]
    .filter(([period, categoryId, categoryLabel]) => period >= selection.from && period <= selection.to
      && (!selected.size || selected.has(categoryId))
      && (!terms.length || terms.every((term) => normalize(categoryLabel).includes(term))))
    .map(([period, categoryId, categoryLabel, value, sharePercent]) => ({
      period,
      date: `${period}-01`,
      table: { id: selection.table, sheet: table.sheet, title: table.title },
      category: { id: categoryId, label: categoryLabel },
      value,
      unit: table.unit,
      share_percent: sharePercent,
      status: "observed" as const,
    }));
}
