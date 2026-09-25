"use client";

import { FormEvent, useState } from "react";

type TokenResponse = {
  login_url: string;
  expires: number | null;
  expiry_text: string;
};

type ErrorResponse = {
  error?: string;
};

export default function Page() {
  const [cookie, setCookie] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TokenResponse | null>(null);
  const [copied, setCopied] = useState(false);

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

    try {
      const res = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie: value }),
      });
      const data = (await res.json()) as TokenResponse & ErrorResponse;
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
      /* clipboard blocked; user can select manually */
    }
  }

  return (
    <main>
      <p className="eyebrow">netflix · session utility</p>
      <h1>
        <span className="caret">›</span> nftoken
      </h1>
      <p className="lede">
        Exchange a Netflix session cookie for a one-tap login URL. The browser
        talks to this site’s API; the API calls Netflix. Your cookie is never
        stored.
      </p>

      <hr className="rule" />

      <form onSubmit={generate}>
        <div className="field-head">
          <label htmlFor="cookie">cookie</label>
          <span className="hint">raw header · cookies.txt · json</span>
        </div>
        <textarea
          id="cookie"
          spellCheck={false}
          placeholder="NetflixId=...; SecureNetflixId=...; nfvdid=..."
          value={cookie}
          onChange={(e) => setCookie(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              void generate();
            }
          }}
        />

        <div className="actions">
          <button className="primary" type="submit" disabled={loading}>
            {loading ? "Generating…" : "Generate login URL"}
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
              <button className="copy-btn" type="button" onClick={copyUrl}>
                {copied ? "Copied!" : "copy"}
              </button>
              <a
                className="open-btn"
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
        </div>
      ) : null}

      <div className="note">
        <span className="tag">note</span>
        <span>
          Your cookie is a live credential. It is used only to call Netflix,
          held in memory for the length of one request, and never logged or
          stored. Use it with your own account only.
        </span>
      </div>

      <hr className="rule tight" />

      <footer>
        <span>v1.0.0</span>
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
