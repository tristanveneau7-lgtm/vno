# VNO — Phase 5 Handoff

**Goal of this document:** take you (future-Tristan, next week, having forgotten most of this) from "code is on main" to "I tapped Build on my phone, watched a real photo of a real local business get cloned into a styled landing page, the prospect's logo big in the header, and a stable tunnel URL that Just Works without editing `.env` every morning."

What Phase 5 shipped over Phase 4: the prospect's uploaded logo and two photos now land in the deployed site at fixed paths (`/logo.png`, `/hero.jpg`, `/photo2.jpg`) instead of hotlinking the reference's images; three decorative overlays (grain, badge, sketch) are generated per-build by fal.ai's flux/schnell and composited into the deploy; per-vertical terminology gets injected into the cloner prompt so a barber says "Book a Chair" where a salon says "Book an Appointment"; the engine deploys seven files per site instead of one; and the whole thing runs through a named Cloudflare Tunnel at `https://engine.vnoweb.ca` that has a deterministic URL forever. No more daily `.env` swap.

Work in `D:\vno\`. Two permanent PowerShell windows on your home PC, plus your phone.

---

## One-time setup (skip if already done)

### Engine `.env`

`D:\vno\engine\.env` needs four values. Three carried forward from Phase 4, one new:

```
PORT=3000
ANTHROPIC_API_KEY=sk-ant-...
NETLIFY_AUTH_TOKEN=...
FAL_KEY=...
```

`FAL_KEY` is your fal.ai API key — generate at https://fal.ai/dashboard/keys. The engine reads it once at module-load time inside `src/lib/fal.ts`; see the "dotenv load order" note below if you ever refactor imports.

### Engine deps

If you're on a fresh machine (or haven't pulled since Phase 5), reinstall:

```powershell
cd D:\vno\engine
npm install
```

Phase 5 adds `sharp@^0.34.5` (native bindings for image processing — Windows x64 precompiled binary downloads automatically) and `@fal-ai/client@^1.9.5` (pure JS). Puppeteer's Chromium from Phase 4 is still there.

If sharp complains on startup with `Could not load the "sharp" module using the win32-x64 runtime`, the native binary didn't land — re-run `npm rebuild sharp` to fetch it.

### Named Cloudflare Tunnel (one-time, permanent)

This replaces the Phase 4 quick-tunnel (`cloudflared tunnel --url http://localhost:3000`) that gave you a new random `*.trycloudflare.com` every session. A named tunnel uses a fixed UUID and a CNAME on your own domain, so the URL never changes.

Prerequisites: you need `cloudflared` installed (grab the Windows installer from https://github.com/cloudflare/cloudflared/releases) and you need a domain in your Cloudflare account. `vnoweb.ca` is what we used.

**Step 1 — Authorize `cloudflared` with your Cloudflare account.** Opens a browser, you pick the zone:

```powershell
cloudflared tunnel login
Test-Path $env:USERPROFILE\.cloudflared\cert.pem   # True
```

**Step 2 — Create the tunnel.** This writes a credentials JSON under `%USERPROFILE%\.cloudflared\<UUID>.json` and prints the UUID. Capture the UUID.

```powershell
cloudflared tunnel create vno-engine
cloudflared tunnel list   # should show one row, 0 connections
```

**Step 3 — Write `engine/tunnel/config.yml`.** `config.yml.example` is committed as a template; the real one stays out of git because it contains your Windows username. Fill in the UUID from Step 2 and your username:

```yaml
tunnel: <UUID>
credentials-file: C:\Users\<YOU>\.cloudflared\<UUID>.json

ingress:
  - hostname: engine.vnoweb.ca
    service: http://localhost:3000
  - service: http_status:404
```

The 404 catchall is required — cloudflared rejects configs that don't end with one. Having the explicit hostname match isn't strictly necessary (DNS only routes `engine.vnoweb.ca` here anyway) but it documents intent.

**Step 4 — Bind the subdomain to the tunnel.** This writes a CNAME on your Cloudflare zone:

```powershell
cloudflared tunnel route dns vno-engine engine.vnoweb.ca
nslookup engine.vnoweb.ca 1.1.1.1   # should resolve to Cloudflare edge IPs
```

Done. The tunnel UUID and the CNAME live in Cloudflare's records permanently. If you rebuild the machine, you re-run Steps 1, then Step 3 with the existing UUID (re-download credentials JSON via Cloudflare dashboard). You never need to redo Step 2 or Step 4.

### App `.env`

Set once, forever:

```
VITE_ENGINE_URL=https://engine.vnoweb.ca
```

No trailing slash — `api.ts` appends `/build` itself.

---

## Per-session run — the two permanent windows

### Window 1 — engine

```powershell
cd D:\vno\engine
npm start
```

You should see:

```
[vno-engine] listening on http://localhost:3000
[vno-engine] expose via: cloudflared tunnel --url http://localhost:3000
```

(The second log line is a Phase 3 stub — ignore it, you're not using a quick tunnel anymore.) Leave the window open. Every `/build` request logs a block showing request ID, parallel-work byte counts, clone duration, 7-file deploy, and the Netlify URL.

### Window 2 — tunnel

```powershell
cd D:\vno\engine
cloudflared tunnel --config tunnel/config.yml run vno-engine
```

Within a few seconds you should see four `Registered tunnel connection` lines — cloudflared opens four connections to four different Cloudflare edge POPs for redundancy. Once all four register, the tunnel is live.

Sanity:

```powershell
Invoke-RestMethod https://engine.vnoweb.ca/health
# → ok=True, service=vno-engine, phase=5
```

That's it for daily run. App stays as-is on Netlify; phone points at the same PWA URL; engine URL baked into the app bundle is already `engine.vnoweb.ca`.

If you change app code and redeploy, you'll need a Window 3 long enough to `npm run build` + drag `dist/` onto the Netlify dashboard.

---

## Phone acceptance test

Reload the PWA on your phone (pull-to-refresh to let the service worker pick up any new build) and run the full quiz for a real local business. Salon or barber work best because they have reference entries; other verticals show an empty state on Screen 4.

The 23 acceptance checks:

| # | Check | What to look for |
|---|---|---|
| 1 | Engine starts | Window 1: `[vno-engine] listening on http://localhost:3000`, no missing-env-var errors |
| 2 | Tunnel up | Window 2: 4× `Registered tunnel connection` within ~10s |
| 3 | Health reachable | `Invoke-RestMethod https://engine.vnoweb.ca/health` returns `phase=5` |
| 4 | App bundle targets named URL | `Select-String D:\vno\app\dist\assets\*.js -Pattern "engine.vnoweb.ca"` returns one match, no `trycloudflare.com` or `your-domain.example` |
| 5 | Screen 1 — vertical | Tap a vertical with references (Salon) |
| 6 | Screen 2 — business info | Name, address, phone, hours all required |
| 7 | Screen 3 — sections | Default toggles, Continue |
| 8 | Screen 4 — reference | The one tile (Serenity Hair on Salon) is tappable; Continue disabled until tapped |
| 9 | Screen 5 — logo required | Continue dark until logo uploaded |
| 10 | Screen 5 — photo 1 required | Continue still dark after logo; needs HERO slot filled |
| 11 | Screen 5 — photo 2 required | Continue still dark after hero; needs SECONDARY slot filled. All three → Continue lights up |
| 12 | Screen 6 — special | Type a one-liner, or skip |
| 13 | Screen 7 — Build tap | Tap **Build the site →**, button becomes **Building…**, progress bar starts |
| 14 | Engine validates payload | Window 1 shows `POST /build`, then `vertical: salon`, `business: <Your Name>`, then `→ parallel: screenshot + asset processing + fal.ai` — not `Missing assets.logo` |
| 15 | Parallel fan-out | Window 1 shows the parallel block completes with byte counts for screenshot, logo, photo1, photo2, grain, badge, sketch |
| 16 | Clone runs | `→ cloning...` → `✓ html N chars` (~60s) |
| 17 | Multi-file deploy | `→ deploying as vno-<slug>-* (7 files)` → `✓ deployed to https://vno-<slug>-xxxxxx.netlify.app` |
| 18 | Build finishes in ~90s | `returning {"requestId":"...","url":"...","buildTime":85.0,"phase":5}` |
| 19 | Phone lands on /review | Review screen shows your typed business name, `Built in ~90s`, and the new Netlify domain |
| 20 | Preview loads real site | **Hand to client →** → DND check → **Enter Preview Mode** → iframe shows the generated site with **your uploaded logo prominent in the header** |
| 21 | Hero is your photo | The hero image is the photo you uploaded as HERO, not a hotlinked reference image |
| 22 | Secondary is your photo | The next section below the hero uses your SECONDARY photo |
| 23 | Decoratives rendered | Top-right shows the EST badge stamp; a subtle grain overlay is visible across the page; a sketch flourish sits under the main headline |

All 23 pass → Phase 5 is shipped.

**Cost per successful build:** ~$0.11. Anthropic vision call ($0.10) plus three fal.ai flux/schnell generations at ~$0.003 each. Netlify and Cloudflare Tunnel are free.

---

## Contracts and traps

These are the non-obvious rules that bit us during Phase 5 and will bite again if future-you changes them without reading this section.

### The `assets` wire-shape contract

`req.body.assets.logo`, `.photo1`, `.photo2` are the exact keys the engine's `build.ts` validates against. The app's Zustand store uses the same keys in its `Assets` interface — `{ logo, photo1, photo2 }`, each holding a `data:image/...;base64,...` string. The `api.ts` `postBuild()` function sends `state.assets` directly as the `assets` object in the POST body, so the in-store shape is the on-the-wire shape. Both ends must move in lockstep. If you rename one side to something friendlier (like `logoDataUrl`) and forget the other, every build 500s at validation with `Missing assets.logo` — which is exactly what happened on the first phone test of Phase 5, caught by reading the engine logs. The JSDoc on `Assets` in `store.ts` calls this out — keep it there.

### Dotenv load order

`engine/src/server.ts` must have `import 'dotenv/config'` as the very first import, before `import { buildRoute } from './routes/build.js'`. That's because the transitive import chain `build.ts → fal.ts` calls `fal.config({ credentials: process.env.FAL_KEY })` at module scope — if dotenv hasn't populated `process.env` by the time `fal.ts` loads, `FAL_KEY` is undefined and every decorative asset call returns `Unauthorized`. Puppeteer and Anthropic don't show this symptom because they read env lazily at call time. Fal is the only module-scope reader today, but assume every new SDK could be one.

### Persist version contract

The app's Zustand persist middleware uses a numeric `version` key. Bump it any time you change the shape of persisted state — Phase 5 bumped twice (`1 → 2` when removing `vibe`; `2 → 3` when renaming `logoDataUrl → logo` etc.). A bump invalidates every user's persisted blob on next load, which is the right thing — otherwise the app either carries stale fields forward (silent correctness bugs) or fails to deserialize (hard crashes). Your phone counts as a user: if the PWA seems to be carrying old quiz state across a deploy, check the version number first.

### The cloner asset contract

`engine/src/lib/cloner.ts`'s system prompt names six paths exactly — `/logo.png`, `/hero.jpg`, `/photo2.jpg`, `/grain.png`, `/badge.png`, `/sketch.png` — and explicitly forbids hotlinking anything else. `build.ts`'s `assets: AssetFile[]` array uploads files at those same paths. If you add a fourth prospect photo or a fourth decorative, you edit both files together. The deploy won't complain about a missing path — the HTML will just render a broken-image icon in production and it'll look embarrassingly unprofessional.

---

## Known gaps — candidates for Phase 5.1

The following fell out of Phase 5 testing and didn't ship. None of them block the pitch, but they're the obvious polish for the next pass.

**iPhone EXIF rotation.** Sharp's default is to respect EXIF orientation, but it strips the metadata on output. This mostly works; edge cases where a phone photo comes out sideways on the deployed site mean the EXIF header was malformed. Fix: explicitly `sharp(buf).rotate()` before `.resize()` in `processPhoto`, which bakes the orientation into the pixels.

**Hardcoded year in the badge.** The cloner prompt currently says "EST. YYYY" and trusts Claude to fill in the year from context. In practice the year is passed into `BADGE_PROMPT(year)` at image-generation time (`new Date().getFullYear()`), but the HTML's `<img alt="">` text and positioning vary. Tighten the prompt to reference the year literally so the badge and the surrounding copy agree.

**Netlify site cleanup.** Every build creates a fresh `vno-<slug>-<nanoid>.netlify.app`. Free tier allows 500 sites — it'll take a while to hit, but the cleanup is manual today. Candidate for a cron that deletes sites older than 30 days.

**SSE build progress.** Screen 7's progress bar rotates placeholder copy on a fixed schedule; it has no idea where the engine actually is in the pipeline. An SSE stream from `/build` would let the phone show the real parallel-work counts, clone progress, and deploy status.

---

## Troubleshooting

**`Missing assets.logo` at 0.0s.** Wire-shape mismatch — the app is sending `logoDataUrl` or similar. See the "assets wire-shape contract" above. Check `app/src/lib/store.ts` and `app/src/lib/api.ts` are both using bare `logo`/`photo1`/`photo2`.

**`Unauthorized` from fal.ai on every build.** Either `FAL_KEY` is missing/rotated in `engine/.env`, or the dotenv load order in `server.ts` regressed. Verify `import 'dotenv/config'` is the first line. Rotate the key at https://fal.ai/dashboard/keys if needed.

**Tunnel window shows `failed to connect` loops.** Either the local engine isn't running (check Window 1 is still on `listening on http://localhost:3000`) or the credentials JSON path in `tunnel/config.yml` is wrong (username typo, or you rebuilt the machine and the UUID-named file isn't there anymore). `Test-Path <credentials-file-path>` from the config.yml to verify.

**Phone shows `Build failed: 413 Payload Too Large`.** A prospect photo was bigger than 25 MB after base64. Phase 5 bumped the Express body limit from 10 MB to 25 MB — if this starts hitting, either bump further in `server.ts` or pre-resize on the client before upload.

**Phone shows `Build failed: Missing assets.photo1`.** Prospect skipped Screen 5. Shouldn't happen in Phase 5 — `useCanContinue(5)` gates all three. If it does, check the validation wasn't reverted.

**Preview renders but logo is tiny.** Either Claude ignored the "make the logo prominent" part of the system prompt (rare, retry the build — first attempt usually cleans up), or the logo processing in `assets.ts` bottomed out below 100×100 pixels (check `processLogo` — `withoutEnlargement` can leave a small PNG small).

**Preview hero is a blurry stretched mess.** The prospect uploaded a portrait-orientation photo and it got cropped into a landscape hero. Known limitation of the cloner prompt today; a 5.1 candidate is to pass aspect-ratio hints into the prompt per-asset.

**Everything works but the EST badge shows `EST. YYYY` literally.** Claude wrote the placeholder year verbatim. Usually self-corrects on retry; long-term, harden `BADGE_PROMPT` and the system prompt to commit to the actual year.

**Build works but decoratives don't show up.** View-source the generated site and grep for `/grain.png`, `/badge.png`, `/sketch.png`. If the paths aren't there, the cloner prompt didn't inject them — retry. If the paths are there but 404ing, the multi-file deploy didn't upload them — check Window 1's engine log for the byte counts of `grain/badge/sketch` in the parallel-work block. Zero bytes means fal.ai returned no image; partial bytes means the download failed mid-stream.

---

## What changed between Phase 4 and Phase 5 (for your next-week memory)

Engine: added `engine/src/lib/glossary.ts` (per-vertical terminology), `engine/src/lib/assets.ts` (sharp image processing), `engine/src/lib/fal.ts` (decorative asset generation), extended `engine/src/lib/netlify.ts` with `deploySite()` multi-file, rewrote `engine/src/routes/build.ts` for parallel pre-work + 7-file deploy, updated `engine/src/lib/cloner.ts` system prompt (fixed asset paths, no hotlinking, glossary injection), bumped `express.json` body limit from 10 MB to 25 MB, flipped `/health` `phase: 3 → phase: 5`, removed `"vibe"` from `engine/src/references/library.json`.

App: removed `vibe` field/setter/type from `store.ts`/`api.ts`/`references.ts`/`Screen7Build.tsx`; renamed `Assets` keys `logoDataUrl/photo1DataUrl/photo2DataUrl → logo/photo1/photo2` to match the engine's wire shape; tightened `useCanContinue(5)` to require all three assets; updated Screen 5 copy (required language, HERO/SECONDARY labels); bumped persist version twice (1→2 for vibe removal, 2→3 for assets rename).

Tunnel: introduced `engine/tunnel/config.yml.example` + `.gitignore` entry for the real `config.yml`; app points at `https://engine.vnoweb.ca` instead of a daily-rotating `trycloudflare.com` URL.

The wire Phase 4 verified with fake assets now carries real prospect uploads all the way to a deployed, styled, six-asset site — and the URL between your phone and your PC has stopped being ephemeral.
