/**
 * Server-side pool store with multi-layer persistence.
 *
 * Supports:
 * 1. Seed file (data/pool.json) bundled with deployment for instant cold-start readiness on Vercel & Netlify.
 * 2. In-memory global singleton for zero-latency lookups.
 * 3. /tmp/ filesystem cache for serverless environments.
 * 4. Optional Upstash Redis / Vercel KV remote sync via standard REST API if configured.
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
// Store & Persistence
// ---------------------------------------------------------------------------

const poolGlobalKey = "__nftoken_pool_entries__";
const poolLoadedKey = "__nftoken_pool_loaded__";

function loadInitialFromDisk(): PoolEntry[] {
  // 1. Check /tmp (if serverless instance previously saved updates)
  const tmpPath = path.join("/tmp", "nftoken_pool.json");
  try {
    if (fs.existsSync(tmpPath)) {
      const data = fs.readFileSync(tmpPath, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  // 2. Check bundled data directory
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

function syncToRemoteKV(entries: PoolEntry[]): void {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return;

  fetch(`${url}/set/nftoken_pool`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(entries),
  }).catch(() => {});
}

let kvCheckInitiated = false;
function checkRemoteKV(): void {
  if (kvCheckInitiated) return;
  kvCheckInitiated = true;

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return;

  fetch(`${url}/get/nftoken_pool`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!data) return;
      const rawVal = data.result;
      const val = typeof rawVal === "string" ? JSON.parse(rawVal) : rawVal;
      if (Array.isArray(val) && val.length > 0) {
        const current = getPoolEntries();
        current.length = 0;
        current.push(...val);
      }
    })
    .catch(() => {});
}

function savePool(entries: PoolEntry[]): void {
  const json = JSON.stringify(entries, null, 2);

  // Try writing to data/pool.json (works in local dev / Docker / VPS)
  try {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, "pool.json"), json, "utf-8");
  } catch {
    // Read-only serverless filesystem (Vercel / Netlify): fallback to /tmp
    try {
      fs.writeFileSync(path.join("/tmp", "nftoken_pool.json"), json, "utf-8");
    } catch {}
  }

  // Sync to remote KV if credentials are provided
  syncToRemoteKV(entries);
}

function getPoolEntries(): PoolEntry[] {
  const g = globalThis as unknown as Record<string, unknown>;
  if (!g[poolGlobalKey]) {
    const initial = loadInitialFromDisk();
    g[poolGlobalKey] = initial;
    g[poolLoadedKey] = true;
    checkRemoteKV();
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
    savePool(entries);
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

export function poolList(): PoolEntry[] {
  const entries = getPoolEntries();
  ensureCountries(entries);
  return entries;
}

export function poolAdd(entry: PoolEntry): void {
  const entries = getPoolEntries();
  entries.push(entry);
  savePool(entries);
}

export function poolAddMany(batch: PoolEntry[]): void {
  const entries = getPoolEntries();
  entries.push(...batch);
  savePool(entries);
}

export function poolRemove(id: string): boolean {
  const entries = getPoolEntries();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  entries.splice(idx, 1);
  savePool(entries);
  return true;
}

export function poolPatch(id: string, changes: Partial<PoolEntry>): boolean {
  const entries = getPoolEntries();
  const entry = entries.find((e) => e.id === id);
  if (!entry) return false;
  Object.assign(entry, changes);
  savePool(entries);
  return true;
}

export function poolClear(): number {
  const entries = getPoolEntries();
  const count = entries.length;
  entries.length = 0;
  savePool(entries);
  return count;
}

export function poolClearDead(): number {
  const entries = getPoolEntries();
  let removed = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].status === "invalid") {
      entries.splice(i, 1);
      removed++;
    }
  }
  if (removed > 0) savePool(entries);
  return removed;
}

export function poolGet(id: string): PoolEntry | undefined {
  return getPoolEntries().find((e) => e.id === id);
}

export function poolGetWorking(): PoolEntry[] {
  const entries = getPoolEntries();
  ensureCountries(entries);
  return entries.filter((e) => e.status === "working");
}

/** Return only working entries with sensitive fields stripped. */
export function poolPublic(): PublicPoolEntry[] {
  const entries = getPoolEntries();
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
