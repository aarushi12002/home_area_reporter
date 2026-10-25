import { createHash } from "node:crypto";

export class ReportRequestError extends Error {
  constructor(message, status = 400, code = "INVALID_REQUEST") { super(message); this.status = status; this.code = code; }
}
export const reportUpdated = () => new ReportRequestError("This report has been updated. Reload the project list.", 409, "REPORT_UPDATED");

export function locationFrom(params) {
  if (!params.has("lat") && !params.has("lng")) return null;
  const lat = params.get("lat"), lng = params.get("lng");
  const latitude = Number(lat), longitude = Number(lng);
  if (lat === null || lng === null || !lat.trim() || !lng.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180)
    throw new ReportRequestError("Invalid listing coordinates.");
  return { latitude, longitude };
}

export function orderingContext(zip, location, includeHidden = false) {
  return createHash("sha256").update(JSON.stringify([zip, location, includeHidden])).digest("hex").slice(0, 24);
}
export function encodeCursor(value) { return Buffer.from(JSON.stringify(value)).toString("base64url"); }
export function decodeCursor(value, { zip, generation, context }) {
  if (!value || value === "0") return null;
  if (typeof value !== "string" || value.length > 2048) throw new ReportRequestError("Invalid project cursor.");
  let cursor;
  try { cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8")); } catch { throw new ReportRequestError("Invalid project cursor."); }
  if (cursor?.v !== 1 || cursor.zip !== zip || cursor.context !== context || typeof cursor.id !== "string" || cursor.id.length > 100 || !Number.isFinite(cursor.score) || !Number.isFinite(cursor.activity))
    throw new ReportRequestError("Invalid project cursor.");
  if (cursor.generation !== generation) throw reportUpdated();
  return cursor;
}
