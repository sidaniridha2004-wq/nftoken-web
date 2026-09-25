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
