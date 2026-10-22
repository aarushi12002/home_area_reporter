export function soundscoreLocation(searchParams) {
  const lat = searchParams.get("lat"), lng = searchParams.get("lng");
  if (!lat?.trim() || !lng?.trim()) return null;
  const latitude = Number(lat), longitude = Number(lng);
  // This product currently serves Seattle only. Reject arbitrary global queries.
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 47.48 || latitude > 47.75 || longitude < -122.46 || longitude > -122.23) return null;
  return { latitude, longitude };
}

export async function fetchSoundscore(location, { apiKey = process.env.HOWLOUD_API_KEY, fetcher = fetch } = {}) {
  if (!apiKey) return { status: "not_configured" };
  const query = new URLSearchParams({ lat: String(location.latitude), lng: String(location.longitude) });
  const response = await fetcher(`https://api.howloud.com/v2/score?${query}`, {
    headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(8000), cache: "no-store",
  });
  if (!response.ok) return { status: response.status === 429 ? "limit_reached" : "unavailable" };
  const data = await response.json();
  // Official docs show both result object and result[0] examples; accept either.
  const result = Array.isArray(data.result) ? data.result[0] : data.result;
  if (data.status !== "OK" || typeof result?.score !== "number" || !Number.isFinite(result.score) || result.score < 50 || result.score > 100)
    return { status: "unavailable" };
  const text = (value) => typeof value === "string" ? value.slice(0, 80) : null;
  return { status: "ready", score: result.score, label: text(result.scoretext), traffic: text(result.traffictext), local: text(result.localtext), airports: text(result.airportstext), provider: "HowLoud", url: "https://howloud.com/" };
}
