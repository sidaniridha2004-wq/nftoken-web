/**
 * Server-side pool store with multi-layer persistence and auto-refresh.
 *
 * Supports:
 * 1. Cloud Database: Upstash Redis / Vercel KV via standard REST API.
 * 2. Automatic 30-minute recheck and refresh of tokens.
 * 3. Fresh on-the-fly token generation for 1-tap logins.
 * 4. Local fallback: /tmp/nftoken_pool.json and data/pool.json.
 */

import fs from "fs";
import path from "path";
import { detectCountryLabel, fetchCountryViaLoginUrl } from "./country";
import { extractCookieDict } from "./cookies";
import { fetchNftoken, ClientError } from "./client";

export type PoolStatus = "working" | "invalid" | "error" | "unchecked";

export interface PoolEntry {
  id: string;
  label: string;
  source?: string;
  country?: string;
  raw: string;          // full cookie string (admin-only)
  preview: string;      // masked NetflixId preview
  status: PoolStatus;
  message?: string;
  loginUrl?: string;
  expires?: number | null;
  expiryText?: string;
  addedAt: number;
  lastChecked?: number;
}

/** Public-safe subset — never exposes `raw`. */
export interface PublicPoolEntry {
  id: string;
  label: string;
  country?: string;
  preview: string;
  status: PoolStatus;
  loginUrl?: string;
  expires?: number | null;
  expiryText?: string;
  addedAt: number;
}

// ---------------------------------------------------------------------------
// Database / KV Configuration
// ---------------------------------------------------------------------------

function getKvConfig(): { url: string; token: string } | null {
  let url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  let token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    for (const [key, val] of Object.entries(process.env)) {
      if (!val) continue;
      const upper = key.toUpperCase();
      if (!url && (upper.endsWith("_REST_URL") || (upper.endsWith("_URL") && val.startsWith("https://")))) {
        url = val;
      }
      if (!token && (upper.endsWith("_REST_TOKEN") || upper.endsWith("_TOKEN"))) {
        token = val;
      }
    }
  }

  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token: token.trim() };
}

export function isDatabaseConnected(): boolean {
  return Boolean(getKvConfig());
}

const poolGlobalKey = "__nftoken_pool_entries__";
let lastKvFetchTime = 0;
const KV_CACHE_TTL_MS = 3000; // 3 seconds in-memory TTL

async function loadFromRemoteKV(): Promise<PoolEntry[] | null> {
  const config = getKvConfig();
  if (!config) return null;

  try {
    const res = await fetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["GET", "nftoken_pool"]),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (!data || data.result === null || data.result === undefined) return null;

    const val = typeof data.result === "string" ? JSON.parse(data.result) : data.result;
    if (Array.isArray(val)) return val;
  } catch (err) {
    console.error("Failed to read from Remote KV:", err);
  }
  return null;
}

async function saveToRemoteKV(entries: PoolEntry[]): Promise<boolean> {
  const config = getKvConfig();
  if (!config) return false;

  try {
    const res = await fetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["SET", "nftoken_pool", JSON.stringify(entries)]),
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });

    return res.ok;
  } catch (err) {
    console.error("Failed to write to Remote KV:", err);
    return false;
  }
}

function loadInitialFromDisk(): PoolEntry[] {
  // Check writable tmp path
  const tmpPath = path.join("/tmp", "nftoken_pool.json");
  try {
    if (fs.existsSync(tmpPath)) {
      const data = fs.readFileSync(tmpPath, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  // Check bundled data directory
  const possiblePaths = [
    path.join(process.cwd(), "data", "pool.json"),
    path.join(__dirname, "..", "data", "pool.json"),
  ];

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        const data = fs.readFileSync(p, "utf-8");
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
  }

  return [];
}

async function savePool(entries: PoolEntry[]): Promise<void> {
  const json = JSON.stringify(entries);

  // 1. Save to Remote KV (Upstash Redis / Vercel KV) if available
  await saveToRemoteKV(entries);

  // 2. Also try writing local disk / tmp
  try {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, "pool.json"), JSON.stringify(entries, null, 2), "utf-8");
  } catch {
    try {
      fs.writeFileSync(path.join("/tmp", "nftoken_pool.json"), json, "utf-8");
    } catch {}
  }
}

async function getPoolEntries(): Promise<PoolEntry[]> {
  const g = globalThis as unknown as Record<string, unknown>;
  const now = Date.now();

  const config = getKvConfig();
  if (config) {
    // If not loaded or cache has expired, pull latest database state
    if (!g[poolGlobalKey] || now - lastKvFetchTime > KV_CACHE_TTL_MS) {
      const remote = await loadFromRemoteKV();
      if (remote !== null) {
        g[poolGlobalKey] = remote;
        lastKvFetchTime = now;
        return remote;
      }
    }
  }

  if (!g[poolGlobalKey]) {
    g[poolGlobalKey] = loadInitialFromDisk();
    lastKvFetchTime = now;
  }

  return g[poolGlobalKey] as PoolEntry[];
}

let resolvingMissing = false;
async function resolveMissingLive(entries: PoolEntry[]) {
  if (resolvingMissing) return;
  resolvingMissing = true;
  try {
    const missing = entries.filter((e) => (!e.country || !e.country.trim()) && e.loginUrl);
    if (missing.length === 0) return;

    const concurrency = 6;
    let idx = 0;
    const worker = async () => {
      while (idx < missing.length) {
        const entry = missing[idx++];
        if (!entry || !entry.loginUrl) continue;
        try {
          const c = await fetchCountryViaLoginUrl(entry.loginUrl);
          if (c) entry.country = c;
        } catch {
          // ignore individual error
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(concurrency, missing.length) }, () => worker()),
    );
    await savePool(entries);
  } catch {
    // ignore
  } finally {
    resolvingMissing = false;
  }
}

function ensureCountries(entries: PoolEntry[]): void {
  let hasMissing = false;
  for (const entry of entries) {
    if (!entry.country || !entry.country.trim()) {
      const found = detectCountryLabel(entry.raw, entry.source);
      if (found) {
        entry.country = found;
      } else if (entry.loginUrl) {
        hasMissing = true;
      }
    }
  }
  if (hasMissing) {
    void resolveMissingLive(entries);
  }
}

// ---------------------------------------------------------------------------
// 30-Minute Automatic Recheck Engine
// ---------------------------------------------------------------------------

let isRechecking = false;
let lastAutoRecheckTime = 0;
const AUTO_RECHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export async function poolRecheck(batchLimit: number = 50): Promise<{ total: number; working: number; dead: number; checked: number }> {
  if (isRechecking) {
    const list = await getPoolEntries();
    return {
      total: list.length,
      working: list.filter((e) => e.status === "working").length,
      dead: list.filter((e) => e.status === "invalid").length,
      checked: 0,
    };
  }

  isRechecking = true;
  lastAutoRecheckTime = Date.now();

  try {
    const entries = await getPoolEntries();
    if (entries.length === 0) {
      return { total: 0, working: 0, dead: 0, checked: 0 };
    }

    // Prioritize checking accounts that haven't been checked in the longest time or are expired
    const validEntries = [...entries]
      .filter((e) => e.raw && e.raw.trim().length > 0)
      .sort((a, b) => (a.lastChecked || 0) - (b.lastChecked || 0));

    const toCheck = validEntries.slice(0, batchLimit);
    const concurrency = 6;
    let idx = 0;
    let checkedCount = 0;

    const worker = async () => {
      while (idx < toCheck.length) {
        const entry = toCheck[idx++];
        if (!entry) continue;
        try {
          const dict = extractCookieDict(entry.raw);
          const result = await fetchNftoken(dict);
          entry.status = "working";
          entry.loginUrl = result.login_url;
          entry.expires = result.expires;
          entry.expiryText = result.expiry_text;
          entry.lastChecked = Date.now();
        } catch (err) {
          const isClient = err instanceof ClientError;
          entry.status = isClient ? "invalid" : "error";
          entry.message = err instanceof Error ? err.message : String(err);
          entry.lastChecked = Date.now();
        }
        checkedCount++;
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(concurrency, toCheck.length) }, () => worker()),
    );

    await savePool(entries);

    const working = entries.filter((e) => e.status === "working").length;
    const dead = entries.filter((e) => e.status === "invalid").length;
    return { total: entries.length, working, dead, checked: checkedCount };
  } finally {
    isRechecking = false;
  }
}

export function triggerAutoRecheckIfNeeded(): void {
  const now = Date.now();
  if (lastAutoRecheckTime === 0) {
    lastAutoRecheckTime = now;
    return;
  }
  if (now - lastAutoRecheckTime >= AUTO_RECHECK_INTERVAL_MS && !isRechecking) {
    void poolRecheck();
  }
}

export async function poolList(): Promise<PoolEntry[]> {
  const entries = await getPoolEntries();
  ensureCountries(entries);
  triggerAutoRecheckIfNeeded();
  return entries;
}

export async function poolAdd(entry: PoolEntry): Promise<void> {
  const entries = await getPoolEntries();
  entries.push(entry);
  await savePool(entries);
}

export async function poolAddMany(batch: PoolEntry[]): Promise<void> {
  const entries = await getPoolEntries();
  entries.push(...batch);
  await savePool(entries);
}

export async function poolRemove(id: string): Promise<boolean> {
  const entries = await getPoolEntries();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  entries.splice(idx, 1);
  await savePool(entries);
  return true;
}

export async function poolPatch(id: string, changes: Partial<PoolEntry>): Promise<boolean> {
  const entries = await getPoolEntries();
  const entry = entries.find((e) => e.id === id);
  if (!entry) return false;
  Object.assign(entry, changes);
  await savePool(entries);
  return true;
}

export async function poolClear(): Promise<number> {
  const entries = await getPoolEntries();
  const count = entries.length;
  entries.length = 0;
  await savePool(entries);
  return count;
}

export async function poolClearDead(): Promise<number> {
  const entries = await getPoolEntries();
  let removed = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].status === "invalid") {
      entries.splice(i, 1);
      removed++;
    }
  }
  if (removed > 0) await savePool(entries);
  return removed;
}

export async function poolGet(id: string): Promise<PoolEntry | undefined> {
  const entries = await getPoolEntries();
  return entries.find((e) => e.id === id);
}

export async function poolGetWorking(): Promise<PoolEntry[]> {
  const entries = await getPoolEntries();
  ensureCountries(entries);
  triggerAutoRecheckIfNeeded();
  return entries.filter((e) => e.status === "working");
}

/**
 * Mint a fresh live login URL for an entry on-demand.
 * Used when a user clicks "Open" or "Copy" on a specific card.
 */
export async function poolMintFreshToken(id: string): Promise<{ loginUrl: string; expires?: number | null; expiryText?: string } | null> {
  const entry = await poolGet(id);
  if (!entry || !entry.raw) return null;

  try {
    const dict = extractCookieDict(entry.raw);
    const result = await fetchNftoken(dict);
    await poolPatch(entry.id, {
      status: "working",
      loginUrl: result.login_url,
      expires: result.expires,
      expiryText: result.expiry_text,
      lastChecked: Date.now(),
    });
    return {
      loginUrl: result.login_url,
      expires: result.expires,
      expiryText: result.expiry_text,
    };
  } catch (err) {
    if (err instanceof ClientError) {
      await poolPatch(entry.id, {
        status: "invalid",
        message: err.message,
        lastChecked: Date.now(),
      });
    }
    return null;
  }
}

/** Return only working entries with sensitive fields stripped. */
export async function poolPublic(): Promise<PublicPoolEntry[]> {
  const entries = await getPoolEntries();
  ensureCountries(entries);
  triggerAutoRecheckIfNeeded();
  return entries
    .filter((e) => e.status === "working")
    .map(({ id, label, country, preview, status, loginUrl, expires, expiryText, addedAt }) => ({
      id,
      label,
      country,
      preview,
      status,
      loginUrl,
      expires,
      expiryText,
      addedAt,
    }));
}
