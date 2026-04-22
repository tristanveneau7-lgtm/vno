# VNO — Phase 5: Real Assets + Decorative Chrome + Stable Tunnel

**One-sentence goal:** Replace the cloner's hotlinked reference images with the prospect's actual logo and photos, layer three fal.ai-generated decorative assets per build (grain, badge, sketch), give Tristan a stable tunnel URL across sessions, and add per-vertical terminology hints to sharpen the clone language. Engine deploys multi-file Netlify sites instead of single HTML files.

**What this is NOT:**
- Not real-time progress streaming (deferred to Phase 6+)
- Not multi-page sites (still landing only)
- Not library curation (code supports unlimited entries; user curates separately on their own timeline)
- Not vibe filtering (the `vibe` field is removed entirely)
- Not Netlify site cleanup automation (manual delete via dashboard remains)

**When Phase 5 is done:** Tristan walks up to a barber shop in Tampa, opens his PWA, taps through the quiz with the prospect's name, picks a barber reference tile from the now-multi-entry library, uploads the prospect's logo and 2 photos he just took, taps Build, waits ~3 minutes, and shows the prospect a generated barber site with the prospect's actual logo prominently in the header, the prospect's hero photo as the main image, the second photo as a secondary section image, a subtle grain texture across the page, an "EST. YYYY" badge in the corner, and a hand-drawn sketch under the headline. Tunnel is stable across sessions — no more `.env` swap each morning.

---

## Prerequisites

All must be true:

1. Phases 1, 2, 3, 4 shipped, committed, pushed
2. Engine runs on home PC
3. **`FAL_KEY` in `engine/.env` is valid and the fal.ai account has credits/spend cap configured**
4. Anthropic daily cap set at $10 (`console.anthropic.com/settings/limits`)
5. Tristan completed `cloudflared tunnel login` (one-time browser auth) BEFORE Cowork starts — see Setup section below
6. Tristan has a free Cloudflare account (signup at `cloudflare.com`)

## Reference files

- `PHASE_4_REAL_CLONER.md` — prior phase
- `PHASE_4_HANDOFF.md` — runbook pattern
- `VNO_V3_LOCKED_DECISIONS.md` — overall architecture

---

## Architecture: the upgraded build pipeline

```
Phone → POST /build with full payload (now WITH base64 logo + photo1 + photo2)
  ↓
Engine receives, validates ALL 3 assets present (rejects if any missing)
  ↓
Step 1: Puppeteer screenshots reference.url
  ↓
Step 2: Process assets in parallel:
  - sharp resizes logo to 400×400 PNG (lossless)
  - sharp resizes photo1 to 1920px wide JPEG q90
  - sharp resizes photo2 to 1920px wide JPEG q90
  - fal.ai generates grain texture (1024×1024 PNG)
  - fal.ai generates badge stamp (300×300 PNG, transparent bg)
  - fal.ai generates sketch flourish (400×100 PNG, transparent bg)
  All 6 in parallel via Promise.all
  ↓
Step 3: Claude vision call (single call as before)
  Input: reference screenshot + business info + glossary terms + asset URLs (placeholder /logo.png, /hero.jpg, etc.)
  Output: HTML referencing /logo.png, /hero.jpg, /photo2.jpg, /grain.png, /badge.png, /sketch.png
  ↓
Step 4: If Claude returns garbage, retry once. Hard fail on second attempt.
  ↓
Step 5: Netlify multi-file deploy:
  - index.html
  - logo.png (processed)
  - hero.jpg (processed)
  - photo2.jpg (processed)
  - grain.png (fal.ai)
  - badge.png (fal.ai)
  - sketch.png (fal.ai)
  ↓
Engine returns { requestId, url, buildTime, phase: 5 }
```

**Why this shape:**
- Multi-file deploy already supported by Netlify API (Phase 4's deploy code uses `{ files: { '/index.html': sha1 } }` — the signature is generic)
- Parallel asset processing via Promise.all keeps build time reasonable (~3-4 min instead of 5-6)
- Claude generates HTML referencing fixed asset URLs (`/logo.png`, etc.) — predictable, no per-build URL juggling
- Per-vertical glossary injected into the user message at runtime, not the system prompt — keeps system prompt cacheable

---

## What gets built

### 1. Engine changes (`D:\vno\engine\`)

```
D:\vno\engine\
├── src\
│   ├── server.ts                      # /health bumped to phase: 5
│   ├── routes\
│   │   └── build.ts                   # rewritten — orchestrates new parallel pipeline
│   ├── lib\
│   │   ├── puppeteer.ts               # unchanged
│   │   ├── cloner.ts                  # updated — glossary, asset references, no logo generation hint
│   │   ├── netlify.ts                 # extended — multi-file deploy
│   │   ├── assets.ts                  # NEW — sharp processing for logo + photos
│   │   ├── fal.ts                     # NEW — fal.ai integration (grain + badge + sketch)
│   │   └── glossary.ts                # NEW — per-vertical terminology lookup
│   ├── references\
│   │   └── library.json               # remove `vibe` field from existing entries
│   └── tunnel\                        # NEW
│       └── config.yml                 # cloudflared config (Tristan creates from template)
├── package.json                       # add sharp + @fal-ai/client
└── .env                               # already has FAL_KEY from earlier setup
```

**New dependencies:**
- `sharp` (image processing — well-maintained, fast, native bindings)
- `@fal-ai/client` (official fal.ai Node client)

### 2. App changes (`D:\vno\app\`)

```
D:\vno\app\src\
├── lib\
│   ├── store.ts                       # remove `vibe` field + setter; update partialize
│   ├── references.ts                  # remove `vibe` from Reference type + REFERENCES entries
│   └── validation.ts                  # update useCanContinue(5) to require all 3 assets
└── routes\
    └── Screen5Assets.tsx              # update copy: photo tiles say "Required" not "Optional"
```

That's the entire app surface area. No new screens, no removed screens. Phase 5 is mostly engine work + app cleanup.

---

## Engine implementation details

### `engine/src/lib/glossary.ts`

```ts
export const VERTICAL_TERMS: Record<string, string> = {
  salon: 'Use "Book an appointment" for the primary CTA. Refer to staff as "stylists" or "team."',
  barber: 'Use "Walk-ins welcome" or "Book a chair" for the primary CTA. Refer to staff as "barbers." Avoid the word "salon."',
  tattoo: 'Use "Book a consultation" for the primary CTA. Refer to staff as "artists" not "stylists." Mention portfolio prominently.',
  groomer: 'This is a pet groomer. Refer to clients as "pets" or "your dog/cat." Use "Book grooming" for the primary CTA.',
  trades: 'This is a trades business (electrician, plumber, carpenter, etc.). Use "Get a quote" or "Request service" for the primary CTA. Emphasize licensing and emergency availability if relevant.',
  restaurant: 'Use "Make a reservation" or "Order online" for the primary CTA. Show menu prominently. Refer to staff as "kitchen" or "team."',
  gym: 'Use "Start your trial" or "Join now" for the primary CTA. Emphasize energy and results. Refer to staff as "trainers" or "coaches."',
  health: 'This is a health/wellness practitioner. Use "Book a session" or "Schedule appointment" for primary CTA. Use calm professional tone. Avoid hype language.',
  auto: 'This is an auto shop. Use "Get a quote" or "Schedule service" for primary CTA. Mention specialties (mechanical, body work, detailing). Refer to staff as "mechanics" or "technicians."',
  daycare: 'This is a childcare/daycare business. Use "Schedule a tour" for primary CTA. Use warm, family-focused tone. Mention licensing/safety prominently.',
}

export function termsFor(vertical: string): string {
  return VERTICAL_TERMS[vertical] ?? ''
}
```

**Note:** these are STARTING defaults. Tristan can tune them as he sees real pitches. They're maintained in code, not config, because they shape the clone — version-controlling them via git is the right discipline.

### `engine/src/lib/assets.ts`

```ts
import sharp from 'sharp'

export async function processLogo(base64DataUri: string): Promise<Buffer> {
  const buf = base64ToBuffer(base64DataUri)
  return sharp(buf)
    .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

export async function processPhoto(base64DataUri: string): Promise<Buffer> {
  const buf = base64ToBuffer(base64DataUri)
  return sharp(buf)
    .resize(1920, null, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer()
}

function base64ToBuffer(dataUri: string): Buffer {
  const match = dataUri.match(/^data:[^;]+;base64,(.+)$/)
  if (!match) throw new Error('Invalid base64 data URI')
  return Buffer.from(match[1], 'base64')
}
```

**Why these settings:**
- Logos: PNG lossless because logos have flat color regions where JPEG artifacts are visible. Compression level 9 is max but fast for small files.
- Photos: 1920px wide is the standard "retina display max useful size" — anything larger is wasted bandwidth. JPEG q90 is the sweet spot (visually identical to q100 on phone screens, ~70% smaller files). `mozjpeg` flag uses the better encoder for ~10% more compression at same quality.
- `withoutEnlargement: true` means small uploads don't get stretched — they just stay their original size. Important for photos that are already 800px wide; we don't want a blurry 1920px upscale.

### `engine/src/lib/fal.ts`

```ts
import { fal } from '@fal-ai/client'

// fal.ai client reads FAL_KEY from env on first use
fal.config({ credentials: process.env.FAL_KEY })

const GRAIN_PROMPT = 'subtle film grain texture, monochromatic noise, organic, slightly warm undertone, seamless tile, 5% intensity, clean'
const BADGE_PROMPT = (year: string) =>
  `vintage stamp graphic, circular, "EST ${year}" text in center, ink stamp aesthetic, slightly distressed edges, single color, transparent background`
const SKETCH_PROMPT = 'hand-drawn flourish, single ink stroke underline with small flourish at end, organic, casual, transparent background, monochrome'

export interface DecorativeAssets {
  grain: Buffer
  badge: Buffer
  sketch: Buffer
}

export async function generateDecorativeAssets(year: string): Promise<DecorativeAssets> {
  const [grain, badge, sketch] = await Promise.all([
    generateImage(GRAIN_PROMPT, '1024x1024'),
    generateImage(BADGE_PROMPT(year), '512x512'),
    generateImage(SKETCH_PROMPT, '512x256'),
  ])
  return { grain, badge, sketch }
}

async function generateImage(prompt: string, size: string): Promise<Buffer> {
  // Using fal-ai/flux/schnell — fast, cheap (~$0.003 per image)
  const result = await fal.subscribe('fal-ai/flux/schnell', {
    input: {
      prompt,
      image_size: size,
      num_inference_steps: 4,  // schnell is fast at 4 steps
      enable_safety_checker: false,  // these are abstract decorative assets
    },
    logs: false,
  }) as { data?: { images?: Array<{ url: string }> } }

  const url = result.data?.images?.[0]?.url
  if (!url) throw new Error('fal.ai returned no image')

  // Download the image bytes
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download fal.ai image: ${response.status}`)
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
```

**Cost breakdown per build:**
- 3 schnell calls × ~$0.003 = ~$0.009
- Plus image downloads (free)
- Total fal.ai cost per build: ~$0.01

**That's ~$0.04 below my earlier $0.04/build estimate.** I overestimated. Schnell is cheap. Real per-build cost will be Anthropic ($0.10) + fal.ai ($0.01) = ~$0.11, not $0.22.

**Notes:**
- `fal-ai/flux/schnell` is the fast/cheap variant. Can swap to `fal-ai/flux/dev` later if quality demands more.
- 4 inference steps is schnell's sweet spot. More steps don't help.
- `enable_safety_checker: false` is necessary because the safety checker sometimes flags abstract art as "uncertain" and refuses. These are decorative shapes, not faces, so it's safe to disable.

### `engine/src/lib/cloner.ts` updates

The `cloneToHtml` signature gains the asset-aware system prompt and per-vertical terms. Key changes:

```ts
import { termsFor } from './glossary.js'

const SYSTEM_PROMPT = `You are a web designer building a one-page landing site for a local small business.

You will be given:
1. A screenshot of a reference website (a small business in the same vertical)
2. Information about the target business
3. Vertical-specific terminology guidance

Your job: produce a SINGLE HTML FILE that looks visually similar to the reference, but with all content replaced to match the target business AND the target's actual provided assets used in specific positions.

ASSET PLACEMENT (mandatory — do not deviate):
- The target's LOGO is at /logo.png. Use it as the dominant element in the header. Make it visually prominent — give it real size and presence, not a tiny corner mark. The logo is the primary brand expression.
- The target's HERO PHOTO is at /hero.jpg. Use it as the main hero image — replace the reference's hero entirely.
- The target's SECONDARY PHOTO is at /photo2.jpg. Use it in the next major content section after the hero.

DECORATIVE ASSETS (sprinkle these in, do not omit):
- /grain.png — subtle full-page background overlay. Apply via CSS as fixed-position background with opacity 0.05 and mix-blend-mode: multiply for warmth.
- /badge.png — small "EST. YYYY" stamp. Position absolute, top-right corner, ~100px wide, with a subtle drop shadow.
- /sketch.png — hand-drawn flourish. Position immediately under the main hero headline, ~300px wide, centered or aligned with the headline.

Other rules:
- Output ONLY the HTML. No markdown, no code fences, no explanation.
- Start with <!DOCTYPE html> and end with </html>.
- All CSS must be inline in a <style> tag in <head>. No external stylesheets.
- Copy the reference's visual structure: layout, color palette, typography hierarchy, section patterns.
- Replace ALL business-specific text with the target's info.
- Use Google Fonts via <link> in <head> if the reference's fonts match a common Google Font.
- Do NOT hotlink images from the reference site. Only use /logo.png, /hero.jpg, /photo2.jpg, /grain.png, /badge.png, /sketch.png.
- If the reference shows testimonials, generate 2-3 plausible placeholder testimonials for the target business — signed with first-name-last-initial style names.
- Keep the page mobile-responsive with media queries.
- No JavaScript unless absolutely necessary for layout.`

function buildUserMessage(b: BusinessInfo, referenceUrl: string): string {
  const activeSections = Object.entries(b.sections).filter(([, on]) => on).map(([k]) => k).join(', ')
  const terms = termsFor(b.vertical)
  return `Reference URL: ${referenceUrl}

Target business info:
- Vertical: ${b.vertical}
- Name: ${b.name}
- Address: ${b.address}
- Phone: ${b.phone}
- Hours: ${b.hours}
${b.slogan ? `- Slogan: ${b.slogan}` : ''}
${b.anythingSpecial ? `- Notes: ${b.anythingSpecial}` : ''}
- Sections on: ${activeSections || '(landing only)'}

${terms ? `Vertical-specific terminology:\n${terms}\n` : ''}

Generate the HTML now.`
}
```

### `engine/src/lib/netlify.ts` extension

```ts
import crypto from 'node:crypto'

export interface AssetFile {
  path: string  // e.g. '/logo.png'
  buffer: Buffer
  contentType: string
}

export async function deploySite(
  html: string,
  assets: AssetFile[],
  businessSlug: string
): Promise<string> {
  const token = process.env.NETLIFY_AUTH_TOKEN
  if (!token) throw new Error('NETLIFY_AUTH_TOKEN not set')

  const suffix = nanoid(6).toLowerCase()
  const siteName = `vno-${businessSlug}-${suffix}`

  // Step 1: create site
  const createRes = await axios.post(
    `${NETLIFY_API}/sites`,
    { name: siteName },
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const site = createRes.data

  // Step 2: register deploy with all file digests
  const files: Record<string, string> = {
    '/index.html': sha1(html),
  }
  for (const asset of assets) {
    files[asset.path] = sha1(asset.buffer)
  }

  const deployRes = await axios.post(
    `${NETLIFY_API}/sites/${site.id}/deploys`,
    { files },
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const deploy = deployRes.data

  // Step 3: upload each file in parallel
  const uploads = [
    uploadFile(deploy.id, '/index.html', Buffer.from(html), 'text/html', token),
    ...assets.map((a) => uploadFile(deploy.id, a.path, a.buffer, a.contentType, token)),
  ]
  await Promise.all(uploads)

  return `https://${site.name}.netlify.app`
}

async function uploadFile(deployId: string, path: string, buffer: Buffer, contentType: string, token: string): Promise<void> {
  await axios.put(
    `${NETLIFY_API}/deploys/${deployId}/files${path}`,
    buffer,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType,
      },
    }
  )
}

function sha1(data: Buffer | string): string {
  return crypto.createHash('sha1').update(data).digest('hex')
}

// existing deployHtml() can stay or be removed — deploySite() supersedes it
// (keep it for now, mark @deprecated, remove in cleanup phase)
```

### `engine/src/routes/build.ts` rewrite

```ts
import { processLogo, processPhoto } from '../lib/assets.js'
import { generateDecorativeAssets } from '../lib/fal.js'
import { deploySite } from '../lib/netlify.js'

export async function buildRoute(req: Request, res: Response) {
  const requestId = nanoid(8)
  const startTime = Date.now()

  console.log(`\n[${requestId}] POST /build`)
  console.log(`[${requestId}] vertical: ${req.body.vertical}`)
  console.log(`[${requestId}] business: ${req.body.business?.name}`)

  try {
    // Validate
    if (!req.body.vertical) throw new Error('Missing vertical')
    if (!req.body.business?.name) throw new Error('Missing business.name')
    if (!req.body.reference?.url) throw new Error('Missing reference.url')
    if (!req.body.assets?.logo) throw new Error('Missing assets.logo')
    if (!req.body.assets?.photo1) throw new Error('Missing assets.photo1')
    if (!req.body.assets?.photo2) throw new Error('Missing assets.photo2')

    const business: BusinessInfo = { /* ...as before... */ }
    const year = new Date().getFullYear().toString()  // for badge

    // Parallel: screenshot reference + process all assets + generate decorative
    console.log(`[${requestId}] → parallel: screenshot + asset processing + fal.ai`)
    const [screenshot, logoBuf, photo1Buf, photo2Buf, decorative] = await Promise.all([
      screenshotUrl(req.body.reference.url),
      processLogo(req.body.assets.logo),
      processPhoto(req.body.assets.photo1),
      processPhoto(req.body.assets.photo2),
      generateDecorativeAssets(year),
    ])
    console.log(`[${requestId}] ✓ all parallel work done`)
    console.log(`[${requestId}]   screenshot: ${screenshot.length} bytes`)
    console.log(`[${requestId}]   logo: ${logoBuf.length} bytes`)
    console.log(`[${requestId}]   photo1: ${photo1Buf.length} bytes`)
    console.log(`[${requestId}]   photo2: ${photo2Buf.length} bytes`)
    console.log(`[${requestId}]   grain: ${decorative.grain.length} bytes`)
    console.log(`[${requestId}]   badge: ${decorative.badge.length} bytes`)
    console.log(`[${requestId}]   sketch: ${decorative.sketch.length} bytes`)

    // Sequential: clone (with retry)
    console.log(`[${requestId}] → cloning...`)
    let html: string
    try {
      html = await cloneToHtml(screenshot, business, req.body.reference.url)
    } catch (err) {
      console.log(`[${requestId}] ⚠ clone failed, retrying once: ${err}`)
      html = await cloneToHtml(screenshot, business, req.body.reference.url)
    }
    console.log(`[${requestId}] ✓ html ${html.length} chars`)

    // Sequential: deploy
    const slug = slugify(business.name)
    const assets: AssetFile[] = [
      { path: '/logo.png', buffer: logoBuf, contentType: 'image/png' },
      { path: '/hero.jpg', buffer: photo1Buf, contentType: 'image/jpeg' },
      { path: '/photo2.jpg', buffer: photo2Buf, contentType: 'image/jpeg' },
      { path: '/grain.png', buffer: decorative.grain, contentType: 'image/png' },
      { path: '/badge.png', buffer: decorative.badge, contentType: 'image/png' },
      { path: '/sketch.png', buffer: decorative.sketch, contentType: 'image/png' },
    ]
    console.log(`[${requestId}] → deploying as vno-${slug}-* (7 files)`)
    const url = await deploySite(html, assets, slug)
    console.log(`[${requestId}] ✓ deployed to ${url}`)

    const buildTime = ((Date.now() - startTime) / 1000).toFixed(1)
    const response = { requestId, url, buildTime: Number(buildTime), phase: 5 }
    console.log(`[${requestId}] → returning ${JSON.stringify(response)}`)
    res.json(response)
  } catch (err) {
    const buildTime = ((Date.now() - startTime) / 1000).toFixed(1)
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.log(`[${requestId}] ✗ failed after ${buildTime}s: ${message}`)
    res.status(500).json({ requestId, error: message, phase: 5 })
  }
}
```

**Why parallel for the heavy lifting:**
- Screenshot: ~10s
- Asset processing (sharp): ~1-2s each
- fal.ai: ~5-10s per image, parallel = ~10s for all three
- **Sequential total: ~30-40s. Parallel total: ~10-12s.** Saves ~20s per build.

Then sequential clone (~60s) + deploy (~10s) = total build time ~80-90s. Same as Phase 4 despite doing way more work.

### `engine/src/server.ts` change

One line: change `phase: 3` to `phase: 5` in the `/health` endpoint. Yes, we skipped 4 — small cosmetic debt cleared in Phase 5.

---

## App implementation details

### `app/src/lib/store.ts`

Remove `vibe` field, setter, and reset assignment. Remove from `partialize`. The `assets` field stays the same (logo + photo1 + photo2 already collected by Phase 4).

### `app/src/lib/references.ts`

Remove `vibe` from the `Reference` type. Remove `vibe: 'heritage'` from the existing salon entry.

### `app/src/lib/validation.ts`

Update `useCanContinue(5)` from "logo present" to "all 3 assets present":

```ts
case 5:
  return !!(state.assets.logo && state.assets.photo1 && state.assets.photo2)
```

### `app/src/routes/Screen5Assets.tsx`

Update tile copy:
- Logo tile already says "Logo" — keep as-is, it's mandatory
- Photo 1 tile: change label from "Photo (optional)" to "Hero photo (required)"
- Photo 2 tile: change label from "Photo (optional)" to "Secondary photo (required)"
- The skip path that exists for missing photos: remove it. Continue button only enables when all 3 are present.

Make sure the empty state of each tile shows what's expected (e.g., a faint upload icon + the label). User will see clearly "ah, I need 3 things uploaded before I can continue."

---

## Named tunnel setup

This is partially user setup (one-time auth) and partially Cowork (config files).

### Tristan does (one-time, BEFORE Cowork starts):

```powershell
# 1. Create free Cloudflare account at cloudflare.com if you don't have one

# 2. Auth cloudflared to your account
cloudflared tunnel login
# This opens a browser, you log in, authorize. Saves cert to ~/.cloudflared/cert.pem

# 3. Create the tunnel
cloudflared tunnel create vno-engine
# Outputs a UUID. Save this UUID.
```

### Cowork writes:

`engine/tunnel/config.yml.example`:
```yaml
tunnel: <REPLACE_WITH_TUNNEL_UUID>
credentials-file: C:\Users\<YOU>\.cloudflared\<TUNNEL_UUID>.json

ingress:
  - service: http://localhost:3000
```

Tristan copies to `engine/tunnel/config.yml`, fills in the UUID and his Windows username, saves. (config.yml goes in `.gitignore` so the credentials path stays out of git.)

### Daily run becomes:

```powershell
# Window 1: engine
cd D:\vno\engine && npm start

# Window 2: tunnel (always same URL!)
cloudflared tunnel --config tunnel/config.yml run vno-engine
```

Tunnel URL is deterministic from the UUID — same URL every session forever. `app/.env` gets set ONCE and never changes.

**The stable URL format is `<UUID>.cfargotunnel.com`.** Cowork will document the exact URL Tristan needs to put in `app/.env` once the tunnel is created. This URL is used in the `VITE_ENGINE_URL` environment variable for the app build, and it never changes after this initial setup.

---

## Execution order for Cowork (14 steps)

Pause after each, summarize, wait for "continue."

- **Step 1:** Install new deps (`sharp`, `@fal-ai/client`). Sharp's native bindings download platform-specific binaries — typical sandbox gotcha, expect to write code + typecheck + defer install to Tristan's PC.
- **Step 2:** Write `engine/src/lib/glossary.ts` with the 10 vertical entries from this spec. Smoke test: `console.log(termsFor('barber'))` should print the barber string.
- **Step 3:** Write `engine/src/lib/assets.ts`. Smoke test: feed a base64-encoded PNG + JPEG, write outputs to `/tmp/`, verify dimensions and file size with `sharp` metadata. Tristan runs the smoke on his PC.
- **Step 4:** Write `engine/src/lib/fal.ts`. Smoke test: generate one grain image, save to `/tmp/grain-test.png`, eyeball it. Tristan runs on his PC. **Cost ~$0.003.** This is the first fal.ai call ever — confirm key works and image looks like grain not garbage.
- **Step 5:** Update `engine/src/lib/cloner.ts` with new system prompt + glossary integration. Type-check only — no smoke test until Step 7 wires everything.
- **Step 6:** Extend `engine/src/lib/netlify.ts` with `deploySite(html, assets, slug)`. Smoke test: deploy a 2-file site (index.html + a tiny test image), verify both URLs work. Tristan runs on his PC.
- **Step 7:** Rewrite `engine/src/routes/build.ts` per spec — parallel pre-work, clone with retry, multi-file deploy. Update `/health` to `phase: 5`. Smoke test: full curl with all 3 base64 assets in the payload. **Cost ~$0.11.** This is the Phase 5 end-to-end engine test.
- **Step 8:** Remove `vibe` from `engine/src/references/library.json`.
- **Step 9:** App — remove `vibe` from `src/lib/store.ts` (field, setter, partialize, reset). Typecheck.
- **Step 10:** App — remove `vibe` from `src/lib/references.ts` (Reference type + REFERENCES entries).
- **Step 11:** App — update `src/lib/validation.ts` so `useCanContinue(5)` requires all 3 assets.
- **Step 12:** App — update `Screen5Assets.tsx` copy: photo tiles say "required," remove any optional/skip language.
- **Step 13:** App — `npm run build` verification. Confirm clean compile.
- **Step 14:** Write `engine/tunnel/config.yml.example` + update `engine/.gitignore` to exclude `tunnel/config.yml`. Produce `PHASE_5_HANDOFF.md` covering full setup (cloudflared login, tunnel create, config.yml fill-in, app .env one-time set, run sequence, the new acceptance checks).

---

## Phase 5 is done when

1. Engine starts cleanly with new deps + new code
2. Named tunnel running, stable URL appears in `app/.env`
3. App rebuilt + redeployed to Netlify
4. Phone PWA reloaded
5. Quiz Screen 1: pick Salon → Continue
6. Screen 2: real business info ("Tampa Test Salon") → Continue
7. Screen 3: defaults → Continue
8. Screen 4: pick Serenity tile → Continue
9. Screen 5: **upload logo + photo1 + photo2 (all 3 mandatory)**. Continue stays disabled until all 3 present.
10. Screen 6: skip
11. Screen 7: tap Build. Watch ~80-90s.
12. Engine log shows: parallel work done (with byte counts for all 6 assets), cloning, deploying as 7-file Netlify site
13. Phone Review screen shows business name + buildTime + new URL
14. Hand to client → DND → Preview Mode loads the generated site
15. **The generated site shows the actual uploaded logo prominently in the header** (not initials, not generated)
16. **The generated site shows the uploaded hero photo as the main hero image** (not a hotlinked Australian salon image)
17. **The secondary photo appears in a content section after the hero**
18. **Subtle grain texture is visible across the page background**
19. **"EST. YYYY" badge stamp appears in a top corner with subtle drop shadow**
20. **Hand-drawn sketch flourish appears under the main headline**
21. The terminology in the rendered text matches the vertical (e.g., "Book an appointment" for salon, "Walk-ins welcome" for barber)
22. Triple-tap top-right exits to /quiz/1
23. Closing engine + tunnel windows, reopening them tomorrow → SAME tunnel URL → no `.env` change needed → app already works without rebuild

If 1-23 all pass, Phase 5 is done. Commit + push.

---

## Known trade-offs

- **Per-build cost ~$0.11** (Anthropic dominates; fal.ai schnell is dirt cheap). Daily caps protect against runaway.
- **Multi-file deploy adds ~5-10 sec to deploy step** (six file uploads in parallel — bottleneck is Netlify's API, not your bandwidth). Total build still ~80-90 sec.
- **Sharp's native bindings install can be flaky on Windows.** First `npm install` may need a retry. Falls back to JS implementation if native fails (slower but functional).
- **fal.ai schnell quality varies.** Sometimes the badge text isn't perfectly legible or the sketch looks off. For Phase 5 MVP we accept this — the assets are 5%/decorative, not the main attraction. Phase 6+ could swap to flux/dev (better, more expensive).
- **Claude may occasionally place assets wrong** (logo too small, sketch in the wrong spot). Prompt is firm but not deterministic. Re-clone catches most cases.
- **Library still has 1 entry (Serenity Hair).** All vertical buckets except salon are empty. Tristan curates separately on his timeline.
- **Tunnel URL format is `*.cfargotunnel.com`, not `*.trycloudflare.com`.** Different domain, slightly less elegant, but stable forever.

---

## What Phase 6 will add

- Real-time build progress (SSE from engine to phone — replaces rotating placeholder copy on Screen 7)
- Decorative library expansion (more fal.ai asset types: badges with custom text, multiple sketch variants, glow effects)
- fal.ai model upgrade option (schnell → dev for higher quality decorative)
- Netlify site cleanup cron (auto-delete sites older than 30 days)
- Library single source of truth (eliminate dual-edit between engine and app)
- Possibly: cloner prompt vibe hints if pitch testing reveals weakness
- Possibly: per-build feedback loop ("did this clone work?" → tunes prompts)

---

End of Phase 5 spec.
