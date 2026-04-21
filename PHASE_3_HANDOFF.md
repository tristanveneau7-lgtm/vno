# VNO — Phase 3 Handoff

**Goal of this document:** take you from "code is on main" to "I tapped Build on my phone and watched the payload land in my home-PC console, and the placeholder salon site rendered chrome-free on my phone." All 11 acceptance checks from the spec are covered.

Work in `D:\vno\`. Two terminals on your home PC, plus your phone.

---

## One-time setup (skip if already done)

### Prereqs

- Node 18+ (`node -v`)
- `cloudflared --version` works in PowerShell
- Netlify account (drag-and-drop works, no CLI needed)

### Put a placeholder site on Netlify

The engine's `/build` endpoint returns a hardcoded URL, which the phone's Preview screen loads in an iframe. For the demo to actually show *something*, that URL needs to be live.

Two options:

1. **Easy:** Leave `STUB_SITE_URL` at the default (`https://maison-rose-7a3f.netlify.app`) — if that site is up and embeddable, you're done. If it 404s, use option 2.
2. **Your own placeholder:** Take any static HTML file you like (a hand-built mock, a cloned salon site, whatever), drop it on Netlify, copy the live URL. Paste that URL as `STUB_SITE_URL` in `D:\vno\engine\.env` (next section).

**iframe gotcha:** if the placeholder site sets `X-Frame-Options: DENY` or a restrictive CSP, the phone will show a blank iframe. Netlify's default serves neither header, so a plain drag-and-drop Netlify deploy will always frame. Custom domains on managed providers sometimes do not.

### Engine `.env`

```powershell
cd D:\vno\engine
copy .env.example .env
notepad .env
```

Fill in (only the first two matter in Phase 3):

```
PORT=3000
STUB_SITE_URL=https://your-placeholder-on-netlify.netlify.app
ANTHROPIC_API_KEY=
FAL_KEY=
```

Leave `ANTHROPIC_API_KEY` and `FAL_KEY` empty — Phase 4 uses them.

---

## Per-session run (do this every time)

### Terminal 1 — start the engine

```powershell
cd D:\vno\engine
npm install      # first time only
npm start
```

You should see:

```
[vno-engine] listening on http://localhost:3000
[vno-engine] expose via: cloudflared tunnel --url http://localhost:3000
```

Leave this window open. Every `/build` request will log here.

### Terminal 2 — start the tunnel

```powershell
cloudflared tunnel --url http://localhost:3000
```

Look for a line like:

```
Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):
https://random-words-here.trycloudflare.com
```

**Copy that URL.** It's your tunnel for this session. It changes every restart — that's the known Phase 3 trade-off.

Quick sanity check from your PC (in a third PowerShell or a browser):

```powershell
curl https://random-words-here.trycloudflare.com/health
```

Should return `{"ok":true,"service":"vno-engine","phase":3}`.

### App `.env`

```powershell
cd D:\vno\app
copy .env.example .env     # first time only
notepad .env
```

Set:

```
VITE_ENGINE_URL=https://random-words-here.trycloudflare.com
```

(No trailing slash. `api.ts` appends `/build` itself.)

### Rebuild and redeploy

```powershell
cd D:\vno\app
npm run build
```

Should finish with a `dist/` folder containing `index.html`, `assets/`, `manifest.webmanifest`, `sw.js`, PWA icons.

Drag `D:\vno\app\dist\` onto the Netlify dashboard (the "deploys" drop target). Wait for the green checkmark, note the Netlify URL. If you've deployed before, drag into the same site's drop zone to keep the URL stable.

---

## Phone test — the 11 acceptance checks

Install the PWA to your home screen (Safari: Share → Add to Home Screen; Chrome: ⋮ → Install app) so you get the fullscreen experience, or just open the Netlify URL in mobile Safari/Chrome.

| # | Check | What to look for |
|---|---|---|
| 1 | Engine listening | Terminal 1 shows `[vno-engine] listening on http://localhost:3000` |
| 2 | Tunnel open | Terminal 2 shows a `https://*.trycloudflare.com` URL |
| 3 | `.env` updated | `D:\vno\app\.env` contains the tunnel URL as `VITE_ENGINE_URL` |
| 4 | Build succeeded | `npm run build` ends with `✓ built in ...` and writes `dist/` |
| 5 | Deployed | Netlify shows the new deploy with a live URL |
| 6 | Phone quiz works | All 7 screens navigate; vertical selection, business inputs, section toggles, vibe tiles, logo/photo upload, special text all responsive |
| 7 | Build request sent | Tap **Build the site →**. Label becomes **Building…** for ~2s |
| 8 | Engine logged it | Terminal 1 shows a block like `[abc12345] POST /build` followed by vertical, business name, vibe, sections object, logo flag, anything-special, payload size |
| 9 | Review screen | Phone lands on `/review`, shows your typed business name (or "Your business" if blank), "Built in 2.0s. Looks good?", and the preview card with the returned domain at the bottom |
| 10 | Preview loads | **Hand to client →** → check the DND box → **Enter Preview Mode** → the returned URL renders chrome-free in an iframe filling the whole screen |
| 11 | Triple-tap exits | Tap the top-right corner 3 times within 1 second → back to `/quiz/1` with form state preserved (except assets, which don't persist by design) |

All 11 pass → Phase 3 is done.

---

## Troubleshooting

**"VITE_ENGINE_URL is not set" error on phone.** You rebuilt before editing `.env`, or `.env` has the wrong variable name. Fix `.env`, rerun `npm run build`, redeploy.

**Phone shows "Build failed: Failed to fetch" (red line under the preview panel).** Either the tunnel is down (restart `cloudflared`), or CORS is blocking. Engine CORS is wide open (`origin: true`), so it's almost always the tunnel. Confirm the tunnel URL still resolves in a browser.

**Engine logs the request but the phone sits on "Building…" forever.** The response is coming back but not parsed. Check browser devtools → Network → the `/build` response should be JSON. If it's HTML (Cloudflare error page), the tunnel dropped mid-request.

**Preview screen is blank / white.** The iframe is loading but the placeholder site isn't framing. Either the URL 404s or it sets `X-Frame-Options`. Browse to the URL directly in mobile Safari — if it loads there but not in the iframe, the site is blocking frames. Swap `STUB_SITE_URL` to a Netlify-hosted static page.

**Tunnel URL changes every restart — annoying.** Known Phase 3 trade-off. Phase 5 upgrades to a named tunnel with a stable URL so you only edit `.env` once.

**Refreshed the phone mid-preview, got redirected to `/quiz/1`.** Expected. `/review`, `/dnd`, and `/preview` all require navigation state that doesn't survive a refresh — Review.tsx, DndCheck.tsx, and Preview.tsx all redirect home when state is missing. The quiz text answers come back from localStorage (zustand persist middleware); the logo and photos don't, by design.

**"Is the phone on the same Wi-Fi as the PC?"** Doesn't matter. The tunnel reaches your PC from anywhere — phone can be on cellular.

---

## What's carried forward into Phase 4

- Real cloner (abi/screenshot-to-code) processes a reference URL at build time
- Anthropic API injects business info into the cloned HTML
- fal.ai generates the hero image
- Engine deploys each build to a new Netlify site — every request returns a unique URL
- `references/library.json` gets its first real entry

The wire you just verified carries fake signal. Phase 4 makes it carry real work.
