/**
 * Server-side pool store with multi-layer persistence.
 *
 * Supports:
 * 1. Cloud Database: Upstash Redis / Vercel KV via standard REST API.
 *    Any upload or change is instantly persisted across all phones, PCs, and serverless containers.
 * 2. Local fallback: /tmp/nftoken_pool.json (for local/testing).
 * 3. In-memory fast cache with 3s TTL to avoid excessive HTTP requests.
 */

import fs from "fs";
import path from "path";
import { detectCountryLabel, fetchCountryViaLoginUrl } from "./country";

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
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
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
      console.error(`Remote KV error ${res.status}: ${res.statusText}`);
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
  const savedRemote = await saveToRemoteKV(entries);

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

  if (!savedRemote && !isDatabaseConnected()) {
    console.warn(
      "[nftoken] Notice: No remote database connected. Entries will stay in RAM only. " +
      "Connect Upstash Redis or Vercel KV via UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN " +
      "to persist pool across all devices and serverless cold starts."
    );
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

export async function poolList(): Promise<PoolEntry[]> {
  const entries = await getPoolEntries();
  ensureCountries(entries);
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
  return entries.filter((e) => e.status === "working");
}

/** Return only working entries with sensitive fields stripped. */
export async function poolPublic(): Promise<PublicPoolEntry[]> {
  const entries = await getPoolEntries();
  ensureCountries(entries);
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
