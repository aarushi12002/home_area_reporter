export const BASELINE_METRICS = {
  population: ["B01003_001", "Population", "people"],
  homes: ["B25001_001", "Housing units", "homes"],
  occupiedHomes: ["B25003_001", "Occupied homes", "homes"],
  ownerOccupied: ["B25003_002", "Owner-occupied homes", "homes"],
  renterOccupied: ["B25003_003", "Renter-occupied homes", "homes"],
  medianGrossRent: ["B25064_001", "Median monthly gross rent", "USD"],
  commuters: ["B08301_001", "Workers with commuting estimates", "people"],
  transitCommuters: ["B08301_010", "Workers using public transit", "people"],
};
const estimate = (value) => value == null || value === "" || !Number.isFinite(Number(value)) || Number(value) < 0 ? null : Number(value);

export function normalizeBaseline(payload) {
  if (!Array.isArray(payload) || payload.length < 2 || !Array.isArray(payload[0])) throw new Error("Incomplete Census baseline response");
  const headers = payload[0];
  for (const field of ["zip code tabulation area", ...Object.values(BASELINE_METRICS).flatMap(([id]) => [`${id}E`, `${id}M`])])
    if (!headers.includes(field)) throw new Error("Unexpected Census schema");
  const seen = new Set();
  return payload.slice(1).map((row) => {
    if (!Array.isArray(row) || row.length !== headers.length) throw new Error("Incomplete Census row");
    const fields = Object.fromEntries(headers.map((key, index) => [key, row[index]]));
    const zip = fields["zip code tabulation area"];
    if (!/^\d{5}$/.test(zip) || seen.has(zip)) throw new Error("Invalid or duplicate Census geography");
    seen.add(zip);
    return { zip, metrics: Object.fromEntries(Object.entries(BASELINE_METRICS).map(([key, [id, label, unit]]) => [key, { label, unit, estimate: estimate(fields[`${id}E`]), marginOfError: estimate(fields[`${id}M`]) }])) };
  });
}

export async function fetchBaseline({ apiKey, vintage = "2024", fetcher = fetch } = {}) {
  if (!apiKey) throw new Error("CENSUS_API_KEY is required. Register and activate a free Census key first.");
  if (!/^20\d{2}$/.test(String(vintage))) throw new Error("Invalid ACS vintage");
  const variables = Object.values(BASELINE_METRICS).flatMap(([id]) => [`${id}E`, `${id}M`]);
  const source = `https://api.census.gov/data/${vintage}/acs/acs5`;
  const query = new URLSearchParams({ get: ["NAME", ...variables].join(","), for: "zip code tabulation area:*", key: apiKey });
  const response = await fetcher(`${source}?${query}`, { signal: AbortSignal.timeout(120000), cache: "no-store" });
  if (!response.ok) throw new Error(`Census import failed: HTTP ${response.status}`);
  const records = normalizeBaseline(await response.json());
  return { records, vintage: String(vintage), provenance: { source, program: "ACS 5-year", geographyType: "zcta", observationPeriod: `${Number(vintage) - 4}–${vintage}`, note: "Historical survey estimates and margins of error; not current asking rents, individual properties or forecasts." } };
}
