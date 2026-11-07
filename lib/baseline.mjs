export const BASELINE_METRICS = {
  population: ["B01003_001", "Population", "people"],
  homes: ["B25001_001", "Housing units", "homes"],
  occupiedHomes: ["B25003_001", "Occupied homes", "homes"],
  ownerOccupied: ["B25003_002", "Owner-occupied homes", "homes"],
  renterOccupied: ["B25003_003", "Renter-occupied homes", "homes"],
  medianGrossRent: ["B25064_001", "Median monthly gross rent", "USD"],
  commuters: ["B08301_001", "Workers with commuting estimates", "people"],
  transitCommuters: ["B08301_010", "Workers using public transit", "people"],
  medianHomeValue: ["B25077_001", "Median owner-reported home value", "USD"],
  monthlyOwnerCosts: ["B25088_002", "Monthly owner costs with a mortgage", "USD"],
  rentIncomeShare: ["B25071_001", "Median share of income spent on rent", "percent"],
  medianYearBuilt: ["B25035_001", "Median year homes were built", "year"],
  detachedHomes: ["B25024_002", "Detached single-family homes", "homes"],
  workFromHome: ["B08301_021", "People working from home", "people"],
};
const annotation = (value) => typeof value === "string" && value.trim() ? value.trim() : null;
function displayEstimate(value, unit, note) {
  if (value == null) return "Not available";
  const format = (number) => unit === "USD" ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(number) : unit === "percent" ? `${number}%` : unit === "year" ? String(number) : number.toLocaleString("en-US");
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
  // Census permits at most 50 requested variables. Join complete chunks by ZCTA,
  // never by upstream row position, before the importer can write anything.
  const headers = ["NAME", ...variables, "zip code tabulation area"];
  let merged;
  for (let start = 0; start < variables.length; start += 48) {
    const requested = ["NAME", ...variables.slice(start, start + 48)];
    const query = new URLSearchParams({ get: requested.join(","), for: "zip code tabulation area:*", key: apiKey });
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
    if (!Array.isArray(payload) || payload.length < 2 || !Array.isArray(payload[0])) throw new Error("Incomplete Census baseline response");
    const chunkHeaders = payload[0];
    if ([...requested, "zip code tabulation area"].some((field) => !chunkHeaders.includes(field))) throw new Error("Unexpected Census schema");
    const chunk = new Map();
    for (const row of payload.slice(1)) {
      if (!Array.isArray(row) || row.length !== chunkHeaders.length) throw new Error("Incomplete Census row");
      const fields = Object.fromEntries(chunkHeaders.map((field, i) => [field, row[i]]));
      const zip = fields["zip code tabulation area"];
      if (!/^\d{5}$/.test(zip) || chunk.has(zip)) throw new Error("Invalid or duplicate Census geography");
      chunk.set(zip, Object.fromEntries([...requested, "zip code tabulation area"].map((field) => [field, fields[field]])));
    }
    if (!merged) merged = chunk;
    else {
      if (merged.size !== chunk.size || [...merged.keys()].some((zip) => !chunk.has(zip))) throw new Error("Census geography changed between chunks; no data was imported");
      for (const [zip, fields] of chunk) Object.assign(merged.get(zip), fields);
    }
  }
  const records = normalizeBaseline([headers, ...[...merged.values()].map((fields) => headers.map((field) => fields[field]))]);
  return { records, vintage: String(vintage), provenance: { source, program: "ACS 5-year", geographyType: "zcta", observationPeriod: `${Number(vintage) - 4}–${vintage}`, note: "Historical survey estimates and margins of error; not current asking rents, individual properties or forecasts." } };
}
