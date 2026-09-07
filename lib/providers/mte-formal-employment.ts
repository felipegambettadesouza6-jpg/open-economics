import snapshot from "@/lib/catalog/generated/mte-formal-employment.generated.json";

export const MTE_FORMAL_EMPLOYMENT_BREAKDOWNS = ["country", "region", "state", "industry"] as const;
export const MTE_FORMAL_EMPLOYMENT_REGIONS = ["Centro-Oeste", "Nordeste", "Norte", "Sudeste", "Sul"] as const;

export type MteFormalEmploymentBreakdown = (typeof MTE_FORMAL_EMPLOYMENT_BREAKDOWNS)[number];

type CompactRow = [string, MteFormalEmploymentBreakdown, string, string, number | null, number | null, number | null, number | null, number | null];

interface MteSnapshot {
  schema_version: number;
  synced_at: string;
  source_version: string;
  source_file: string;
  source_url: string;
  source_page: string;
  folder_url: string;
  columns: string[];
  rows: CompactRow[];
}

export interface MteFormalEmploymentSelection {
  from: string;
  to: string;
  breakdown: MteFormalEmploymentBreakdown;
  states: string[];
  regions: string[];
  industries: string[];
}

const data = snapshot as MteSnapshot;

export const MTE_FORMAL_EMPLOYMENT_INDUSTRIES = [...new Map(
  data.rows.filter((row) => row[1] === "industry").map((row) => [row[2], { id: row[2], label: row[3] }]),
).values()].sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));

export const mteFormalEmploymentMetadata = {
  schemaVersion: data.schema_version,
  syncedAt: data.synced_at,
  sourceVersion: data.source_version,
  sourceFile: data.source_file,
  sourceUrl: data.source_url,
  sourcePage: data.source_page,
  folderUrl: data.folder_url,
  startPeriod: data.rows[0]?.[0] ?? null,
  endPeriod: data.rows.at(-1)?.[0] ?? null,
  sourceRows: data.rows.length,
};

export function queryMteFormalEmployment(selection: MteFormalEmploymentSelection) {
  const from = selection.from.replace("-", "");
  const to = selection.to.replace("-", "");
  const states = new Set(selection.states);
  const regions = new Set(selection.regions);
  const industries = new Set(selection.industries);

  return data.rows
    .filter(([period, scope, id, label]) => {
      if (period < from || period > to || scope !== selection.breakdown) return false;
      if (scope === "state" && states.size && !states.has(id)) return false;
      if (scope === "region" && regions.size && !regions.has(label)) return false;
      if (scope === "industry" && industries.size && !industries.has(id)) return false;
      return true;
    })
    .map(([period, scope, id, label, stock, admissions, dismissals, balance, relativeChange]) => ({
      period: `${period.slice(0, 4)}-${period.slice(4)}`,
      date: `${period.slice(0, 4)}-${period.slice(4)}-01`,
      breakdown: { type: scope, id, label },
      stock,
      admissions,
      dismissals,
      balance,
      relative_change_pct: relativeChange,
      status: stock === null || admissions === null || dismissals === null || balance === null ? "partially-unavailable" : "observed",
    }));
}
