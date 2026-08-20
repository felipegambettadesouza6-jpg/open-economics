// Fetch official Brazilian policy-rate observations from Open Economics API.
const baseUrl = process.env.OPEN_ECONOMICS_URL ?? "http://localhost:3000";
const url = new URL("/api/v1/indicators/br-selic-target/observations", baseUrl);
url.searchParams.set("start", "2025-01-01");
url.searchParams.set("order", "desc");
url.searchParams.set("limit", "12");

const response = await fetch(url);
if (!response.ok) {
  throw new Error(`Open Economics API returned HTTP ${response.status}`);
}

const { data, meta } = await response.json();
console.table(data);
console.log(meta.provenance);

