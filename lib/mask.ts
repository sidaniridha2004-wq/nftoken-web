import { extractCookieDict } from "./cookies";

/** Mask a secret value, keeping enough on each end to tell entries apart. */
export function maskValue(value: string): string {
  if (!value) return "—";
  if (value.length <= 12) return value.slice(0, 4) + "…";
  return value.slice(0, 6) + "…" + value.slice(-4);
}

/** A short, masked preview of the NetflixId inside a raw cookie string. */
export function netflixIdPreview(raw: string): string {
  const id = extractCookieDict(raw)["NetflixId"];
  return id ? maskValue(id) : "—";
}
