import { SERVICE_AREAS } from "./service-areas.mjs";
export const TRANSIT_SOURCE = "https://services.arcgis.com/Ej0PsM5Aw677QF1W/arcgis/rest/services/TRANSITROUTE_LINE_2647/FeatureServer/0";
export const TRANSIT_ATTRIBUTION = "Transit scheduling, geographic, and real-time data provided by permission of King County";
// Query windows are ZIP vicinity envelopes, not postal boundary polygons.
export const TRANSIT_BOUNDS = Object.fromEntries(SERVICE_AREAS.map((area) => [area.zip, area.bounds]));

// Clip each segment to the query envelope; do not draw a whole county route
// merely because one segment intersects this neighborhood.
function clipSegment(a, b, [west, south, east, north]) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  let start = 0, end = 1;
  const p = [-dx, dx, -dy, dy], q = [a[0] - west, east - a[0], a[1] - south, north - a[1]];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return null; }
    else {
      const t = q[i] / p[i];
      if (p[i] < 0) start = Math.max(start, t);
      else end = Math.min(end, t);
      if (start > end) return null;
    }
  }
  return [[a[0] + start * dx, a[1] + start * dy], [a[0] + end * dx, a[1] + end * dy]];
}

export function transitFeatures(payload, bounds) {
  if (payload?.error || !Array.isArray(payload?.features) || payload.exceededTransferLimit)
    throw new Error("Incomplete transit response");
  const features = [];
  for (const feature of payload.features) {
    if (feature.attributes?.IN_SERVICE_FLAG !== "Y" || feature.attributes?.CURRENT_NEXT_CODE !== "IN SERVICE") continue;
    const route = Number(feature.attributes.ROUTE_NUM);
    if (!Number.isInteger(route) || !Array.isArray(feature.geometry?.paths)) continue;
    const lines = [];
    for (const path of feature.geometry.paths) {
      if (!Array.isArray(path)) continue;
      let line = null;
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1], b = path[i];
        if (![a, b].every((point) => Array.isArray(point) && point.length >= 2 && point.slice(0, 2).every(Number.isFinite))) { line = null; continue; }
        const clipped = clipSegment(a, b, bounds);
        if (!clipped) { line = null; continue; }
        if (line && line.at(-1)[0] === clipped[0][0] && line.at(-1)[1] === clipped[0][1]) line.push(clipped[1]);
        else { line = clipped; lines.push(line); }
      }
    }
    if (lines.length) features.push({
      type: "Feature", properties: { route, name: `Metro route ${route}` },
      geometry: { type: "MultiLineString", coordinates: lines },
    });
  }
  return { type: "FeatureCollection", features };
}

const cache = new Map();
const pending = new Map();
export async function getTransitOverlay(zip, { fetcher = fetch, now = Date.now() } = {}) {
  if (!Object.hasOwn(TRANSIT_BOUNDS, zip)) throw new Error("Unsupported ZIP");
  const existing = cache.get(zip);
  if (existing && existing.expires > now) return existing.value;
  if (pending.has(zip)) return pending.get(zip);
  const request = (async () => {
    const bounds = TRANSIT_BOUNDS[zip];
    const query = new URLSearchParams({
      f: "json", where: "IN_SERVICE_FLAG='Y' AND CURRENT_NEXT_CODE='IN SERVICE'",
      outFields: "ROUTE_NUM,IN_SERVICE_FLAG,CURRENT_NEXT_CODE", returnGeometry: "true",
      geometry: bounds.join(","), geometryType: "esriGeometryEnvelope",
      inSR: "4326", outSR: "4326", spatialRel: "esriSpatialRelIntersects",
      maxAllowableOffset: "0.00008", resultRecordCount: "2000",
    });
    const response = await fetcher(`${TRANSIT_SOURCE}/query?${query}`, { signal: AbortSignal.timeout(10000), cache: "no-store" });
    if (!response.ok) throw new Error("Transit source unavailable");
    const geojson = transitFeatures(await response.json(), bounds);
    const value = { zip, status: "ready", bounds, geojson, fetchedAt: new Date(now).toISOString(), attribution: TRANSIT_ATTRIBUTION, sourceUrl: "https://www5.kingcounty.gov/sdc?Layer=transitroute_line" };
    cache.set(zip, { value, expires: now + 6 * 60 * 60 * 1000 });
    return value;
  })();
  pending.set(zip, request);
  try { return await request; } finally { pending.delete(zip); }
}
