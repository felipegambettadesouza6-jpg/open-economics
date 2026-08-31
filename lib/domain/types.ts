export type Category =
  | "inflation"
  | "interest-rates"
  | "currencies"
  | "activity"
  | "labor"
  | "credit"
  | "fiscal"
  | "external"
  | "markets";

export type Frequency = "daily" | "monthly" | "quarterly" | "annual";
export type ProviderId = "bcb-sgs" | "ibge-aggregates";

export interface IndicatorDefinition {
  id: string;
  name: string;
  officialName: string;
  description: string;
  category: Category;
  provider: ProviderId;
  sourceAgency: "BCB" | "IBGE";
  frequency: Frequency;
  unit: string;
  unitSymbol: string;
  decimals: number;
  seasonalAdjustment: boolean;
  geography: "Brazil";
  startDate: string;
  upstream: {
    seriesCode?: number;
    aggregate?: number;
    variable?: number;
    classification?: string;
  };
  sourceUrl: string;
  license: string;
  licenseUrl: string;
  aliases: string[];
  featured?: boolean;
  cacheTtlSeconds: number;
  dateSemantics: string;
  transformations: string[];
  notes?: string;
}

export interface Observation {
  date: string;
  period: string;
  sourceDate: string;
  value: number | null;
  rawValue: string;
  status:
    | "observed"
    | "absolute-zero"
    | "rounded-zero"
    | "suppressed"
    | "not-applicable"
    | "unavailable"
    | "quality-flag"
    | "missing";
}

export interface SeriesResult {
  observations: Observation[];
  retrievedAt: string;
  upstreamUrl: string;
  sourceUpdatedAt: string | null;
}

export interface SourceDefinition {
  id: "bcb" | "ibge";
  name: string;
  shortName: string;
  description: string;
  homepage: string;
  catalogUrl: string;
  license: string;
  licenseUrl: string;
  attribution: string;
}
