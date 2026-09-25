# nftoken web

A Vercel-ready website that generates a Netflix login URL (`https://netflix.com/?nftoken=...`) from an authenticated `NetflixId` cookie.

Ported from [abayxxx/nftoken-generator](https://github.com/abayxxx/nftoken-generator) (Python CLI + Flask) to **Next.js** so you can deploy it on Vercel in a few clicks.

## How it works

1. You paste a Netflix cookie (raw header, `cookies.txt`, or JSON).
2. The site extracts `NetflixId`.
3. A server-side API route requests `account → token → default` from the iOS FTL user API.
4. You get a copyable / openable login URL and the token expiry time.

The browser cannot call Netflix directly (CORS blocks it, and browsers forbid setting `Cookie` / `x-netflix.*` headers from JavaScript). The request therefore runs in `/api/token`.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import **nftoken-web**.
2. Leave the defaults (Framework Preset: Next.js, Build Command: `next build`, Output: default).
3. Click **Deploy**.

No environment variables are required.

## API

`POST /api/token` with `{ "cookie": "<your cookie in any supported format>" }` returns:

```json
{
  "login_url": "https://netflix.com/?nftoken=...",
  "expires": 1785600000,
  "expiry_text": "2026-08-01 23:00:00"
}
```

Errors return `{ "error": "..." }` with `400` (bad input) or `502` (upstream failure).

Request bodies are capped at 64 KB. The cookie is processed in memory and never stored.

## Accepted input formats

- **Raw cookie header:** `NetflixId=...; SecureNetflixId=...; nfvdid=...`
- **Netscape `cookies.txt`** export (tab-separated lines)
- **JSON export**, as either:
  - a list of `{ "name": "...", "value": "..." }` objects,
  - an object with a `"cookies"` list, or
  - a flat object like `{ "NetflixId": "..." }`

Only `NetflixId` is strictly required.

## Compatibility

The generated link is a **web** login (`?nftoken=...`). It logs you into Netflix in a browser. It does **not** sign you into the native Netflix app.

| Target | Works? | Notes |
| --- | --- | --- |
| Desktop browser | Yes | Sets a session cookie with a long declared lifespan. |
| Mobile browser (Safari/Chrome) | Yes | Open the link **in the browser** — tapping it on a phone may deep-link into the Netflix app, which ignores the token. |
| Netflix native app (iOS/Android) | No | The app uses its own auth and ignores web login links. |

## Notes & disclaimer

- Your `NetflixId` cookie is a live credential. Anyone using a hosted instance is sending it to that server for one request. Keep the deployment private if you do not want to operate a public credential relay.
- For educational purposes and for use with your own account. Respect Netflix's Terms of Service.
