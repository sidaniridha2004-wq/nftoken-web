# nftoken-web

A small web app that turns a Netflix session cookie into a one-tap login URL,
checks whether cookies are still alive, and keeps a saved vault — all in your
browser. Built with **Next.js 15 (App Router) + React 19 + TypeScript** and
deployable to **Vercel with zero environment variables**.

This is a web port of the Python/Flask project
[`abayxxx/nftoken-generator`](https://github.com/abayxxx/nftoken-generator).

## Features

- **Generate** — paste a Netflix cookie and get a `https://netflix.com/?nftoken=…`
  login URL plus its expiry. Copy or open it directly.
- **Cookie checker** — every cookie is classified as **working**, **dead**
  (no valid token), or **error** (upstream/network issue).
- **Bulk import** — paste many cookies at once (one per line, blank-line /
  dashed-separated blocks, or a JSON array of strings or export objects). They
  are checked in parallel with a small concurrency pool so each request stays
  well under Vercel Hobby's 10s function limit.
- **Vault** — save cookies to a per-device vault, re-check one or all, clear the
  dead ones, or clear everything. Working entries keep a copy/open shortcut.

## Privacy

Cookies are **live credentials**. They are used only to call Netflix's API and
are **never logged or stored on the server**. The saved vault lives in your
browser's `localStorage` only — it never leaves your device. Anyone with access
to the browser can read it, so use **“clear all”** on a shared computer.

## How it works

The browser can't call Netflix's iOS FTL user API directly (CORS + forbidden
headers), so the exchange happens in a server route:

- `POST /api/token` — `{ cookie }` → `{ login_url, expires, expiry_text }`.
- `POST /api/check` — `{ cookie }` → `{ status, message?, login_url?, expires?,
  expiry_text?, netflix_id_preview }`. Returns HTTP 200 for any classified
  result (working/dead/error in the body).

Only the `NetflixId` cookie value is required; `SecureNetflixId`, `nfvdid`, and
`OptanonConsent` are recognized if present.

## Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Deploy to Vercel

1. Push this repo to GitHub (already at
   `github.com/sidaniridha2004-wq/nftoken-web`).
2. Import it at [vercel.com/new](https://vercel.com/new).
3. No environment variables are needed. Deploy.

> Vercel Hobby caps serverless functions at 10s. Bulk checking is orchestrated
> client-side as many short single-cookie requests, so it stays within the
> limit.

## Disclaimer

For use with **your own** Netflix account. You are responsible for how you use
your own credentials.
