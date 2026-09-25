import { COOKIE_KEYS } from "./config";

function decodeCookieValue(value: string): string {
  if (value.includes("%")) {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return value;
}

function parseNetscapeCookieLine(line: string): Record<string, string> {
  const parts = line.trim().split("\t");
  if (parts.length >= 7) {
    return { [parts[5]]: parts[6] };
  }
  return {};
}

function collectNamedCookies(
  cookies: unknown[],
  cookieDict: Record<string, string>,
) {
  for (const cookie of cookies) {
    if (!cookie || typeof cookie !== "object") continue;
    const rec = cookie as Record<string, unknown>;
    const name = rec.name;
    const value = rec.value;
    if (
      typeof name === "string" &&
      COOKIE_KEYS.includes(name as (typeof COOKIE_KEYS)[number]) &&
      typeof value === "string"
    ) {
      cookieDict[name] = decodeCookieValue(value);
    }
  }
}

function extractFromJson(text: string, cookieDict: Record<string, string>) {
  try {
    const data: unknown = JSON.parse(text);
    if (Array.isArray(data)) {
      collectNamedCookies(data, cookieDict);
    } else if (data && typeof data === "object") {
      const rec = data as Record<string, unknown>;
      if (COOKIE_KEYS.some((key) => key in rec)) {
        for (const key of COOKIE_KEYS) {
          const value = rec[key];
          if (typeof value === "string") {
            cookieDict[key] = decodeCookieValue(value);
          }
        }
      } else if (Array.isArray(rec.cookies)) {
        collectNamedCookies(rec.cookies, cookieDict);
      }
    }
  } catch {
    // not JSON — fall through to other parsers
  }
}

/** Extract known Netflix cookies from raw header, cookies.txt, or JSON. */
export function extractCookieDict(text: string): Record<string, string> {
  const cookieDict: Record<string, string> = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    Object.assign(cookieDict, parseNetscapeCookieLine(line));
  }

  extractFromJson(text, cookieDict);

  for (const key of COOKIE_KEYS) {
    if (key in cookieDict) continue;
    const pattern = "(?:^|[^A-Za-z0-9_])" + key + "=([^;,\\s]+)";
    const match = text.match(new RegExp(pattern));
    if (match) {
      cookieDict[key] = decodeCookieValue(match[1]);
    }
  }

  return cookieDict;
}

/**
 * Split a bulk paste into individual cookie entries.
 *
 * Supported bulk shapes:
 *   - One cookie per line (raw header, or a single NetflixId=...).
 *   - A JSON array of strings: ["NetflixId=...", "NetflixId=..."].
 *   - A JSON array of cookie-export objects, split into one entry each.
 *   - Blocks separated by a blank line or a line of dashes (for multi-line
 *     JSON exports pasted back-to-back).
 */
export function splitBulkCookies(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Whole-input JSON array handling.
  try {
    const data: unknown = JSON.parse(trimmed);
    if (Array.isArray(data)) {
      // Array of plain strings -> one entry per string.
      if (data.every((item) => typeof item === "string")) {
        return (data as string[]).map((s) => s.trim()).filter(Boolean);
      }
      // Array of export objects: keep the whole array as one entry only if it
      // looks like a single browser export; otherwise split per object.
      const objects = data.filter(
        (item) => item && typeof item === "object",
      ) as Record<string, unknown>[];
      const hasNetflixId = (o: Record<string, unknown>) =>
        o.name === "NetflixId" || "NetflixId" in o;
      const perObject = objects.filter(hasNetflixId);
      if (perObject.length > 1) {
        return perObject.map((o) => JSON.stringify(o));
      }
      return [trimmed];
    }
  } catch {
    // not a JSON array — fall through to line/block splitting
  }

  // Split on blank lines or dashed separators into blocks.
  const blocks = trimmed
    .split(/\n\s*\n|\n-{3,}\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const entries: string[] = [];
  for (const block of blocks) {
    // A block that is itself valid JSON is one entry.
    try {
      JSON.parse(block);
      entries.push(block);
      continue;
    } catch {
      // otherwise treat each non-empty, non-comment line as one entry
    }
    for (const rawLine of block.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      entries.push(line);
    }
  }

  // De-duplicate while preserving order.
  return Array.from(new Set(entries));
}

/**
 * Rebuild a cookie header string from an extracted dict, preserving the raw
 * (URL-encoded) values so it round-trips exactly like a pasted cookie header.
 */
export function serializeCookieDict(dict: Record<string, string>): string {
  return COOKIE_KEYS.filter((key) => dict[key])
    .map((key) => `${key}=${dict[key]}`)
    .join("; ");
}
