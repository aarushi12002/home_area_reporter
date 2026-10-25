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
const annotation = (value) => typeof value === "string" && value.trim() ? value.trim() : null;
function displayEstimate(value, unit, note) {
  if (value == null) return "Not available";
  const format = (number) => unit === "USD" ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(number) : number.toLocaleString("en-US");
  const bound = note?.match(/^(\d[\d,]*(?:\.\d+)?)([+-])$/);
  return bound ? `${format(Number(bound[1].replaceAll(",", "")))}${bound[2]}` : format(value);
}
const estimate = (value) => value == null || value === "" || !Number.isFinite(Number(value)) || Number(value) < 0 ? null : Number(value);

export function normalizeBaseline(payload) {
  if (!Array.isArray(payload) || payload.length < 2 || !Array.isArray(payload[0])) throw new Error("Incomplete Census baseline response");
  const headers = payload[0];
  for (const field of ["zip code tabulation area", ...Object.values(BASELINE_METRICS).flatMap(([id]) => [`${id}E`, `${id}M`, `${id}EA`, `${id}MA`])])
    if (!headers.includes(field)) throw new Error("Unexpected Census schema");
  const seen = new Set();
  return payload.slice(1).map((row) => {
    if (!Array.isArray(row) || row.length !== headers.length) throw new Error("Incomplete Census row");
    const fields = Object.fromEntries(headers.map((key, index) => [key, row[index]]));
    const zip = fields["zip code tabulation area"];
    if (!/^\d{5}$/.test(zip) || seen.has(zip)) throw new Error("Invalid or duplicate Census geography");
    seen.add(zip);
    return { zip, metrics: Object.fromEntries(Object.entries(BASELINE_METRICS).map(([key, [id, label, unit]]) => {
      const value = estimate(fields[`${id}E`]), note = annotation(fields[`${id}EA`]);
      return [key, { label, unit, estimate: value, marginOfError: estimate(fields[`${id}M`]), estimateAnnotation: note, marginOfErrorAnnotation: annotation(fields[`${id}MA`]), displayValue: displayEstimate(value, unit, note) }];
    })) };
  });
}

export async function fetchBaseline({ apiKey, vintage = "2024", fetcher = fetch } = {}) {
  apiKey = typeof apiKey === "string" ? apiKey.trim() : "";
  if (!apiKey) throw new Error("CENSUS_API_KEY is required. Register and activate a free Census key first.");
  if (apiKey === "[SENSITIVE]") throw new Error("Vercel returned a protected-key placeholder. Run the import inside Vercel or use an independently configured local key; keep the production key protected.");
  if (!/^20\d{2}$/.test(String(vintage))) throw new Error("Invalid ACS vintage");
  const variables = Object.values(BASELINE_METRICS).flatMap(([id]) => [`${id}E`, `${id}M`, `${id}EA`, `${id}MA`]);
  const source = `https://api.census.gov/data/${vintage}/acs/acs5`;
  const query = new URLSearchParams({ get: ["NAME", ...variables].join(","), for: "zip code tabulation area:*", key: apiKey });
  let response, body;
  try {
    response = await fetcher(`${source}?${query}`, { signal: AbortSignal.timeout(120000), cache: "no-store" });
    body = await response.text();
  } catch { throw new Error("Census request failed; check connectivity and retry. No data was imported."); }
  if (!response.ok) throw new Error(`Census import failed: HTTP ${response.status}`);
  if (/<(?:!doctype|html)\b/i.test(body) && /invalid\s+key/i.test(body)) throw new Error("Census rejected the API key. Replace CENSUS_API_KEY with the activated key from Census's email. No data was imported.");
  let payload;
  try { payload = JSON.parse(body); }
  catch { throw new Error("Census returned a non-JSON response. Verify key activation and upstream availability. No data was imported."); }
  const records = normalizeBaseline(payload);
  return { records, vintage: String(vintage), provenance: { source, program: "ACS 5-year", geographyType: "zcta", observationPeriod: `${Number(vintage) - 4}–${vintage}`, note: "Historical survey estimates and margins of error; not current asking rents, individual properties or forecasts." } };
}
