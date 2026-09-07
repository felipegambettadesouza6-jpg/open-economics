import snapshot from "@/lib/catalog/generated/tesouro-rtn.generated.json";

type AccountRow = [string, string, number, string];
type ObservationRow = [string, string, number | null, "observed" | "not-available" | "missing"];

interface RtnSnapshot {
  schema_version: number;
  synced_at: string;
  source_version: string;
  source_file: string;
  source_url: string;
  source_page: string;
  package_api: string;
  dictionary_url: string;
  metadata_url: string;
  table: string;
  title: string;
  unit: string;
  coverage: { start: string; end: string };
  accounts: AccountRow[];
  observations: ObservationRow[];
  footnotes: string[];
}

export interface TesouroRtnSelection {
  from: string;
  to: string;
  accounts: string[];
  query: string;
}

const data = snapshot as RtnSnapshot;

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export const TESOURO_RTN_DEFAULT_ACCOUNTS = ["1", "2", "3", "4", "5"] as const;

export const TESOURO_RTN_ACCOUNTS = data.accounts.map(([id, label, depth, section]) => ({
  id,
  label,
  depth,
  section,
  parent_id: id.includes(".") ? id.slice(0, id.lastIndexOf(".")) : null,
}));

const accountById = new Map(TESOURO_RTN_ACCOUNTS.map((account) => [account.id, account]));

export const tesouroRtnMetadata = {
  schemaVersion: data.schema_version,
  syncedAt: data.synced_at,
  sourceVersion: data.source_version,
  sourceFile: data.source_file,
  sourceUrl: data.source_url,
  sourcePage: data.source_page,
  packageApi: data.package_api,
  dictionaryUrl: data.dictionary_url,
  metadataUrl: data.metadata_url,
  table: data.table,
  title: data.title,
  unit: data.unit,
  startPeriod: data.coverage.start,
  endPeriod: data.coverage.end,
  accounts: data.accounts.length,
  observations: data.observations.length,
  footnotes: data.footnotes,
};

export function queryTesouroRtn(selection: TesouroRtnSelection) {
  const from = selection.from.replace("-", "");
  const to = selection.to.replace("-", "");
  const selected = new Set(selection.accounts);
  const terms = normalize(selection.query).split(" ").filter(Boolean);
  const matchingAccounts = new Set(TESOURO_RTN_ACCOUNTS
    .filter((account) => (!selected.size || selected.has(account.id)) && (!terms.length || terms.every((term) => normalize(account.label).includes(term))))
    .map((account) => account.id));

  return data.observations
    .filter(([period, accountId]) => period >= from && period <= to && matchingAccounts.has(accountId))
    .map(([period, accountId, value, status]) => ({
      period: `${period.slice(0, 4)}-${period.slice(4)}`,
      date: `${period.slice(0, 4)}-${period.slice(4)}-01`,
      account: accountById.get(accountId),
      value_millions_brl: value,
      status,
    }));
}
