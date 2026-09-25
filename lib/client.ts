import { API_URL, BASE_HEADERS, QUERY_PARAMS, REQUIRED_COOKIE } from "./config";

export class ClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientError";
  }
}

export class UpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamError";
  }
}

export type TokenResult = {
  token: string;
  expires: number | null;
  login_url: string;
  expiry_text: string;
};

function formatExpiry(expires: number | null): string {
  if (expires === null || !Number.isFinite(expires)) return "Unknown";
  try {
    const d = new Date(expires * 1000);
    if (Number.isNaN(d.getTime())) return String(expires);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return String(expires);
  }
}

function parseResponse(data: unknown): TokenResult {
  const rec = (data ?? {}) as Record<string, unknown>;
  const value = (rec.value ?? {}) as Record<string, unknown>;
  const account = (value.account ?? {}) as Record<string, unknown>;
  const tokenWrap = (account.token ?? {}) as Record<string, unknown>;
  const tokenData = (tokenWrap.default ?? {}) as Record<string, unknown>;

  const token = tokenData.token;

  if (typeof token !== "string" || !token) {
    throw new ClientError("No token found in response.");
  }

  let expiresSeconds: number | null = null;
  const expires = tokenData.expires;
  if (typeof expires === "number" && Number.isFinite(expires)) {
    expiresSeconds = expires;
    if (String(Math.trunc(expires)).length === 13) {
      expiresSeconds = Math.floor(expires / 1000);
    }
  }

  return {
    token,
    expires: expiresSeconds,
    login_url: "https://netflix.com/?nftoken=" + token,
    expiry_text: formatExpiry(expiresSeconds),
  };
}

export async function fetchNftoken(
  cookieDict: Record<string, string>,
): Promise<TokenResult> {
  const netflixId = cookieDict[REQUIRED_COOKIE];
  if (!netflixId) {
    throw new ClientError(`Missing required cookie: ${REQUIRED_COOKIE}`);
  }

  const url = new URL(API_URL);
  for (const [key, value] of Object.entries(QUERY_PARAMS)) {
    url.searchParams.set(key, value);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        ...BASE_HEADERS,
        Cookie: `${REQUIRED_COOKIE}=${netflixId}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new UpstreamError(`Request to Netflix failed: ${message}`);
  }

  if (!response.ok) {
    throw new UpstreamError(
      `Request to Netflix failed: ${response.status} ${response.statusText}`,
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new UpstreamError("Netflix returned a non-JSON response.");
  }

  return parseResponse(data);
}
