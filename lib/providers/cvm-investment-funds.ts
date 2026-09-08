import snapshot from "@/lib/catalog/generated/cvm-investment-funds.generated.json";

export const CVM_FUND_BREAKDOWNS = ["classification", "fund"] as const;
export type CvmFundBreakdown = (typeof CVM_FUND_BREAKDOWNS)[number];

type ClassRow = [string, string, number, number, number, number, number, number];
type FundRow = [string, string, string | null, string | null, string | null, string | null, string | null, string | null, number | null, number | null, number | null, number | null, number | null, number | null];

interface CvmFundSnapshot {
  schema_version: number;
  synced_at: string;
  source_version: string;
  source_page: string;
  registry_page: string;
  package_api: string;
  registry_api: string;
  coverage: { start: string; end: string; source_end: string };
  source_files: { period: string; url: string; last_modified: string | null; bytes: number }[];
  source_rows: number;
  latest_fund_records: number;
  class_rows: ClassRow[];
}

interface CvmFundLatestSnapshot {
  fund_rows: FundRow[];
}

export interface CvmFundSelection {
  from: string;
  to: string;
  breakdown: CvmFundBreakdown;
  classifications: string[];
  funds: string[];
  query: string;
}

const data = snapshot as CvmFundSnapshot;

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function cnpj(value: string) {
  return value.replace(/\D/g, "");
}

export const CVM_FUND_CLASSIFICATIONS = [...new Set(data.class_rows.map((row) => row[1]))]
  .sort((left, right) => left.localeCompare(right, "pt-BR"));

export const cvmFundMetadata = {
  schemaVersion: data.schema_version,
  syncedAt: data.synced_at,
  sourceVersion: data.source_version,
  sourcePage: data.source_page,
  registryPage: data.registry_page,
  packageApi: data.package_api,
  registryApi: data.registry_api,
  startDate: data.coverage.start,
  endDate: data.coverage.end,
  sourceEndDate: data.coverage.source_end,
  sourceRows: data.source_rows,
  latestFundRecords: data.latest_fund_records,
  sourceFiles: data.source_files,
};

export async function queryCvmInvestmentFunds(selection: CvmFundSelection) {
  if (selection.breakdown === "classification") {
    const classes = new Set(selection.classifications);
    return data.class_rows
      .filter(([date, classification]) => date >= selection.from && date <= selection.to && (!classes.size || classes.has(classification)))
      .map(([date, classification, reportingEntries, portfolioValue, netAssets, subscriptions, redemptions, holderAccounts]) => ({
        date,
        breakdown: { type: "classification" as const, id: normalize(classification).replace(/ /g, "-"), label: classification },
        reporting_entries: reportingEntries,
        portfolio_value_brl: portfolioValue,
        net_assets_brl: netAssets,
        subscriptions_brl: subscriptions,
        redemptions_brl: redemptions,
        reported_holder_accounts: holderAccounts,
        quota_value_brl: null,
        status: "aggregated",
      }));
  }

  const fundSnapshot = (await import("@/lib/catalog/generated/cvm-investment-funds-latest.generated.json")).default as CvmFundLatestSnapshot;
  const funds = new Set(selection.funds.map(cnpj));
  const terms = normalize(selection.query).split(" ").filter(Boolean);
  return fundSnapshot.fund_rows
    .filter(([date, fundCnpj, , , name, classification, anbimaClassification]) => {
      if (date < selection.from || date > selection.to) return false;
      if (funds.size && !funds.has(fundCnpj)) return false;
      if (!terms.length) return true;
      const searchable = normalize([fundCnpj, name, classification, anbimaClassification].filter(Boolean).join(" "));
      return terms.every((term) => searchable.includes(term));
    })
    .map(([date, fundCnpj, subclassId, sourceType, name, classification, anbimaClassification, registryStatus, portfolioValue, quotaValue, netAssets, subscriptions, redemptions, reportedHolders]) => ({
      date,
      breakdown: {
        type: "fund" as const,
        cnpj: fundCnpj,
        subclass_id: subclassId,
        name,
        classification,
        anbima_classification: anbimaClassification,
        source_type: sourceType,
        registry_status: registryStatus,
      },
      portfolio_value_brl: portfolioValue,
      quota_value_brl: quotaValue,
      net_assets_brl: netAssets,
      subscriptions_brl: subscriptions,
      redemptions_brl: redemptions,
      reported_holders: reportedHolders,
      status: "reported",
    }));
}
