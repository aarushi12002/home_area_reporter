/** Seattle permit research. Pure normalization is shared with deterministic tests. */
export const SOURCES = [
  {
    id: "76t5-zqzr",
    name: "Seattle Building Permits",
    select:
      "permitnum,permittypedesc,permittypemapped,description,housingunitsadded,housingunitsremoved,statuscurrent,originaladdress1,originalzip,relatedmup,parentpermitnum,applieddate,issueddate,completeddate,latitude,longitude,link",
  },
  {
    id: "ht3q-kdvx",
    name: "Seattle Land Use Permits",
    select:
      "permitnum,permittypedesc,permittypemapped,description,housingunitsadded,housingunitsremoved,statuscurrent,originaladdress1,originalzip,applieddate,issueddate,decisiondate,latitude,longitude,link",
  },
];
export function validZip(zip) {
  return typeof zip === "string" && /^98\d{3}$/.test(zip);
}
const EXCLUDED =
  /cancel|complet|expir|withdraw|void|closed|denied|finaled|finalized/i;
export function classify(row) {
  const status = String(row.statuscurrent || "").trim();
  const text = String(row.description || "");
  if (
    EXCLUDED.test(status) ||
    row.completeddate ||
    /\b(project cancel(?:led|ed)|cancel(?:led|ed) project|no work authorized|administrative permit only|blanket permit)\b/i.test(
      text,
    ) ||
    /blanket/i.test(row.permittypedesc || "")
  )
    return null;
  if (!status) return null;
  const stage =
    /^(issued|approved|decision issued|approved with conditions)$/i.test(status)
      ? "Permit / decision recorded"
      : /review|application|applied|additional info|correction|scheduled|intake|screen|routing|pending|accepted/i.test(
            status,
          )
        ? "Application / review"
        : "Status needs interpretation";
  return { stage, status };
}
export function relevant(row) {
  const s = [row.description, row.permittypedesc, row.permittypemapped].join(
    " ",
  );
  const majorDevelopment =
    /new construction|construct(?:ion)?(?: of)?\s+(?:(?:a|an)\s+)?(?:new\s+)?(?:\d+[ -]unit\s+)?(?:apartment|townhome|residential|mixed.use|building)|new.{0,50}(?:apartments?|townhomes?|dwelling|mixed.use)|demolish|demolition|short plat|subdivis|land use|design review/i;
  const explicitlyNewDevelopment =
    /new construction|construct(?:ion)?(?: of)?\s+(?:(?:a|an)\s+)?new\s+(?:\d+[ -]unit\s+)?(?:apartment|townhome|residential|mixed.use|building)/i;
  const routineAlteration =
    /tenant improvement|interior only|alterations?|accessory structure|kitchen|bath(?:room)?|subject to field inspection|\bstfi\b|re-roof|reroof|water heater|replace windows|sign installation/i;
  if (
    routineAlteration.test(s) &&
    !explicitlyNewDevelopment.test(s) &&
    Number(row.housingunitsadded || 0) <= 1
  )
    return false;
  return majorDevelopment.test(s) || Number(row.housingunitsadded) > 1;
}
function safeLink(row, source) {
  try {
    const raw = typeof row.link === "string" ? row.link : row.link?.url;
    const u = new URL(raw);
    if (
      u.protocol === "https:" &&
      [
        "services.seattle.gov",
        "data.seattle.gov",
        "cos-data.seattle.gov",
      ].includes(u.hostname)
    )
      return u.href;
  } catch {}
  return `https://data.seattle.gov/resource/${source.id}.json?${new URLSearchParams({ permitnum: String(row.permitnum) })}`;
}
function date(row) {
  return row.decisiondate || row.issueddate || row.applieddate || null;
}
export function normalize(groups, zip) {
  const rows = [];
  let excluded = 0;
  for (const { source, records } of groups)
    for (const row of records) {
      if (String(row.originalzip || "").slice(0, 5) !== zip || !row.permitnum) {
        excluded++;
        continue;
      }
      const state = classify(row);
      if (!state || !relevant(row)) {
        excluded++;
        continue;
      }
      rows.push({
        key: row.relatedmup || row.parentpermitnum || row.permitnum,
        id: row.permitnum,
        address: row.originaladdress1 || "Address not supplied",
        description: String(row.description || "No description supplied"),
        ...state,
        date: date(row),
        added: row.housingunitsadded ?? null,
        removed: row.housingunitsremoved ?? null,
        latitude: Number.isFinite(Number(row.latitude)) ? Number(row.latitude) : null,
        longitude: Number.isFinite(Number(row.longitude)) ? Number(row.longitude) : null,
        source: source.name,
        sourceId: source.id,
        url: safeLink(row, source),
      });
    }
  const parent = new Map();
  for (const x of rows) parent.set(x.id, x.key);
  const root = (id) => {
    const seen = new Set();
    while (parent.has(id) && parent.get(id) !== id && !seen.has(id)) {
      seen.add(id);
      id = parent.get(id);
    }
    return id;
  };
  const map = new Map();
  for (const x of rows) {
    const k = root(x.id);
    const item = map.get(k);
    if (item) item.records.push(x);
    else map.set(k, { id: k, address: x.address, records: [x] });
  }
  const projects = [...map.values()].map((p) => {
    const primary = p.records.find((x) => x.id === p.id) || p.records[0];
    return {
      ...p,
      primary,
      consideration:
        "This record describes development activity, not guaranteed construction or economic growth. Review the current official status and scope before relying on it.",
    };
  });
  const eventTime = (p) => {
    const t = Date.parse(p.primary.date || "");
    return Number.isFinite(t) ? t : 0;
  };
  projects.sort(
    (a, b) =>
      eventTime(b) - eventTime(a) ||
      b.id.localeCompare(a.id, undefined, { numeric: true }),
  );
  return { projects, excluded };
}
export async function fetchSource(
  source,
  zip,
  { fetcher = fetch, pageSize = 250, maxPages = 4, deadlineMs = 18000 } = {},
) {
  const records = [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deadlineMs);
  let truncated = false;
  try {
    for (let page = 0; page < maxPages; page++) {
      const qs = new URLSearchParams({
        $select: source.select,
        $where: `originalzip='${zip}' AND statuscurrent NOT IN ('Completed','Canceled','Cancelled','Expired','Withdrawn','Closed','Denied','Void')`,
        $order: "permitnum DESC, :id",
        $limit: String(pageSize),
        $offset: String(page * pageSize),
      });
      const response = await fetcher(
        `https://data.seattle.gov/resource/${source.id}.json?${qs}`,
        {
          signal: controller.signal,
          cache: "no-store",
          headers: process.env.SOCRATA_APP_TOKEN
            ? { "X-App-Token": process.env.SOCRATA_APP_TOKEN }
            : {},
        },
      );
      if (!response.ok)
        throw new Error(`Source returned HTTP ${response.status}`);
      const body = await response.json();
      if (!Array.isArray(body)) throw new Error("Unexpected source response");
      records.push(...body);
      if (body.length < pageSize) break;
      if (page === maxPages - 1) truncated = true;
    }
    return {
      source,
      records,
      status: truncated ? "limited" : "ok",
      truncated,
      error: null,
      retrievedAt: new Date().toISOString(),
    };
  } catch (e) {
    return {
      source,
      records,
      status: "failed",
      truncated: true,
      error:
        e?.name === "AbortError"
          ? "Source request timed out"
          : "Source unavailable; retry later",
      retrievedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }
}
export async function buildReport(zip, { fetcher = fetch, ...options } = {}) {
  if (!validZip(zip))
    throw new Error("Enter a five-digit Seattle-area ZIP beginning with 98.");
  const result = await Promise.all(
    SOURCES.map((source) => fetchSource(source, zip, { fetcher, ...options })),
  );
  const normalized = normalize(result, zip);
  const status = result.every((x) => x.status === "failed")
    ? "unavailable"
    : result.some((x) => x.status !== "ok")
      ? "partial"
      : "ready";
  return {
    zip,
    status,
    ...normalized,
    generatedAt: new Date().toISOString(),
    coverage: result.map(
      ({ source, status, error, retrievedAt, records, truncated }) => ({
        id: source.id,
        name: source.name,
        status,
        error,
        retrievedAt,
        recordsExamined: records.length,
        truncated,
        url: `https://data.seattle.gov/d/${source.id}`,
      }),
    ),
    limits: [
      "Seattle permit records only; ZIPs can extend outside Seattle. A ZIP with no records may be unsupported.",
      "Not a complete inventory of future projects. Transit, public infrastructure and parking changes are not connected yet.",
      "Records without a usable ZIP, missing from city feeds, or beyond query limits are not included.",
      "Original status and source dates are preserved. Retrieval time is not the city record update time.",
      "Explicit permit links are grouped; other duplicate projects may remain. Housing figures are record-level, not aggregated.",
    ],
  };
}
