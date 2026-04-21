# vno-engine

Local backend for the VNO PWA. Phase 3: receives the quiz payload, logs it, returns a stub URL. No real build work yet — that's Phase 4.

Runs on the home PC only. Never deployed.

## Setup

```powershell
cd D:\vno\engine
npm install
copy .env.example .env   # then edit .env if you want to change PORT or the stub URL
```

## Run

```powershell
npm start      # one-shot: tsx src/server.ts
npm run dev    # auto-reload on file change
```

You should see:

```
[vno-engine] listening on http://localhost:3000
[vno-engine] expose via: cloudflared tunnel --url http://localhost:3000
```

## Expose to the phone

In a second PowerShell:

```powershell
cloudflared tunnel --url http://localhost:3000
```

Copy the printed `https://<random>.trycloudflare.com` URL into `D:\vno\app\.env` as `VITE_ENGINE_URL=...`, then rebuild and redeploy the app.

**The tunnel URL changes every restart.** That's fine for Phase 3 — Phase 5 switches to a named tunnel with a stable URL.

## Test locally

```powershell
# health
curl http://localhost:3000/health

# build stub (empty body, just to see it log + respond)
curl -X POST http://localhost:3000/build -H "Content-Type: application/json" -d "{}"
```

## Endpoints

- `GET /health` — `{ ok: true, service: 'vno-engine', phase: 3 }`
- `POST /build` — body is the quiz payload; response: `{ requestId, url, buildTime, phase }`. Simulated 2s delay.

## Notes

- Body limit is 10mb so base64 logo + photo data URLs fit.
- CORS: `origin: true` reflects the request origin. No auth in Phase 3 — the server does no real work and holds no secrets. Auth lands when the cloner actually costs money to run.
- Every request gets a short `requestId` so logs stay traceable during a live pitch.
