# VNO — Phase 4 Handoff

**Goal of this document:** take you from "code is on main" to "I tapped Build on my phone, watched the engine screenshot Serenity Hair, send it to Claude, deploy to Netlify, and saw a generated Pharmacy Keith's site render chrome-free on my phone." All 17 acceptance checks from the spec are covered.

Work in `D:\vno\`. Two terminals on your home PC, plus your phone.

The wire that Phase 3 verified with fake signal now carries real work: real screenshot, real Claude clone, real Netlify deploy, real $0.10 spent per build.

---

## One-time setup (skip if already done)

### Engine `.env`

`D:\vno\engine\.env` should now have all four values populated:

```
PORT=3000
STUB_SITE_URL=  # ignored in Phase 4 — engine no longer uses this
ANTHROPIC_API_KEY=sk-ant-...
NETLIFY_AUTH_TOKEN=...
```

`ANTHROPIC_API_KEY` is what Claude uses for the vision call. `NETLIFY_AUTH_TOKEN` is your Netlify personal access token — generate one at https://app.netlify.com/user/applications#personal-access-tokens if you haven't already. `STUB_SITE_URL` can stay or go; the Phase 4 build route doesn't read it.

### Engine deps (Puppeteer's Chromium)

If you haven't run `npm install` in `engine/` since Phase 3, do it now:

```powershell
cd D:\vno\engine
npm install
```

The Puppeteer postinstall step downloads Chromium (~170MB). You'll see `Downloading Chrome` progress. This only happens once.

### Reference thumbnail

`D:\vno\app\public\references\serenity-hair-salon.png` should already be in place from your earlier setup. Confirm it exists — Screen 4 won't render a tile thumbnail without it.

---

## Per-session run (do this every time)

### Terminal 1 — start the engine

```powershell
cd D:\vno\engine
npm start
```

You should see:

```
[vno-engine] listening on http://localhost:3000
[vno-engine] expose via: cloudflared tunnel --url http://localhost:3000
```

Leave it open. Every `/build` request logs a coloured block here showing screenshot bytes, clone duration, and the Netlify URL it deployed to.

### Terminal 2 — start the tunnel

```powershell
cloudflared tunnel --url http://localhost:3000
```

Look for:

```
Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):
https://random-words-here.trycloudflare.com
```

Copy that URL. It changes every restart — same Phase 3 trade-off.

Sanity check:

```powershell
curl https://random-words-here.trycloudflare.com/health
```

Should return `{"ok":true,"service":"vno-engine","phase":3}` (the /health string is still labelled phase 3 — harmless, the build endpoint is the one that bumped to phase 4).

### App `.env`

```powershell
notepad D:\vno\app\.env
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

Should finish with `vite v5.4.21 building for production... built in ~1.5s` and write `dist/`.

Drag `D:\vno\app\dist\` onto your Netlify dashboard's deploys drop target (the same `vnodash` site as Phase 3 to keep the URL stable). Wait for the green checkmark.

---

## Phone test — the 17 acceptance checks

Reload the PWA on your phone (or open the Netlify URL in mobile Safari/Chrome).

| # | Check | What to look for |
|---|---|---|
| 1 | Engine starts | Terminal 1 shows `[vno-engine] listening on http://localhost:3000` with no errors about missing env vars |
| 2 | Tunnel up | Terminal 2 shows a `https://*.trycloudflare.com` URL |
| 3 | App `.env` updated | `D:\vno\app\.env` contains the tunnel URL as `VITE_ENGINE_URL` |
| 4 | Thumbnail in place | `D:\vno\app\public\references\serenity-hair-salon.png` exists before build |
| 5 | App rebuilt and deployed | `npm run build` clean, Netlify shows new deploy |
| 6 | Screen 1 — Salon | Tap Salon, Continue lights up |
| 7 | Screen 2 — business info | Type a real-ish name like "Pharmacy Keith's", real address, phone, hours. Continue lights up |
| 8 | Screen 3 — sections | Default toggles fine. Continue |
| 9 | Screen 4 — one tile | **Exactly one tile visible**: Serenity Hair, with the thumbnail image and `serenityhairblaxland.com.au` underneath. Tap it → white selection ring → Continue lights up |
| 10 | Screen 5 — logo upload | Upload any image. Continue lights up |
| 11 | Screen 6 — special | Type "Eco-friendly products" or similar, or skip |
| 12 | Screen 7 — Build tap | Tap **Build the site →**. Button label becomes **Building…**, progress preview shows "Cloning the reference…" lit, others dim. Bar fills to ~20% |
| 13 | Progress rotates | Every ~30s the next phase brightens — Injecting / Generating / Deploying / Almost done. Bar fills accordingly |
| 14 | Engine logs the pipeline | Terminal 1 shows `[xxxxxxxx] POST /build`, then `→ screenshotting`, `✓ screenshot N bytes`, `→ cloning…`, `✓ html N chars`, `→ deploying as vno-pharmacy-keiths-*`, `✓ deployed to https://vno-pharmacy-keiths-XXXXXX.netlify.app` |
| 15 | Phone lands on /review | After 60–180s, phone navigates to `/review` showing **your typed business name** (Pharmacy Keith's), `Built in 90.0s. Looks good?`, and the new Netlify domain at the bottom of the preview card |
| 16 | Preview loads real site | **Hand to client →** → DND check → **Enter Preview Mode** → the iframe loads the generated site. Business name on the page matches what you typed (Pharmacy Keith's, **not** Serenity Hair). Address, phone, hours all yours |
| 17 | Triple-tap exits | Tap top-right corner 3 times within 1 second → back to `/quiz/1`. Quiz text answers preserved (vertical, business, sections, reference). Logo and photos cleared (by design) |

All 17 pass → Phase 4 is done.

**Cost per successful run: ~$0.10** (Anthropic vision call dominates; Netlify deploy is free; Cloudflare Tunnel is free).

---

## Troubleshooting

**Engine logs `Error: NETLIFY_AUTH_TOKEN not set`.** You started the engine before populating `.env`, or `.env` is in the wrong folder. Token must be in `D:\vno\engine\.env`. Restart engine after editing.

**Engine logs `Error: ANTHROPIC_API_KEY not configured` from Anthropic SDK.** Same fix — populate `.env`, restart engine.

**Phone shows `Build failed: Missing reference.url` (red line under preview panel).** You skipped Screen 4 instead of tapping the Serenity tile. The engine validates `reference.url` on every build. Go back, tap the tile, retry.

**Phone shows `Build failed: 500 ...` with no detail.** Engine threw before it could write the JSON error body — check Terminal 1's `✗ failed after Ns:` line for the real message.

**Build hangs at "Cloning the reference…" past 60s.** Either Puppeteer is stuck (Chromium not downloaded — re-run `npm install` in `engine/`) or `serenityhairblaxland.com.au` is unreachable from your PC. Try opening the URL in your browser. If the site is down, the screenshot step times out at 30s and the build fails.

**Build hangs at "Generating HTML…" forever.** Anthropic API is slow today. The clone step has a 60s soft expectation but no hard timeout — it'll wait as long as Claude takes. If you see this for >3 minutes, check status.anthropic.com.

**Clone retries once and then fails.** Check Terminal 1 for the underlying error. Most common: `Claude returned invalid HTML` means Claude wrapped the output in something the fence-stripping didn't catch, or returned an apology instead of HTML. Build a second time — it usually self-corrects.

**Generated site shows broken hero image (gray box with broken-image icon).** Expected. The cloned site hotlinks images from `serenityhairblaxland.com.au`. If their CDN blocks hotlinking from `*.netlify.app`, the image won't render. Phase 5 fixes this with fal.ai-generated images.

**Generated site loads but it looks like Serenity Hair, not your business.** Means the Claude response either ignored your business info or used the reference's content. Rebuild — first attempt is usually clean. If it persists, the prompt may need tightening; flag for Phase 5.

**Netlify deploy fails with 401.** Token expired or revoked. Generate a new one in Netlify settings, paste into `engine/.env`, restart engine.

**Netlify deploy fails with `Site name already taken`.** Astronomically unlikely — `nanoid(6)` collisions are 1-in-billions. If it happens, retry the build; it'll generate a fresh suffix.

**Phone preview shows white screen / iframe blank.** The deployed Netlify site is up but failed to render. Open the returned URL in mobile Safari directly — if it loads, the iframe sandbox is the problem (rare); if it 404s, Netlify's CDN hasn't propagated yet. Wait 15s and retry.

**Phone refreshed mid-preview, redirects to /quiz/1.** Expected. `/review`, `/dnd`, and `/preview` all require nav state that doesn't survive a refresh. Quiz answers are preserved in localStorage (zustand persist).

**Engine crashes with `MaxListenersExceededWarning` on repeated builds.** Puppeteer leak — restart the engine between long testing sessions. Phase 5 can switch to a long-lived browser instance with page pooling.

---

## Costs and quota notes

- **Per build:** ~$0.10 (almost entirely the Anthropic vision call).
- **Set a daily cap** at Anthropic's dashboard: https://console.anthropic.com/settings/limits → set $10/day so a runaway script can't drain you.
- **Netlify free tier:** 100 sites and unlimited free bandwidth on the starter tier — fine for hundreds of pitch tests.
- **Sites accumulate.** Every build creates a fresh `vno-{slug}-{nanoid6}.netlify.app`. Cleanup is manual for now (Netlify dashboard → trash old sites). Phase 5 can add a cron.

---

## What's carried forward into Phase 5

- Library expansion — 3-5 entries per vertical, manually curated
- Vibe filtering within a vertical (uses the dead `vibe` field that's still in the store)
- fal.ai hero image generation — replaces hotlinked reference images so cloned sites stop relying on the source CDN
- Real-time build progress (SSE from engine to phone) — replaces the rotating placeholder copy
- Logo injection — Phase 4 ignores the uploaded logo; Phase 5 embeds it in the generated HTML
- Named Cloudflare Tunnel — stable URL across sessions, edit `.env` once
- Netlify site cleanup cron — drop sites older than 30 days

The wire you just verified carries a real generated site to your phone in under 2 minutes for $0.10. Phase 5 polishes the cloth around the wire.
