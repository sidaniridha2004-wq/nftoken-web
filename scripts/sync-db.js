/**
 * One-click script to push your local pool data (data/pool.json)
 * directly into your Upstash Redis database.
 *
 * Usage:
 *   node scripts/sync-db.js <UPSTASH_REDIS_REST_URL> <UPSTASH_REDIS_REST_TOKEN>
 *
 * Or set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in your environment or .env.local
 */

const fs = require("fs");
const path = require("path");

// Load .env or .env.local if present
for (const envFile of [".env.local", ".env"]) {
  const envPath = path.join(__dirname, "..", envFile);
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  }
}

const url =
  process.argv[2] ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.KV_REST_API_URL;

const token =
  process.argv[3] ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.KV_REST_API_TOKEN;

if (!url || !token) {
  console.error(`
❌ Missing Upstash Database credentials.

Usage:
  node scripts/sync-db.js <UPSTASH_REDIS_REST_URL> <UPSTASH_REDIS_REST_TOKEN>

Example:
  node scripts/sync-db.js https://your-db.upstash.io your_token_here
`);
  process.exit(1);
}

const poolFile = path.join(__dirname, "..", "data", "pool.json");
if (!fs.existsSync(poolFile)) {
  console.error("❌ data/pool.json not found on disk.");
  process.exit(1);
}

const raw = fs.readFileSync(poolFile, "utf-8");
const entries = JSON.parse(raw);

console.log(`📡 Connecting to Upstash: ${url.replace(/\/+$/, "")}...`);
console.log(`📦 Preparing to upload ${entries.length} accounts (${(raw.length / 1024).toFixed(1)} KB)...`);

async function sync() {
  const cleanUrl = url.replace(/\/+$/, "");
  const res = await fetch(cleanUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(["SET", "nftoken_pool", JSON.stringify(entries)]),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`❌ Upload failed (HTTP ${res.status}): ${errText}`);
    process.exit(1);
  }

  const result = await res.json();
  console.log("✅ Success! Database updated:", result);
  console.log(`🎉 All ${entries.length} accounts are now live in your Upstash Redis database!`);
  console.log("👉 Refresh your website or phone now to see the pool.");
}

sync().catch((err) => {
  console.error("❌ Error syncing to database:", err);
  process.exit(1);
});
