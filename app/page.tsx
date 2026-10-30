"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { extractCookieDict } from "@/lib/cookies";
import {
  SavedCookie,
  loadSaved,
  newSavedCookie,
  persistSaved,
} from "@/lib/storage";

type NavSection = "overview" | "generate" | "cookies" | "custom" | "vault";

type PublicPoolEntry = {
  id: string;
  label: string;
  country?: string;
  preview: string;
  status: string;
  loginUrl?: string;
  expires?: number | null;
  expiryText?: string;
  addedAt: number;
};

export default function Page() {
  const [activeNav, setActiveNav] = useState<NavSection>("overview");
  const [poolEntries, setPoolEntries] = useState<PublicPoolEntry[]>([]);
  const [loadingPool, setLoadingPool] = useState(true);

  // Random generator states
  const [randomEntry, setRandomEntry] = useState<PublicPoolEntry | null>(null);
  const [randomGenerating, setRandomGenerating] = useState(false);
  const [randomError, setRandomError] = useState<string | null>(null);
  const [randomCopied, setRandomCopied] = useState(false);

  // Pool country filter & search
  const [selectedCountry, setSelectedCountry] = useState("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Custom single cookie generator states
  const [customCookie, setCustomCookie] = useState("");
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const [customResult, setCustomResult] = useState<{
    login_url: string;
    expiry_text: string;
    country?: string;
  } | null>(null);
  const [customCopied, setCustomCopied] = useState(false);

  // Vault
  const [vaultItems, setVaultItems] = useState<SavedCookie[]>([]);

  const fetchPool = useCallback(async () => {
    try {
      const res = await fetch("/api/pool");
      if (res.ok) {
        const data = await res.json();
        setPoolEntries(data.entries ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoadingPool(false);
    }
  }, []);

  useEffect(() => {
    fetchPool();
    setVaultItems(loadSaved());
    const interval = setInterval(fetchPool, 30_000);
    return () => clearInterval(interval);
  }, [fetchPool]);

  async function generateRandomLink() {
    setRandomGenerating(true);
    setRandomError(null);
    setRandomCopied(false);
    try {
      const res = await fetch("/api/pool/random", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setRandomError(data.error || "Could not generate a live link.");
        return;
      }
      setRandomEntry(data);
      if (data.loginUrl) {
        try {
          await navigator.clipboard.writeText(data.loginUrl);
          setRandomCopied(true);
          setTimeout(() => setRandomCopied(false), 2000);
        } catch {
          /* clipboard blocked */
        }
      }
    } catch (err) {
      setRandomError(
        "Network error: " + (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setRandomGenerating(false);
    }
  }

  async function copyToClipboard(text?: string, id?: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      if (id) {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1500);
      }
    } catch {
      /* clipboard blocked */
    }
  }

  async function handleCustomGenerate(e?: FormEvent) {
    e?.preventDefault();
    const val = customCookie.trim();
    if (!val) {
      setCustomError("Please paste a Netflix cookie.");
      return;
    }
    setCustomLoading(true);
    setCustomError(null);
    try {
      const res = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie: val }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCustomError(data.error || "Failed to generate link.");
        setCustomResult(null);
        return;
      }
      setCustomResult(data);
    } catch (err) {
      setCustomError("Network error: " + (err instanceof Error ? err.message : String(err)));
      setCustomResult(null);
    } finally {
      setCustomLoading(false);
    }
  }

  const countries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of poolEntries) {
      const c = e.country || "Other";
      counts.set(c, (counts.get(c) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => {
      if (a[0] === "Other") return 1;
      if (b[0] === "Other") return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [poolEntries]);

  const filteredCookies = useMemo(() => {
    if (selectedCountry === "all") return poolEntries;
    return poolEntries.filter((e) => (e.country || "Other") === selectedCountry);
  }, [poolEntries, selectedCountry]);

  // Formatted current date for overview header (set on client to avoid hydration mismatch)
  const [todayDate, setTodayDate] = useState("");
  useEffect(() => {
    setTodayDate(
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).toUpperCase()
    );
  }, []);

  return (
    <div className="app-container">
      {/* ── Left Sidebar ────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="logo-text">nftoken</span>
        </div>

        <nav className="sidebar-nav">
          <div>
            <div className="nav-section-title">PANEL</div>
            <ul className="nav-list">
              <li>
                <button
                  type="button"
                  className={`nav-item ${activeNav === "overview" ? "active" : ""}`}
                  onClick={() => setActiveNav("overview")}
                >
                  <span className="nav-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                      <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                  </span>
                  Overview
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`nav-item ${activeNav === "generate" ? "active" : ""}`}
                  onClick={() => setActiveNav("generate")}
                >
                  <span className="nav-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                  </span>
                  Generate Link
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`nav-item ${activeNav === "cookies" ? "active" : ""}`}
                  onClick={() => setActiveNav("cookies")}
                >
                  <span className="nav-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
                      <path d="M2 12h20"></path>
                    </svg>
                  </span>
                  Cookies Pool
                </button>
              </li>
            </ul>
          </div>

          <div>
            <div className="nav-section-title">TOOLS</div>
            <ul className="nav-list">
              <li>
                <button
                  type="button"
                  className={`nav-item ${activeNav === "custom" ? "active" : ""}`}
                  onClick={() => setActiveNav("custom")}
                >
                  <span className="nav-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 18 22 12 16 6"></polyline>
                      <polyline points="8 6 2 12 8 18"></polyline>
                    </svg>
                  </span>
                  Custom Cookie
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`nav-item ${activeNav === "vault" ? "active" : ""}`}
                  onClick={() => setActiveNav("vault")}
                >
                  <span className="nav-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </span>
                  Session Vault
                </button>
              </li>
            </ul>
          </div>
        </nav>

        <div className="sidebar-bottom">
          <div className="status-badge">
            <span className="pulse-dot"></span>
            <span>nftoken • Live &amp; Ready</span>
          </div>
        </div>
      </aside>

      {/* ── Main Content Area ───────────────────────────────────── */}
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Panel / <span>{activeNav === "overview" ? "Overview" : activeNav === "generate" ? "Generate Link" : activeNav === "cookies" ? "Cookies" : activeNav === "custom" ? "Custom Cookie" : "Vault"}</span>
          </div>
          <div className="topbar-actions">
            <button className="theme-btn" aria-label="Toggle theme" title="System Theme">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            </button>
          </div>
        </header>

        <div className="page-body">
          {/* ────────────────────────────────────────────────────────── */}
          {/* VIEW 1: OVERVIEW (RESUMEN)                                 */}
          {/* ────────────────────────────────────────────────────────── */}
          {activeNav === "overview" && (
            <div>
              <div className="page-category">{todayDate}</div>
              <div className="overview-header">
                <div>
                  <h1 className="page-title">
                    Welcome to <span className="accent-text">nftoken</span>
                  </h1>
                  <p className="page-desc" style={{ marginBottom: 0 }}>
                    This is your panel. Generate auto-login links, explore the live pool, and access accounts instantly.
                  </p>
                </div>
                <div className="overview-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setActiveNav("cookies")}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    View pool
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setActiveNav("generate")}
                  >
                    <span>+</span> Generate link
                  </button>
                </div>
              </div>

              {/* 4 Stat Cards */}
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-card-head">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <path d="M12 6v6l4 2"></path>
                    </svg>
                    Available Cookies
                  </div>
                  <div className="stat-card-value">{loadingPool ? "…" : poolEntries.length}</div>
                  <div className="stat-card-foot">verified active in pool</div>
                </div>

                <div className="stat-card">
                  <div className="stat-card-head">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                    Auto-Login
                  </div>
                  <div className="stat-card-value">1-Tap</div>
                  <div className="stat-card-foot">ready for instant launch</div>
                </div>

                <div className="stat-card">
                  <div className="stat-card-head">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <path d="M2 12h20"></path>
                    </svg>
                    Countries
                  </div>
                  <div className="stat-card-value">{countries.length}</div>
                  <div className="stat-card-foot">global coverage</div>
                </div>

                <div className="stat-card">
                  <div className="stat-card-head">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    Pool Status
                  </div>
                  <div className="stat-card-value" style={{ color: "var(--ok)" }}>ONLINE</div>
                  <div className="stat-card-foot">100% pre-checked &amp; alive</div>
                </div>
              </div>

              {/* Two Column Layout */}
              <div className="dashboard-split">
                {/* Left Card: Pool Health */}
                <div className="dash-box">
                  <div className="dash-box-head">
                    <div className="dash-box-label">SECURITY &amp; STATUS</div>
                    <div className="dash-box-title">Pool Verification</div>
                  </div>
                  <div className="health-circles-row">
                    <div className="circle-item">
                      <div className="circle-ring green">100%</div>
                      <div>
                        <div className="circle-label-main">Cookies Tested</div>
                        <div className="circle-label-sub">{poolEntries.length} verified</div>
                      </div>
                    </div>
                    <div className="circle-item">
                      <div className="circle-ring">100%</div>
                      <div>
                        <div className="circle-label-main">Instant Tokens</div>
                        <div className="circle-label-sub">No pass needed</div>
                      </div>
                    </div>
                  </div>
                  <p style={{ fontSize: "0.84rem", color: "var(--ink-secondary)", lineHeight: 1.5, marginTop: "8px" }}>
                    Every session is validated directly against Netflix authentication APIs before being published. No expired or dead cookies are shown.
                  </p>
                </div>

                {/* Right Card: Quick Actions */}
                <div className="dash-box">
                  <div className="dash-box-head">
                    <div className="dash-box-label">SHORTCUTS</div>
                    <div className="dash-box-title">Quick Actions</div>
                  </div>
                  <div className="actions-grid">
                    <div className="action-tile" onClick={() => setActiveNav("generate")}>
                      <div className="action-tile-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                        </svg>
                      </div>
                      <div className="action-tile-title">Generate link</div>
                      <div className="action-tile-desc">One-click auto login</div>
                    </div>

                    <div className="action-tile" onClick={() => setActiveNav("cookies")}>
                      <div className="action-tile-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"></circle>
                          <path d="M2 12h20"></path>
                        </svg>
                      </div>
                      <div className="action-tile-title">Cookie pool</div>
                      <div className="action-tile-desc">Explore &amp; unlock</div>
                    </div>

                    <div className="action-tile" onClick={() => setActiveNav("custom")}>
                      <div className="action-tile-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="16 18 22 12 16 6"></polyline>
                          <polyline points="8 6 2 12 8 18"></polyline>
                        </svg>
                      </div>
                      <div className="action-tile-title">Custom cookie</div>
                      <div className="action-tile-desc">Test your own token</div>
                    </div>

                    <div className="action-tile" onClick={() => setActiveNav("vault")}>
                      <div className="action-tile-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                      </div>
                      <div className="action-tile-title">Session vault</div>
                      <div className="action-tile-desc">Saved on this device</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────── */}
          {/* VIEW 2: GENERATE LINK (AUTO-LOGIN)                        */}
          {/* ────────────────────────────────────────────────────────── */}
          {activeNav === "generate" && (
            <div>
              <div className="page-category">AUTO-LOGIN</div>
              <h1 className="page-title">Generate Link</h1>
              <p className="page-desc">
                Create a link that opens Netflix with the session already logged in. No email or password needed.
              </p>

              <div className="feature-card">
                <div className="feature-card-tag">LINK</div>
                <div className="feature-card-title">Your auto-login link</div>
                <p className="feature-card-desc">
                  Click the button below and we will prepare a verified account from the pool for you. The link opens Netflix directly with session active.
                </p>

                <button
                  type="button"
                  className="btn-big-generate"
                  onClick={generateRandomLink}
                  disabled={randomGenerating || (poolEntries.length === 0 && !loadingPool)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                  </svg>
                  {randomGenerating ? "Preparing Verified Live Session…" : "Generate auto-login link"}
                </button>

                {randomError && <div className="error-banner">{randomError}</div>}

                {randomEntry && randomEntry.loginUrl && (
                  <div className="result-box">
                    <div className="result-header">
                      <div className="result-title">
                        <span>{randomEntry.country || "🌐 Global Account"}</span>
                        <span className="result-badge">● Active &amp; Ready</span>
                      </div>
                      <span style={{ fontSize: "0.82rem", color: "var(--ink-secondary)" }}>
                        {randomEntry.expiryText ? `Expires: ${randomEntry.expiryText}` : ""}
                      </span>
                    </div>

                    <div className="result-meta">
                      {randomEntry.label ? `${randomEntry.label} · ` : ""}
                      NetflixId {randomEntry.preview}
                      {randomCopied ? " · (Copied to clipboard!)" : ""}
                    </div>

                    <div className="result-actions">
                      <a
                        className="btn-launch"
                        href={randomEntry.loginUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        🚀 Open Netflix (1-Tap Login)
                      </a>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => copyToClipboard(randomEntry.loginUrl, "random")}
                      >
                        {copiedId === "random" || randomCopied ? "copied ✓" : "copy link"}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={generateRandomLink}
                        disabled={randomGenerating}
                      >
                        🎲 Pick another
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {poolEntries.length === 0 && !loadingPool && (
                <div className="empty-state">
                  <h3>No accounts in the pool yet</h3>
                  <p>All accounts are prepared and verified by the system. Please check back shortly.</p>
                  <button type="button" className="btn-secondary" onClick={() => fetchPool()}>
                    Refresh
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ────────────────────────────────────────────────────────── */}
          {/* VIEW 3: COOKIES POOL                                      */}
          {/* ────────────────────────────────────────────────────────── */}
          {activeNav === "cookies" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div className="page-category">POOL</div>
                  <h1 className="page-title">Available Cookies</h1>
                  <p className="page-desc">
                    Explore the pool by country and launch the account you want.
                  </p>
                </div>
                <div className="status-badge" style={{ marginTop: "10px" }}>
                  Active Pool: <strong>{poolEntries.length} working</strong>
                </div>
              </div>

              {/* Filter Card */}
              <div className="feature-card" style={{ padding: "20px" }}>
                <div className="feature-card-tag">FILTER</div>
                <div style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "4px" }}>
                  Select country
                </div>
                <p style={{ fontSize: "0.85rem", color: "var(--ink-secondary)", margin: 0 }}>
                  Click a country tag to filter accounts. Every cookie is pre-checked and verified live.
                </p>

                <div className="filter-pills-row">
                  <button
                    type="button"
                    className={`filter-pill ${selectedCountry === "all" ? "active" : ""}`}
                    onClick={() => setSelectedCountry("all")}
                  >
                    All ({poolEntries.length})
                  </button>
                  {countries.map(([c, count]) => (
                    <button
                      key={c}
                      type="button"
                      className={`filter-pill ${selectedCountry === c ? "active" : ""}`}
                      onClick={() => setSelectedCountry(c)}
                    >
                      {c} ({count})
                    </button>
                  ))}
                </div>
              </div>

              {/* Cookies Grid */}
              {loadingPool ? (
                <div className="empty-state">Loading verified cookies…</div>
              ) : filteredCookies.length === 0 ? (
                <div className="empty-state">
                  <h3>No cookies available right now</h3>
                  <p>All active accounts are verified live. Check back shortly.</p>
                  <button type="button" className="btn-secondary" onClick={() => fetchPool()}>
                    Refresh
                  </button>
                </div>
              ) : (
                <div className="cookie-cards-grid">
                  {filteredCookies.map((c) => (
                    <div key={c.id} className="cookie-dash-card">
                      <div>
                        <div className="cdc-top">
                          <span className="cdc-country">{c.country || "🌐 Global"}</span>
                          <span className="result-badge">● Active</span>
                        </div>
                        <div className="cdc-mid">
                          <div className="cdc-label">{c.label || `NetflixId ${c.preview}`}</div>
                          <div className="cdc-exp">{c.expiryText ? `Expires: ${c.expiryText}` : "Verified session"}</div>
                        </div>
                      </div>
                      <div className="cdc-actions">
                        {c.loginUrl && (
                          <>
                            <a
                              className="btn-launch"
                              href={c.loginUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              🚀 Open
                            </a>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => copyToClipboard(c.loginUrl, c.id)}
                            >
                              {copiedId === c.id ? "copied ✓" : "copy"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ────────────────────────────────────────────────────────── */}
          {/* VIEW 4: CUSTOM COOKIE GENERATOR                           */}
          {/* ────────────────────────────────────────────────────────── */}
          {activeNav === "custom" && (
            <div>
              <div className="page-category">CUSTOM</div>
              <h1 className="page-title">Custom Cookie</h1>
              <p className="page-desc">
                Paste any Netflix cookie string to test validity and generate your personal 1-tap login link.
              </p>

              <div className="feature-card">
                <form onSubmit={handleCustomGenerate} className="custom-form">
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--ink-secondary)" }}>
                    <span>Cookie Header, JSON, or cookies.txt</span>
                    <span>Only NetflixId required</span>
                  </div>
                  <textarea
                    className="custom-textarea"
                    placeholder="NetflixId=...; SecureNetflixId=..."
                    value={customCookie}
                    onChange={(e) => setCustomCookie(e.target.value)}
                  />
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={customLoading || !customCookie.trim()}
                    >
                      {customLoading ? "Generating…" : "Generate login URL"}
                    </button>
                  </div>
                </form>

                {customError && <div className="error-banner">{customError}</div>}

                {customResult && (
                  <div className="result-box">
                    <div className="result-header">
                      <div className="result-title">
                        <span>{customResult.country || "🌐 Verified Account"}</span>
                        <span className="result-badge">● Active</span>
                      </div>
                    </div>
                    <div className="result-meta">
                      Expires: {customResult.expiry_text || "Unknown"}
                    </div>
                    <div className="result-actions">
                      <a
                        className="btn-launch"
                        href={customResult.login_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        🚀 Open Netflix
                      </a>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          copyToClipboard(customResult.login_url);
                          setCustomCopied(true);
                          setTimeout(() => setCustomCopied(false), 1500);
                        }}
                      >
                        {customCopied ? "copied ✓" : "copy link"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────── */}
          {/* VIEW 5: SESSION VAULT                                     */}
          {/* ────────────────────────────────────────────────────────── */}
          {activeNav === "vault" && (
            <div>
              <div className="page-category">VAULT</div>
              <h1 className="page-title">Session Vault</h1>
              <p className="page-desc">
                Cookies stored in this browser only. Everything stays in your local storage.
              </p>

              {vaultItems.length === 0 ? (
                <div className="empty-state">
                  <h3>Your vault is empty</h3>
                  <p>Cookies generated or saved in this browser will appear here.</p>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setActiveNav("cookies")}
                  >
                    Explore Pool
                  </button>
                </div>
              ) : (
                <div className="cookie-cards-grid">
                  {vaultItems.map((item) => (
                    <div key={item.id} className="cookie-dash-card">
                      <div>
                        <div className="cdc-top">
                          <span className="cdc-country">{item.country || "🌐 Session"}</span>
                          <span className="result-badge">● {item.status}</span>
                        </div>
                        <div className="cdc-mid">
                          <div className="cdc-label">{item.label || item.preview}</div>
                          <div className="cdc-exp">{item.expiryText ? `Expires: ${item.expiryText}` : "Saved local"}</div>
                        </div>
                      </div>
                      <div className="cdc-actions">
                        {item.loginUrl && (
                          <a
                            className="btn-launch"
                            href={item.loginUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            🚀 Open
                          </a>
                        )}
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            const next = vaultItems.filter((v) => v.id !== item.id);
                            setVaultItems(next);
                            persistSaved(next);
                          }}
                        >
                          delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
