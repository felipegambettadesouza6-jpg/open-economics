import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BCB_URL =
  "https://api.bcb.gov.br/dados/serie/bcdata.sgs.24363/dados?formato=json&dataInicial=01/01/2003";
const IBGE_URL =
  "https://apisidra.ibge.gov.br/values/t/5932/n1/all/v/6561/p/all/c11255/90707";

async function getJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "OpenEconomicsOfficialSnapshot/1.0",
    },
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}

function bcbObservations(rows) {
  return rows.map(({ data, valor }) => {
    if (typeof data !== "string" || typeof valor !== "string") {
      throw new Error("BCB returned an invalid observation");
    }
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data);
    if (!match) throw new Error(`BCB returned an invalid date: ${data}`);
    const date = `${match[3]}-${match[2]}-${match[1]}`;
    const value = Number(valor.replace(",", "."));
    if (!Number.isFinite(value)) throw new Error(`BCB returned an invalid value: ${valor}`);
    return {
      date,
      period: date.slice(0, 7),
      sourceDate: data,
      value,
      rawValue: valor,
      status: "observed",
    };
  });
}

function ibgeValue(rawValue) {
  if (rawValue === "-") return { value: 0, status: "absolute-zero" };
  if (rawValue === "0") return { value: 0, status: "rounded-zero" };
  if (rawValue === "X") return { value: null, status: "suppressed" };
  if (rawValue === "..") return { value: null, status: "not-applicable" };
  if (rawValue === "...") return { value: null, status: "unavailable" };
  if (/^[A-WYZ]$/i.test(rawValue)) return { value: null, status: "quality-flag" };
  const value = Number(rawValue.replace(",", "."));
  return Number.isFinite(value)
    ? { value, status: "observed" }
    : { value: null, status: "missing" };
}

function ibgeObservations(rows) {
  return rows.slice(1).map((row) => {
    const sourceDate = String(row.D3C ?? "");
    const match = /^(\d{4})0([1-4])$/.exec(sourceDate);
    if (!match) throw new Error(`IBGE returned an invalid quarter: ${sourceDate}`);
    const quarter = Number(match[2]);
    const month = String((quarter - 1) * 3 + 1).padStart(2, "0");
    const rawValue = String(row.V ?? "");
    return {
      date: `${match[1]}-${month}-01`,
      period: `${match[1]}-Q${quarter}`,
      sourceDate,
      rawValue,
      ...ibgeValue(rawValue),
    };
  });
}

const [bcb, ibge] = await Promise.all([getJson(BCB_URL), getJson(IBGE_URL)]);
if (!Array.isArray(bcb) || !Array.isArray(ibge)) throw new Error("Official source returned a non-array payload");

const retrievedAt = new Date().toISOString();
const bundled = {
  "br-ibc-br": {
    observations: bcbObservations(bcb),
    retrievedAt,
    upstreamUrl: BCB_URL,
    sourceUpdatedAt: null,
  },
  "br-gdp-real-yoy": {
    observations: ibgeObservations(ibge),
    retrievedAt,
    upstreamUrl: IBGE_URL,
    sourceUpdatedAt: null,
  },
};

const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(here, "../lib/cache/bundled-series.generated.json");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(bundled, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  output,
  retrievedAt,
  observations: Object.fromEntries(
    Object.entries(bundled).map(([id, series]) => [id, series.observations.length]),
  ),
}));
