import { normalizeText } from "@/lib/semantic/normalize";

export const ANP_FUEL_GROUPS = ["gasoline-ethanol", "diesel-gnv", "glp"] as const;
export const ANP_GEOGRAPHY_SCOPES = ["country", "region", "state", "municipality"] as const;
export const ANP_PERIOD_SCOPES = ["week", "month"] as const;

export type AnpFuelGroup = (typeof ANP_FUEL_GROUPS)[number];
export type AnpGeographyScope = (typeof ANP_GEOGRAPHY_SCOPES)[number];
export type AnpPeriodScope = (typeof ANP_PERIOD_SCOPES)[number];

export interface AnpFuelSelection {
  fuelGroup: AnpFuelGroup;
  year: number | null;
  month: number | null;
  geography: AnpGeographyScope;
  period: AnpPeriodScope;
  state: string | null;
  municipality: string | null;
  product: string | null;
}

interface FuelObservation {
  region: string;
  state: string;
  municipality: string;
  product: string;
  collectedAt: string;
  salePrice: number;
  purchasePrice: number | null;
  unit: string;
}

interface AggregateAccumulator {
  period: string;
  periodStart: string;
  periodEnd: string;
  geographyLevel: AnpGeographyScope;
  geographyId: string;
  geographyName: string;
  state: string | null;
  region: string | null;
  product: string;
  unit: string;
  count: number;
  sum: number;
  sumSquares: number;
  min: number;
  max: number;
  purchaseCount: number;
  purchaseSum: number;
}

function csvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ";" && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.some((value) => value.length)) rows.push(row);
  }
  return rows;
}

function sourceDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) ? null : iso;
}

function sourceNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.trim().replace(".", "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseAnpFuelCsv(text: string): FuelObservation[] {
  const rows = csvRows(text.replace(/^\uFEFF/, ""));
  if (!rows.length) throw new Error("ANP CSV is empty.");
  const headers = rows[0].map((value) => normalizeText(value));
  const column = (name: string) => headers.indexOf(normalizeText(name));
  const indexes = {
    region: column("Regiao - Sigla"),
    state: column("Estado - Sigla"),
    municipality: column("Municipio"),
    product: column("Produto"),
    collectedAt: column("Data da Coleta"),
    salePrice: column("Valor de Venda"),
    purchasePrice: column("Valor de Compra"),
    unit: column("Unidade de Medida"),
  };
  if (Object.values(indexes).some((index) => index < 0)) throw new Error("ANP CSV columns changed.");

  const observations: FuelObservation[] = [];
  for (const row of rows.slice(1)) {
    const collectedAt = sourceDate(row[indexes.collectedAt] ?? "");
    const salePrice = sourceNumber(row[indexes.salePrice] ?? "");
    if (!collectedAt || salePrice === null) continue;
    observations.push({
      region: (row[indexes.region] ?? "").trim(),
      state: (row[indexes.state] ?? "").trim(),
      municipality: (row[indexes.municipality] ?? "").trim(),
      product: (row[indexes.product] ?? "").trim(),
      collectedAt,
      salePrice,
      purchasePrice: sourceNumber(row[indexes.purchasePrice] ?? ""),
      unit: (row[indexes.unit] ?? "").trim(),
    });
  }
  return observations;
}

function periodFields(iso: string, period: AnpPeriodScope) {
  if (period === "month") {
    const value = iso.slice(0, 7);
    const [year, month] = value.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { period: value, start: `${value}-01`, end: `${value}-${String(lastDay).padStart(2, "0")}` };
  }
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  const start = date.toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() + 6);
  return { period: `${start}/${date.toISOString().slice(0, 10)}`, start, end: date.toISOString().slice(0, 10) };
}

function geographyFields(observation: FuelObservation, scope: AnpGeographyScope) {
  if (scope === "country") return { id: "BR", name: "Brasil", state: null, region: null };
  if (scope === "region") return { id: observation.region, name: observation.region, state: null, region: observation.region };
  if (scope === "state") return { id: observation.state, name: observation.state, state: observation.state, region: observation.region };
  return { id: `${observation.state}:${normalizeText(observation.municipality).replace(/\s+/g, "-")}`, name: observation.municipality, state: observation.state, region: observation.region };
}

function rounded(value: number) {
  return Number(value.toFixed(4));
}

export function aggregateAnpFuelPrices(observations: FuelObservation[], selection: AnpFuelSelection) {
  const state = selection.state?.toUpperCase() ?? null;
  const municipality = selection.municipality ? normalizeText(selection.municipality) : null;
  const product = selection.product ? normalizeText(selection.product) : null;
  const filtered = observations.filter((observation) => (
    (!state || observation.state.toUpperCase() === state)
    && (!municipality || normalizeText(observation.municipality) === municipality)
    && (!product || normalizeText(observation.product) === product)
  ));
  const groups = new Map<string, AggregateAccumulator>();
  for (const observation of filtered) {
    const period = periodFields(observation.collectedAt, selection.period);
    const geography = geographyFields(observation, selection.geography);
    const key = [period.period, selection.geography, geography.id, normalizeText(observation.product), observation.unit].join("|");
    const current = groups.get(key) ?? {
      period: period.period,
      periodStart: period.start,
      periodEnd: period.end,
      geographyLevel: selection.geography,
      geographyId: geography.id,
      geographyName: geography.name,
      state: geography.state,
      region: geography.region,
      product: observation.product,
      unit: observation.unit,
      count: 0,
      sum: 0,
      sumSquares: 0,
      min: observation.salePrice,
      max: observation.salePrice,
      purchaseCount: 0,
      purchaseSum: 0,
    };
    current.count += 1;
    current.sum += observation.salePrice;
    current.sumSquares += observation.salePrice * observation.salePrice;
    current.min = Math.min(current.min, observation.salePrice);
    current.max = Math.max(current.max, observation.salePrice);
    if (observation.purchasePrice !== null) {
      current.purchaseCount += 1;
      current.purchaseSum += observation.purchasePrice;
    }
    groups.set(key, current);
  }
  return [...groups.values()]
    .sort((left, right) => left.period.localeCompare(right.period) || left.geographyId.localeCompare(right.geographyId) || left.product.localeCompare(right.product))
    .map((group) => {
      const variance = group.count > 1 ? Math.max(0, (group.sumSquares - (group.sum * group.sum) / group.count) / (group.count - 1)) : 0;
      return {
        period: group.period,
        period_start: group.periodStart,
        period_end: group.periodEnd,
        geography: { level: group.geographyLevel, id: group.geographyId, name: group.geographyName, state: group.state, region: group.region },
        product: group.product,
        unit: group.unit,
        source_observation_count: group.count,
        average_sale_price: rounded(group.sum / group.count),
        sample_standard_deviation: rounded(Math.sqrt(variance)),
        minimum_sale_price: rounded(group.min),
        maximum_sale_price: rounded(group.max),
        average_purchase_price: group.purchaseCount ? rounded(group.purchaseSum / group.purchaseCount) : null,
        purchase_price_observation_count: group.purchaseCount,
      };
    });
}

export function anpFuelCsvUrl(selection: Pick<AnpFuelSelection, "fuelGroup" | "year" | "month">) {
  const base = "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/shpc";
  if (selection.year === null || selection.month === null) {
    const suffix = selection.fuelGroup === "gasoline-ethanol" ? "gasolina-etanol" : selection.fuelGroup;
    return `${base}/qus/ultimas-4-semanas-${suffix}.csv`;
  }
  const month = String(selection.month).padStart(2, "0");
  const suffix = selection.fuelGroup === "gasoline-ethanol" ? "gasolina-etanol" : selection.fuelGroup;
  return `${base}/dsan/${selection.year}/${month}-dados-abertos-precos-${selection.year}-${month}-${suffix}.csv`;
}
