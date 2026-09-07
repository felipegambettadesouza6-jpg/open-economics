import type { OfficialDataset } from "@/lib/catalog/official-datasets";

export interface EconomicConcept {
  id: string;
  domain: string;
  en: string;
  pt: string;
  sources: string[];
  frequency: string;
  dimensions: string[];
  weight: number;
}

export interface ConceptMatch extends EconomicConcept {
  score: number;
  confidence: number;
  matchedTerms: string[];
}

export interface DatasetMatch extends OfficialDataset {
  score: number;
  why: string[];
  stableIndicatorIds: string[];
}

export type ResolutionStatus = "resolved" | "ambiguous" | "unresolved";
export type AvailabilityStatus =
  | "stable-series-ready"
  | "official-dataset-ready"
  | "official-metadata-ready"
  | "source-not-integrated"
  | "unresolved";

export interface SemanticSearchResult {
  query: string;
  normalizedQuery: string;
  resolution: {
    status: ResolutionStatus;
    confidence: number;
    explanation: string;
  };
  concepts: ConceptMatch[];
  datasets: DatasetMatch[];
  availability: {
    status: AvailabilityStatus;
    complete: boolean;
    explanation: string;
    missingSources: string[];
  };
}

