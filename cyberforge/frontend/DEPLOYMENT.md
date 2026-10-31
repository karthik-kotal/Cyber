# Deployment - Community Scam Map frontend (Developer B)

This is the mobile-first React frontend for the Community Scam Map for India.
It is a static Vite build that talks to Developer A's backend over HTTPS.

## How it works

- Build output: `dist/` (static HTML/JS/CSS).
- The frontend never computes verdicts, masking, or trust scores; it renders
  exactly what the backend returns.
- All backend calls go through `services/api.ts`, whose base URL is controlled
  by `VITE_API_BASE_URL`.
- No secrets live in frontend environment variables. `VITE_API_BASE_URL` is a
  public connection setting only.

## Environment configuration

Copy `.env.example` to `.env` and set the backend URL:

```
cp .env.example .env
```

`.env.example`:

```
# Backend base URL for Developer A's backend (HTTPS in production).
# Leave empty to use same-origin (dev proxy routes /api to the backend).
VITE_API_BASE_URL=
```

- Development: leave `VITE_API_BASE_URL` empty; the Vite proxy routes `/api`
  to `http://localhost:8000` (Developer A's local backend).
- Production: set `VITE_API_BASE_URL=https://api.<your-domain>` (the actual
  backend URL provided by Developer A). Do NOT guess the path; it is confirmed
  with Developer A and lives only in `services/api.ts` (`ENDPOINTS`).

## Build

```
npm install
npm run build        # typecheck + vite build -> dist/
npm run preview      # serve dist/ locally (HTTP, for smoke checks only)
```

## Hosting / HTTPS

No hosting provider is identified in the repository, so this document is
platform-agnostic. Deploy the contents of `dist/` to any static host that
serves over HTTPS (e.g. Vercel, Netlify, Cloudflare Pages, GitHub Pages,
S3+CloudFront, or your organisation's ingress).

Requirements for the deployment:

1. **HTTPS**: the site must be served over HTTPS. The backend URL
   (`VITE_API_BASE_URL`) must also be HTTPS in production.
2. **Frontend loads**: `https://<host>/` returns `index.html`.
3. **Backend responds**: the configured `VITE_API_BASE_URL` must be reachable
   from the browser (CORS must allow the frontend origin).
4. **Environment variables**: set `VITE_API_BASE_URL` in the host's env/UI.
   Never commit `.env` or secrets.
5. **CORS**: the backend must allow the frontend origin (and any cookies are
   omitted - the app is anonymous by design, `credentials: 'omit'`).
6. **License behavior**: the backend owns the license module; the frontend only
   displays backend license responses and offers the documented renewal flow
   (no restart required).
7. **Persistent storage**: only the language preference is persisted
   (`localStorage` key `csm.lang`). No reporter identity, GPS, or secrets are
   stored.

## Verifying the stub (local, self-signed HTTPS)

This proves the built frontend loads over HTTPS locally. It is NOT a public
deployment and uses a self-signed certificate (browser will warn).

```
# Generate a self-signed cert for localhost
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem \
  -days 1 -nodes -subj "/CN=localhost"

# Serve dist/ over HTTPS
node -e "
const https=require('https'),fs=require('fs'),path=require('path');
const s=https.createServer({key:fs.readFileSync('key.pem'),cert:fs.readFileSync('cert.pem')},(req,res)=>{
  const p=path.join('dist',req.url==='/'?'index.html':req.url.slice(1));
  fs.readFile(p,(err,data)=>{
    if(err){res.writeHead(404);res.end('not found');return;}
    res.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html':p.endsWith('.js')?'application/javascript':'text/css'});
    res.end(data);
  });
});
s.listen(3443,()=>console.log('https://localhost:3443'));
"
# In another terminal:
curl -k https://localhost:3443 | head -c 200
```

Expected: `index.html` is returned over HTTPS.

## What remains (Developer A / backend)

- Provide the confirmed backend base URL and endpoint paths.
- Update `ENDPOINTS` in `services/api.ts` once routes are confirmed.
- Ensure CORS allows the production frontend origin.
- Run the backend so report/lookup/map/alerts/challenge/license calls succeed.
- The Phase B5 integration tests (report success, invalid report, the four
  verdicts, masking, challenge indicator, map, alerts, challenge submission,
  license expiry/renewal, backend-unavailable, mobile layout) require a running
  backend against the configured `VITE_API_BASE_URL`.

## Security & privacy

- No reporter identity is exposed; no raw reporter ID appears in the UI.
- No GPS is collected; no free-text address is collected.
- No private data is placed in query strings.
- No secrets in frontend env vars.
- No frontend trust engine; no frontend masking logic (backend is source of
  truth for verdicts, `display_value`, counts, and masking).
