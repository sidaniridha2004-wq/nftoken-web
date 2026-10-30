/**
 * Admin authentication with stateless signed session tokens.
 *
 * Password is read from ADMIN_PASSWORD env var (default: "admin").
 * Uses HMAC-SHA256 signature so tokens can be verified by ANY serverless lambda
 * instance on Vercel or Netlify without requiring shared memory or database.
 */

import { createHmac, randomUUID } from "crypto";

const PASSWORD = process.env.ADMIN_PASSWORD || "admin";

/** Active in-memory session tokens for dev / local hot-reloads. */
const globalKey = "__nftoken_admin_sessions__";
function getSessions(): Set<string> {
  const g = globalThis as unknown as Record<string, Set<string>>;
  if (!g[globalKey]) g[globalKey] = new Set<string>();
  return g[globalKey];
}

function signTimestamp(timestamp: string): string {
  return createHmac("sha256", PASSWORD).update(`adm:${timestamp}`).digest("hex");
}

/** Validate a password and return a signed session token. */
export function login(password: string): string | null {
  if (password !== PASSWORD) return null;
  const now = Date.now().toString();
  const signature = signTimestamp(now);
  const token = `adm.${now}.${signature}`;
  getSessions().add(token);
  return token;
}

/** Check whether a request carries a valid admin session token. */
export function verifyAdmin(request: Request): boolean {
  const auth = request.headers.get("Authorization");
  if (!auth) return false;
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;

  // 1. Direct password match (allows CLI / script automation)
  if (token === PASSWORD) return true;

  // 2. In-memory check (for fast local dev lookup)
  if (getSessions().has(token)) return true;

  // 3. Stateless cryptographically signed token (for Vercel & Netlify serverless instances)
  if (token.startsWith("adm.")) {
    const parts = token.split(".");
    if (parts.length === 3) {
      const [, issuedStr, sig] = parts;
      const expected = signTimestamp(issuedStr);
      if (sig === expected) {
        // Token valid for 14 days
        const issued = parseInt(issuedStr, 10);
        const maxAge = 14 * 24 * 60 * 60 * 1000;
        if (!isNaN(issued) && Date.now() - issued < maxAge) {
          getSessions().add(token);
          return true;
        }
      }
    }
  }

  return false;
}

/** Revoke a session token. */
export function logout(request: Request): void {
  const auth = request.headers.get("Authorization");
  if (!auth) return;
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  getSessions().delete(token);
}
