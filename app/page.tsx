"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { extractCookieDict, splitBulkCookies } from "@/lib/cookies";
import {
  SavedCookie,
  SavedStatus,
  loadSaved,
  newSavedCookie,
  persistSaved,
} from "@/lib/storage";

type Tab = "generate" | "vault";

type CheckResponse = {
  status: "working" | "invalid" | "error";
  message?: string;
  login_url?: string;
  expires?: number | null;
  expiry_text?: string;
  netflix_id_preview: string;
};

async function checkCookie(raw: string): Promise<CheckResponse> {
  try {
    const res = await fetch("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cookie: raw }),
    });
    return (await res.json()) as CheckResponse;
  } catch (err) {
    return {
      status: "error",
      message: "Network error: " + (err instanceof Error ? err.message : String(err)),
      netflix_id_preview: "\u2014",
    };
  }
}

/** Run async work over items with limited concurrency. */
async function pool<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

function statusLabel(status: SavedStatus): string {
  switch (status) {
    case "working":
      return "working";
    case "invalid":
      return "dead";
    case "error":
      return "error";
    default:
      return "unchecked";
  }
}

function relativeTime(ts?: number): string {
  if (!ts) return "never";
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

export default function Page() {
  const [tab, setTab] = useState<Tab>("generate");

  return (
    <main>
      <header className="masthead">
        <p className="eyebrow">netflix \u00b7 session utility</p>
        <h1>
          <span className="caret">\u203a</span> nftoken
        </h1>
        <p className="lede">
          Turn a Netflix session cookie into a one-tap login URL, check whether
          cookies are still alive, and keep a saved vault \u2014 all in your browser.
        </p>
      </header>

      <nav className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "generate"}
          className={tab === "generate" ? "tab active" : "tab"}
          onClick={() => setTab("generate")}
        >
          Generate
        </button>
        <button
          role="tab"
          aria-selected={tab === "vault"}
          className={tab === "vault" ? "tab active" : "tab"}
          onClick={() => setTab("vault")}
        >
          Vault, import &amp; check
        </button>
      </nav>

      {tab === "generate" ? <GeneratePanel /> : <VaultPanel />}

      <footer>
        <span>v2.1.0</span>
        <span className="sep">/</span>
        <a
          href="https://github.com/sidaniridha2004-wq/nftoken-web"
          target="_blank"
          rel="noopener noreferrer"
        >
          github.com/sidaniridha2004-wq
        </a>
      </footer>
    </main>
  );
}

function GeneratePanel() {
  const [cookie, setCookie] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    login_url: string;
    expiry_text: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  async function generate(event?: FormEvent) {
    event?.preventDefault();
    const value = cookie.trim();
    if (!value) {
      setError("Please paste your Netflix cookie.");
      setResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    setCopied(false);
    setSaved(false);
    try {
      const res = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(null);
        setError(data.error || "Something went wrong.");
        return;
      }
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(
        "Network error: " + (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyUrl() {
    if (!result?.login_url) return;
    try {
      await navigator.clipboard.writeText(result.login_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  function saveToVault() {
    const value = cookie.trim();
    if (!value) return;
    const items = loadSaved();
    const entry = newSavedCookie(value);
    entry.status = "working";
    if (result) {
      entry.loginUrl = result.login_url;
      entry.expiryText = result.expiry_text;
      entry.lastChecked = Date.now();
    }
    persistSaved([entry, ...items]);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <section className="panel">
      <form onSubmit={generate}>
        <div className="field-head">
          <label htmlFor="cookie">cookie</label>
          <span className="hint">raw header \u00b7 cookies.txt \u00b7 json</span>
        </div>
        <textarea
          id="cookie"
          spellCheck={false}
          placeholder="NetflixId=...; SecureNetflixId=...; nfvdid=..."
          value={cookie}
          onChange={(e) => setCookie(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void generate();
          }}
        />
        <div className="actions">
          <button className="primary" type="submit" disabled={loading}>
            {loading ? "Generating\u2026" : "Generate login URL"}
          </button>
          <span className="status">only NetflixId is required</span>
        </div>
      </form>

      {error ? <div className="error">{error}</div> : null}

      {result ? (
        <div className="result">
          <div className="row">
            <div className="k">login url</div>
            <div className="url-row">
              <span className="url-box">{result.login_url}</span>
              <button className="chip" type="button" onClick={copyUrl}>
                {copied ? "copied!" : "copy"}
              </button>
              <a
                className="chip"
                href={result.login_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                open
              </a>
            </div>
          </div>
          <div className="row">
            <div className="k">expires</div>
            <div className="v-mono">{result.expiry_text || "Unknown"}</div>
          </div>
          <div className="row">
            <button className="chip solid" type="button" onClick={saveToVault}>
              {saved ? "saved \u2713" : "save to vault"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="note">
        <span className="tag">note</span>
        <span>
          Your cookie is a live credential. It is used only to call Netflix and
          is never logged or stored on the server. Saving keeps it in this
          browser only. Use it with your own account.
        </span>
      </div>
    </section>
  );
}

function VaultPanel() {
  const [items, setItems] = useState<SavedCookie[]>([]);
  const [bulk, setBulk] = useState("");
  const [importing, setImporting] = useState(false);
  const [checkingAll, setCheckingAll] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );

  useEffect(() => {
    setItems(loadSaved());
  }, []);

  const update = useCallback((next: SavedCookie[]) => {
    setItems(next);
    persistSaved(next);
  }, []);

  const counts = useMemo(() => {
    const c = { working: 0, invalid: 0, error: 0, unknown: 0 };
    for (const it of items) c[it.status]++;
    return c;
  }, [items]);

  const patch = useCallback((id: string, changes: Partial<SavedCookie>) => {
    setItems((prev) => {
      const next = prev.map((it) => (it.id === id ? { ...it, ...changes } : it));
      persistSaved(next);
      return next;
    });
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const busy = importing || checkingAll || archiveBusy;

  async function importBulk() {
    const entries = splitBulkCookies(bulk);
    if (entries.length === 0) return;
    setImporting(true);
    const created = entries.map((raw) => newSavedCookie(raw));
    update([...created, ...items]);
    setBulk("");

    setProgress({ done: 0, total: created.length });
    let done = 0;
    await pool(created, 4, async (entry) => {
      const res = await checkCookie(entry.raw);
      patch(entry.id, {
        status: res.status,
        message: res.message,
        loginUrl: res.login_url,
        expires: res.expires ?? null,
        expiryText: res.expiry_text,
        preview:
          res.netflix_id_preview && res.netflix_id_preview !== "\u2014"
            ? res.netflix_id_preview
            : entry.preview,
        lastChecked: Date.now(),
      });
      done++;
      setProgress({ done, total: created.length });
    });
    setProgress(null);
    setImporting(false);
  }

  async function importArchive(file: File) {
    setSummary(null);
    if (file.size > 4 * 1024 * 1024) {
      setSummary("That archive is larger than 4 MB. Please split it into smaller files.");
      return;
    }
    setArchiveBusy(true);
    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/extract", { method: "POST", body: fd });
      const data = await res.json();
      setExtracting(false);
      if (!res.ok) {
        setSummary(data.error || "Could not read the archive.");
        return;
      }
      const extracted = (data.cookies ?? []) as {
        source: string;
        cookie: string;
        label: string;
        country?: string;
      }[];
      if (extracted.length === 0) {
        setSummary("No Netflix cookies found in that archive.");
        return;
      }

      // Skip cookies already in the vault (matched by NetflixId).
      const existing = new Set(
        items.map((it) => extractCookieDict(it.raw)["NetflixId"]).filter(Boolean),
      );
      const fresh = extracted.filter((c) => {
        const id = extractCookieDict(c.cookie)["NetflixId"];
        return id && !existing.has(id);
      });
      const skipped = extracted.length - fresh.length;
      if (fresh.length === 0) {
        setSummary(`Extracted ${extracted.length} \u2014 all already in your vault.`);
        return;
      }

      const created = fresh.map((c) => {
        const entry = newSavedCookie(c.cookie, c.label, c.source);
        entry.country = c.country;
        return entry;
      });
      update([...created, ...items]);

      setProgress({ done: 0, total: created.length });
      let done = 0;
      const results = new Map<string, SavedStatus>();
      await pool(created, 6, async (entry) => {
        const r = await checkCookie(entry.raw);
        results.set(entry.id, r.status);
        patch(entry.id, {
          status: r.status,
          message: r.message,
          loginUrl: r.login_url,
          expires: r.expires ?? null,
          expiryText: r.expiry_text,
          preview:
            r.netflix_id_preview && r.netflix_id_preview !== "\u2014"
              ? r.netflix_id_preview
              : entry.preview,
          lastChecked: Date.now(),
        });
        done++;
        setProgress({ done, total: created.length });
      });

      const working = [...results.values()].filter((s) => s === "working").length;
      const dead = [...results.values()].filter((s) => s === "invalid").length;
      const errored = [...results.values()].filter((s) => s === "error").length;

      // Drop the dead ones we just added \u2014 keep working (and errors to retry).
      const deadIds = new Set(
        created.filter((c) => results.get(c.id) === "invalid").map((c) => c.id),
      );
      setItems((prev) => {
        const next = prev.filter((it) => !deadIds.has(it.id));
        persistSaved(next);
        return next;
      });

      setSummary(
        `Extracted ${extracted.length}` +
          (skipped ? ` (${skipped} already saved)` : "") +
          ` \u00b7 ${working} working saved \u00b7 ${dead} dead removed` +
          (errored ? ` \u00b7 ${errored} error (kept)` : ""),
      );
    } catch (err) {
      setSummary(
        "Upload failed: " + (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setExtracting(false);
      setProgress(null);
      setArchiveBusy(false);
    }
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void importArchive(file);
  }

  async function recheck(id: string) {
    const item = items.find((it) => it.id === id);
    if (!item) return;
    patch(id, { message: "checking\u2026" });
    const res = await checkCookie(item.raw);
    patch(id, {
      status: res.status,
      message: res.message,
      loginUrl: res.login_url,
      expires: res.expires ?? null,
      expiryText: res.expiry_text,
      lastChecked: Date.now(),
    });
  }

  async function recheckAll() {
    if (items.length === 0) return;
    setCheckingAll(true);
    setProgress({ done: 0, total: items.length });
    let done = 0;
    const snapshot = [...items];
    await pool(snapshot, 6, async (item) => {
      const res = await checkCookie(item.raw);
      patch(item.id, {
        status: res.status,
        message: res.message,
        loginUrl: res.login_url,
        expires: res.expires ?? null,
        expiryText: res.expiry_text,
        lastChecked: Date.now(),
      });
      done++;
      setProgress({ done, total: snapshot.length });
    });
    setProgress(null);
    setCheckingAll(false);
  }

  /** (Re)generate a fresh login URL for a working cookie and reveal it. */
  async function generate(id: string) {
    const item = items.find((it) => it.id === id);
    if (!item) return;
    patch(id, { message: "generating\u2026" });
    try {
      const res = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie: item.raw }),
      });
      const data = await res.json();
      if (!res.ok) {
        patch(id, { message: data.error || "Could not generate a URL." });
        return;
      }
      patch(id, {
        status: "working",
        loginUrl: data.login_url,
        expiryText: data.expiry_text,
        lastChecked: Date.now(),
        message: undefined,
      });
      setExpanded((prev) => new Set(prev).add(id));
      try {
        await navigator.clipboard.writeText(data.login_url);
      } catch {
        /* clipboard blocked */
      }
    } catch (err) {
      patch(id, {
        message: "Network error: " + (err instanceof Error ? err.message : String(err)),
      });
    }
  }

  function remove(id: string) {
    update(items.filter((it) => it.id !== id));
  }

  function removeDead() {
    update(items.filter((it) => it.status !== "invalid"));
  }

  function clearAll() {
    if (!window.confirm("Remove all saved cookies from this browser?")) return;
    update([]);
  }

  async function copy(text?: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="panel">
      <div className="field-head">
        <label>import from archive</label>
        <span className="hint">.zip or .rar of cookie files</span>
      </div>
      <div className="uploader">
        <label className={busy ? "chip solid file-btn disabled" : "chip solid file-btn"}>
          {archiveBusy
            ? extracting
              ? "Extracting\u2026"
              : "Checking\u2026"
            : "Choose .zip / .rar"}
          <input
            type="file"
            accept=".zip,.rar,application/zip,application/x-rar-compressed,application/vnd.rar"
            hidden
            disabled={busy}
            onChange={onFile}
          />
        </label>
        <span className="status">
          {archiveBusy && progress
            ? `checked ${progress.done}/${progress.total}`
            : "extract \u2192 validate \u2192 keep the working ones"}
        </span>
      </div>
      {summary ? <div className="summary">{summary}</div> : null}

      <hr className="rule" />

      <div className="field-head">
        <label htmlFor="bulk">or paste cookies</label>
        <span className="hint">one per line \u00b7 or a json array</span>
      </div>
      <textarea
        id="bulk"
        spellCheck={false}
        placeholder={"NetflixId=...\\nNetflixId=...\\nNetflixId=..."}
        value={bulk}
        onChange={(e) => setBulk(e.target.value)}
      />
      <div className="actions">
        <button
          className="primary"
          type="button"
          onClick={importBulk}
          disabled={busy || !bulk.trim()}
        >
          {importing ? "Importing\u2026" : "Import & check"}
        </button>
        {importing && progress ? (
          <span className="status">
            checked {progress.done}/{progress.total}
          </span>
        ) : (
          <span className="status">saved to this browser only</span>
        )}
      </div>

      <hr className="rule" />

      <div className="vault-head">
        <div className="tallies">
          <span className="pill working">{counts.working} working</span>
          <span className="pill invalid">{counts.invalid} dead</span>
          {counts.error ? (
            <span className="pill error">{counts.error} error</span>
          ) : null}
          {counts.unknown ? (
            <span className="pill unknown">{counts.unknown} unchecked</span>
          ) : null}
        </div>
        <div className="vault-tools">
          <button
            className="chip"
            type="button"
            onClick={recheckAll}
            disabled={busy || items.length === 0}
          >
            {checkingAll ? "checking\u2026" : "re-check all"}
          </button>
          <button
            className="chip"
            type="button"
            onClick={removeDead}
            disabled={busy || counts.invalid === 0}
          >
            clear dead
          </button>
          <button
            className="chip danger"
            type="button"
            onClick={clearAll}
            disabled={busy || items.length === 0}
          >
            clear all
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty">
          No saved cookies yet. Upload a <strong>.zip/.rar</strong> or paste some
          above \u2014 the working ones are kept with a <strong>Generate</strong>
          button.
        </div>
      ) : (
        <ul className="cookie-list">
          {items.map((it) => (
            <li key={it.id} className="cookie-item">
              <div className="ci-main">
                <span className={`dot ${it.status}`} aria-hidden />
                <div className="ci-text">
                  <div className="ci-top">
                    <span className="ci-id">
                      {it.label || `NetflixId ${it.preview}`}
                    </span>
                    {it.country ? (
                      <span className="ci-country">{it.country}</span>
                    ) : null}
                    <span className={`pill ${it.status}`}>
                      {statusLabel(it.status)}
                    </span>
                  </div>
                  <div className="ci-sub">
                    {it.label ? (
                      <span className="ci-dim">NetflixId {it.preview} \u00b7 </span>
                    ) : null}
                    {it.status === "working" && it.expiryText
                      ? `expires ${it.expiryText}`
                      : it.message || "\u2014"}
                    <span className="ci-dim">
                      {" \u00b7 checked "}
                      {relativeTime(it.lastChecked)}
                    </span>
                  </div>
                  {expanded.has(it.id) && it.loginUrl ? (
                    <div className="ci-url">
                      <span className="url-box">{it.loginUrl}</span>
                      <button
                        className="chip"
                        type="button"
                        onClick={() => copy(it.loginUrl)}
                      >
                        copy
                      </button>
                      <a
                        className="chip"
                        href={it.loginUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        open
                      </a>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="ci-actions">
                {it.status === "working" ? (
                  <button
                    className="chip solid"
                    type="button"
                    onClick={() => generate(it.id)}
                    disabled={busy}
                  >
                    generate
                  </button>
                ) : null}
                {it.status === "working" && it.loginUrl ? (
                  <button
                    className="chip"
                    type="button"
                    onClick={() => toggleExpanded(it.id)}
                  >
                    {expanded.has(it.id) ? "hide" : "url"}
                  </button>
                ) : null}
                <button
                  className="chip"
                  type="button"
                  onClick={() => recheck(it.id)}
                  disabled={busy}
                >
                  re-check
                </button>
                <button
                  className="chip danger"
                  type="button"
                  onClick={() => remove(it.id)}
                >
                  delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="note">
        <span className="tag">privacy</span>
        <span>
          Archives are extracted and checked on the server but never stored or
          logged. Saved cookies live in this browser\u2019s local storage \u2014 not on the
          server. Anyone with access to this device can read them. Use \u201cclear
          all\u201d on a shared computer.
        </span>
      </div>
    </section>
  );
}
