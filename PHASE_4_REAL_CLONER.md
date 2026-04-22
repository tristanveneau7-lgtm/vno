# VNO — Phase 4: Real Cloner

**One-sentence goal:** Replace the Phase 3 stub with a real cloner pipeline — Puppeteer screenshots a reference URL, Claude vision generates matching HTML with the prospect's business info injected, engine deploys to Netlify, phone receives a unique live URL per build.

**What this is NOT:**
- Not live editing (Phase 6+)
- Not multi-page sites (landing only for Phase 4; gallery/booking/etc. toggles stay in the store but are cosmetic)
- Not fal.ai hero imagery (the reference's own images flow through the clone; fal.ai waits for Phase 5)
- Not reference library curation — only ONE seed entry (Serenity Hair Blaxland) for testing the pipeline

**When Phase 4 is done:** Tristan taps through the quiz on his phone with a real prospect's business info, picks the Serenity Hair tile on Screen 4 (the only salon entry), taps Build, waits ~2-5 minutes, and Preview Mode loads a unique Netlify URL showing a salon-styled site with the prospect's business name, address, phone, and hours where Serenity Hair's content used to be.

---

## Prerequisites

All must be true:

1. Phases 1, 2, 3 shipped, committed, pushed
2. Engine runs on home PC via `cd D:\vno\engine && npm start`
3. Cloudflare Tunnel runs via `cloudflared tunnel --url http://localhost:3000`
4. `ANTHROPIC_API_KEY` in `engine/.env` is valid and has credits (`fal.ai` key stays unused for Phase 4)
5. A Netlify personal access token exists in `engine/.env` as `NETLIFY_AUTH_TOKEN` — **Tristan creates this manually before Cowork starts** (Netlify → User settings → Applications → Personal access tokens → New access token → name it "vno-engine")

## Reference files

- `PHASE_3_BACKEND_WIRING.md` — prior phase
- `VNO_V3_LOCKED_DECISIONS.md` — overall architecture
- `PHASE_3_HANDOFF.md` — runbook pattern to follow at end of phase

---

## Architecture: the new build pipeline

```
Phone → POST /build with { vertical, business, reference: { url, label }, vibe, sections, assets, anythingSpecial }
  ↓
Engine receives, generates requestId
  ↓
Step 1: Puppeteer screenshots reference.url (full page, PNG)
  ↓
Step 2: Claude vision API call
         Input: screenshot + prompt with business info + instructions
         Output: single-file HTML (inline CSS, no external deps)
  ↓
Step 3: If Claude returns garbage or fails, retry once. If retry fails, throw.
  ↓
Step 4: Netlify API call — create new site, deploy the HTML, get unique URL
  ↓
Engine returns { requestId, url: <new unique netlify url>, buildTime, phase: 4 }
  ↓
Phone navigates to /review showing the new URL
  ↓
Hand to client → DND → Preview Mode loads the generated site
```

**Why this shape:**
- One-shot Claude call (not multi-turn) — keeps the round-trip fast and cheap
- Netlify API deploy per build — every pitch gets a unique URL, no name collisions
- Single HTML file output — no build step, no bundler, no assets to manage; Netlify serves it directly
- Reference images stay as `<img src="https://reference.com/image.jpg">` — we reuse the reference's image CDN instead of trying to copy assets. Fast, imperfect, fine for demos. (Phase 5 fixes this.)

---

## What gets built

### 1. Engine changes (`D:\vno\engine\`)

```
D:\vno\engine\
├── src\
│   ├── server.ts                    # unchanged structure, add new env vars
│   ├── routes\
│   │   └── build.ts                 # REWRITTEN — real pipeline replaces stub
│   ├── lib\
│   │   ├── puppeteer.ts             # NEW — screenshotUrl(url) returns Buffer
│   │   ├── cloner.ts                # NEW — cloneToHtml(screenshotBuffer, businessInfo) returns string
│   │   └── netlify.ts               # NEW — deployHtml(html, siteName) returns string (the new URL)
│   └── references\
│       └── library.json             # NEW — one seed entry for salon
├── package.json                     # add puppeteer, @anthropic-ai/sdk, axios (or undici)
└── .env                             # add NETLIFY_AUTH_TOKEN
```

**New dependencies:**
- `puppeteer` (runtime browser for screenshots — installs Chromium ~170MB, one-time)
- `@anthropic-ai/sdk` (official Claude API client)
- `axios` (for Netlify API calls)

Everything stays TypeScript, still launched via `tsx`.

### 2. App changes (`D:\vno\app\`)

**Screen 4 rewrite:**
- Reads from a new file `src/lib/references.ts` which exports the library
- Filters references by `state.vertical` from the store
- Renders N tiles (0 to 5) — each shows the thumbnail, a short label, the URL hostname
- Tapping a tile sets `state.reference = { url, label }` in the store
- Continue is gated on `state.reference !== null`
- If the filtered list is empty, show copy: "No references yet for this vertical — Skip to continue."
- New store field: `reference: { url: string; label: string } | null`
- `vibe` field stays in store for now (dead data — Phase 5 repurposes it for filtering within a vertical)

**New files:**
- `src/lib/references.ts` — TypeScript mirror of engine's `library.json`, hardcoded for now so the app bundle includes it. Matches engine exactly.
- `public/references/serenity-hair-salon.png` — thumbnail for the seed entry (Tristan drops this in manually before build)

**Store changes:**
- Add `reference: { url, label } | null` with setter
- `persist` middleware's partialize keeps reference alongside other text fields
- `useCanContinue(4)` now checks `state.reference !== null` instead of `state.vibe !== null`

### 3. Library schema

Both `engine/src/references/library.json` and `app/src/lib/references.ts` use this shape:

```json
{
  "salon": [
    {
      "url": "https://serenityhairblaxland.com.au/",
      "label": "Serenity Hair",
      "thumbnailPath": "/references/serenity-hair-salon.png",
      "vibe": "heritage"
    }
  ],
  "barber": [],
  "tattoo": [],
  "groomer": [],
  "trades": [],
  "restaurant": [],
  "gym": [],
  "health": [],
  "auto": [],
  "daycare": []
}
```

**Why duplicate in two places:** The engine needs the URL (server-side cloning). The app needs the thumbnail path and label (client-side rendering). Keeping them synced manually is acceptable at one entry. Phase 5 introduces a single source of truth via a shared module or build-time fetch.

---

## Engine implementation details

### `engine/src/lib/puppeteer.ts`

```ts
import puppeteer from 'puppeteer'

export async function screenshotUrl(url: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
    const screenshot = await page.screenshot({
      fullPage: false,  // above-the-fold only — Claude vision works better on a clean hero shot
      type: 'png',
    })
    return screenshot as Buffer
  } finally {
    await browser.close()
  }
}
```

**Why above-the-fold only:** Full-page screenshots are huge (often 4000+px tall), burn tokens on Claude, and confuse the model with too many sections at once. The hero section defines the site's vibe — that's what we're cloning. Phase 5 can add multi-section if needed.

### `engine/src/lib/cloner.ts`

```ts
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()  // reads ANTHROPIC_API_KEY from env

export interface BusinessInfo {
  name: string
  address: string
  phone: string
  hours: string
  slogan?: string
  anythingSpecial?: string
  sections: { [key: string]: boolean }
  vertical: string
}

const SYSTEM_PROMPT = `You are a web designer building a one-page landing site for a local small business.

You will be given:
1. A screenshot of a reference website (a small business in the same vertical)
2. Information about the target business

Your job: produce a SINGLE HTML FILE that looks visually similar to the reference, but with all content replaced to match the target business.

Rules:
- Output ONLY the HTML. No markdown, no code fences, no explanation.
- Start with <!DOCTYPE html> and end with </html>.
- All CSS must be inline in a <style> tag in <head>. No external stylesheets.
- Copy the reference's visual structure: layout, color palette, typography hierarchy, section patterns.
- Replace ALL business-specific text (name, address, phone, services, testimonials, etc.) with the target's info.
- You MAY use Google Fonts via <link> in <head> if the reference's fonts match a common Google Font.
- You MAY reference images from the original reference site by their full URL (they'll hotlink). Do NOT invent image URLs.
- If the reference shows testimonials, generate 2-3 plausible placeholder testimonials for the target business — signed with first-name-last-initial style names.
- Keep the page mobile-responsive with media queries.
- Include a simple favicon via data URI if possible, else omit.
- No JavaScript unless absolutely necessary for layout.`

export async function cloneToHtml(
  screenshot: Buffer,
  business: BusinessInfo,
  referenceUrl: string
): Promise<string> {
  const userMessage = buildUserMessage(business, referenceUrl)
  const screenshotBase64 = screenshot.toString('base64')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: screenshotBase64 } },
        { type: 'text', text: userMessage },
      ],
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const html = extractHtml(text)
  if (!html || !html.includes('<!DOCTYPE html>')) {
    throw new Error('Claude returned invalid HTML')
  }
  return html
}

function buildUserMessage(b: BusinessInfo, referenceUrl: string): string {
  const activeSections = Object.entries(b.sections).filter(([, on]) => on).map(([k]) => k).join(', ')
  return `Reference URL (for image hotlinks): ${referenceUrl}

Target business info:
- Vertical: ${b.vertical}
- Name: ${b.name}
- Address: ${b.address}
- Phone: ${b.phone}
- Hours: ${b.hours}
${b.slogan ? `- Slogan: ${b.slogan}` : ''}
${b.anythingSpecial ? `- Notes: ${b.anythingSpecial}` : ''}
- Sections on: ${activeSections || '(landing only)'}

Generate the HTML now.`
}

function extractHtml(text: string): string {
  // Strip markdown fences if Claude ignored the instruction
  const fenceMatch = text.match(/```(?:html)?\s*([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()
  return text.trim()
}
```

**Model choice:** `claude-sonnet-4-5` is the right balance for Phase 4 — vision-capable, fast, cheap enough per build. Opus would be slower and 5x more expensive; Haiku would lose visual fidelity.

**Why extract HTML defensively:** Claude sometimes wraps output in ```html fences despite instructions. The regex catches that case.

### `engine/src/lib/netlify.ts`

```ts
import axios from 'axios'
import { nanoid } from 'nanoid'

const NETLIFY_API = 'https://api.netlify.com/api/v1'

export async function deployHtml(html: string, businessSlug: string): Promise<string> {
  const token = process.env.NETLIFY_AUTH_TOKEN
  if (!token) throw new Error('NETLIFY_AUTH_TOKEN not set')

  // Step 1: create site with random unique subdomain
  const suffix = nanoid(6).toLowerCase()
  const siteName = `vno-${businessSlug}-${suffix}`

  const createRes = await axios.post(
    `${NETLIFY_API}/sites`,
    { name: siteName },
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const site = createRes.data

  // Step 2: deploy the single HTML file
  // Netlify's file-digest API wants a SHA1 of each file
  const crypto = await import('crypto')
  const sha1 = crypto.createHash('sha1').update(html).digest('hex')

  const deployRes = await axios.post(
    `${NETLIFY_API}/sites/${site.id}/deploys`,
    { files: { '/index.html': sha1 } },
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const deploy = deployRes.data

  // Step 3: upload the file bytes
  await axios.put(
    `${NETLIFY_API}/deploys/${deploy.id}/files/index.html`,
    html,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
      },
    }
  )

  return `https://${site.name}.netlify.app`
}

export function slugify(businessName: string): string {
  return businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30) || 'site'
}
```

**Why this 3-step deploy:** Netlify's API requires creating a site, registering a deploy with file digests, then uploading the actual bytes. Not as simple as a drag-drop but fully automated.

**Unique URLs guaranteed:** `nanoid(6)` adds a random suffix to avoid collisions. `vno-toms-barbershop-kx9m2p.netlify.app` for Tom's, next build `vno-toms-barbershop-bq3nr1.netlify.app`.

### `engine/src/routes/build.ts` — rewrite

```ts
import { Request, Response } from 'express'
import { nanoid } from 'nanoid'
import { screenshotUrl } from '../lib/puppeteer.js'
import { cloneToHtml, BusinessInfo } from '../lib/cloner.js'
import { deployHtml, slugify } from '../lib/netlify.js'

export async function buildRoute(req: Request, res: Response) {
  const requestId = nanoid(8)
  const startTime = Date.now()

  console.log(`\n[${requestId}] POST /build`)
  console.log(`[${requestId}] vertical: ${req.body.vertical}`)
  console.log(`[${requestId}] business: ${req.body.business?.name}`)
  console.log(`[${requestId}] reference: ${req.body.reference?.url}`)

  try {
    // Validate
    if (!req.body.vertical) throw new Error('Missing vertical')
    if (!req.body.business?.name) throw new Error('Missing business.name')
    if (!req.body.reference?.url) throw new Error('Missing reference.url')

    // Step 1: screenshot
    console.log(`[${requestId}] → screenshotting ${req.body.reference.url}`)
    const screenshot = await screenshotUrl(req.body.reference.url)
    console.log(`[${requestId}] ✓ screenshot ${screenshot.length} bytes`)

    // Step 2: clone (with one retry)
    const business: BusinessInfo = {
      name: req.body.business.name,
      address: req.body.business.address ?? '',
      phone: req.body.business.phone ?? '',
      hours: req.body.business.hours ?? '',
      slogan: req.body.business.slogan,
      anythingSpecial: req.body.anythingSpecial,
      sections: req.body.sections ?? {},
      vertical: req.body.vertical,
    }

    console.log(`[${requestId}] → cloning...`)
    let html: string
    try {
      html = await cloneToHtml(screenshot, business, req.body.reference.url)
    } catch (err) {
      console.log(`[${requestId}] ⚠ clone failed, retrying once: ${err}`)
      html = await cloneToHtml(screenshot, business, req.body.reference.url)
    }
    console.log(`[${requestId}] ✓ html ${html.length} chars`)

    // Step 3: deploy
    const slug = slugify(business.name)
    console.log(`[${requestId}] → deploying as vno-${slug}-*`)
    const url = await deployHtml(html, slug)
    console.log(`[${requestId}] ✓ deployed to ${url}`)

    const buildTime = ((Date.now() - startTime) / 1000).toFixed(1)
    const response = { requestId, url, buildTime: Number(buildTime), phase: 4 }
    console.log(`[${requestId}] → returning ${JSON.stringify(response)}`)
    res.json(response)
  } catch (err) {
    const buildTime = ((Date.now() - startTime) / 1000).toFixed(1)
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.log(`[${requestId}] ✗ failed after ${buildTime}s: ${message}`)
    res.status(500).json({ requestId, error: message, phase: 4 })
  }
}
```

### `engine/.env` additions

```
NETLIFY_AUTH_TOKEN=<tristan's personal access token>
```

All existing values stay.

---

## App implementation details

### `app/src/lib/references.ts`

```ts
export interface Reference {
  url: string
  label: string
  thumbnailPath: string
  vibe: string
}

export const REFERENCES: Record<string, Reference[]> = {
  salon: [
    {
      url: 'https://serenityhairblaxland.com.au/',
      label: 'Serenity Hair',
      thumbnailPath: '/references/serenity-hair-salon.png',
      vibe: 'heritage',
    },
  ],
  barber: [],
  tattoo: [],
  groomer: [],
  trades: [],
  restaurant: [],
  gym: [],
  health: [],
  auto: [],
  daycare: [],
}

export function referencesFor(vertical: string | null): Reference[] {
  if (!vertical) return []
  return REFERENCES[vertical] ?? []
}
```

### `app/src/lib/store.ts` changes

Add to `QuizState`:
```ts
reference: { url: string; label: string } | null
setReference: (r: { url: string; label: string } | null) => void
```

Update `reset()` to clear reference. Update `partialize` in persist to include `reference`.

### `app/src/routes/Screen4Reference.tsx` — rewrite

Replace the static 3-tile vibe grid with:

```tsx
import { useQuiz } from '../lib/store'
import { referencesFor } from '../lib/references'
// ... existing imports ...

export function Screen4Reference() {
  const vertical = useQuiz((s) => s.vertical)
  const reference = useQuiz((s) => s.reference)
  const setReference = useQuiz((s) => s.setReference)
  const refs = referencesFor(vertical)

  if (refs.length === 0) {
    return (
      <PhoneShell>
        <Header label="Reference" progress="4 / 7" />
        <Title>No references yet for {vertical ?? 'this vertical'}</Title>
        <Subtitle>Skip this step — we'll seed more soon.</Subtitle>
        <SkipButton to="/quiz/5" />
      </PhoneShell>
    )
  }

  return (
    <PhoneShell>
      <Header label="Reference" progress="4 / 7" />
      <Title>Pick a direction</Title>
      <Subtitle>Tap the one that matches this business's vibe.</Subtitle>

      <Grid>
        {refs.map((r) => {
          const isSelected = reference?.url === r.url
          return (
            <Tile
              key={r.url}
              selected={isSelected}
              onClick={() => setReference({ url: r.url, label: r.label })}
            >
              <Thumbnail src={r.thumbnailPath} alt={r.label} />
              <TileLabel>{r.label}</TileLabel>
              <TileHost>{new URL(r.url).host}</TileHost>
            </Tile>
          )
        })}
      </Grid>

      <ContinueButton disabled={!useCanContinue(4)} to="/quiz/5" />
    </PhoneShell>
  )
}
```

Keep the existing visual vocabulary (dark background, white selection ring, 120ms transition). The thumbnail is an `<img>` with `object-fit: cover`, rounded corners matching tile radius, aspect ratio roughly 4:3.

### `app/public/references/serenity-hair-salon.png`

**Tristan drops this in manually before Cowork executes.** Any screenshot of the Serenity Hair homepage at reasonable resolution (800×600+) works. Already saved from browser — just drop it into the folder.

### `app/src/routes/Screen7Build.tsx` — small update

Expected build time now is ~3-5 minutes, not 2 seconds. Update the preview copy underneath the button:

```
Cloning the reference…
Injecting business info…
Generating HTML…
Deploying to Netlify…
Almost done…
```

These can swap every ~30 seconds as visual reassurance that work is happening, even though the engine doesn't emit granular progress. Phase 5 can wire real SSE progress if needed.

### `app/src/routes/Review.tsx` — small update

No logic change. The preview card no longer needs to say "maison-rose" — remove any hardcoded references to salon stub. The small preview card stays as a visual placeholder; Phase 5 can show an actual thumbnail of the generated site.

---

## Execution order for Cowork (12 steps)

Pause after each, summarize, wait for "continue."

- **Step 1:** Install new engine deps (`puppeteer`, `@anthropic-ai/sdk`, `axios`). Puppeteer pulls Chromium (~170MB) — takes a minute. Add to package.json.
- **Step 2:** Write `engine/src/lib/puppeteer.ts`. Smoke test: call `screenshotUrl('https://serenityhairblaxland.com.au/')` from a one-off script, write the buffer to `/tmp/test.png`, verify it looks like a salon homepage.
- **Step 3:** Write `engine/src/lib/cloner.ts`. Smoke test: feed the screenshot from Step 2 + a fake business ("Pharmacy Keith's" / fake address), confirm Claude returns HTML starting with `<!DOCTYPE html>`. Save to `/tmp/test-clone.html`, open in browser, eyeball it.
- **Step 4:** Write `engine/src/lib/netlify.ts`. Smoke test: deploy a trivial `<html><body>hello</body></html>` via the API, confirm the returned URL serves that HTML.
- **Step 5:** Write `engine/src/references/library.json` with the salon seed.
- **Step 6:** Rewrite `engine/src/routes/build.ts` to the real pipeline (screenshot → clone → deploy, with one retry on clone). Verify `POST /build` end-to-end with curl/Postman using the full real flow before touching the app.
- **Step 7:** App — add `src/lib/references.ts` matching the engine's library.json.
- **Step 8:** App — update `src/lib/store.ts` to add `reference` field + setter, update partialize, update reset.
- **Step 9:** App — update `src/lib/validation.ts` so `useCanContinue(4)` checks `reference !== null` instead of `vibe !== null`.
- **Step 10:** App — rewrite `Screen4Reference.tsx` per spec (dynamic tiles, empty state, thumbnail loading).
- **Step 11:** App — minor Screen7Build copy update for the longer build time.
- **Step 12:** Verify `npm run build` in `app/` succeeds cleanly. Produce a Phase 4 handoff document describing what Tristan does to test end-to-end.

---

## Phase 4 is done when

Tristan, running against the real engine + tunnel:

1. `cd D:\vno\engine && npm start` — engine starts with new env vars loaded, no errors
2. `cloudflared tunnel --url http://localhost:3000` — tunnel up, URL copied
3. App `.env` updated with new tunnel URL, rebuilt via `npm run build`, dragged to Netlify `vnodash` site
4. `app/public/references/serenity-hair-salon.png` saved before build
5. Phone PWA reloaded
6. Screen 1: pick Salon
7. Screen 2: real business info (e.g., "Pharmacy Keith's" / real-ish address / phone / hours)
8. Screen 3: default sections
9. Screen 4: **one tile visible** (Serenity Hair). Tap it. Continue enables.
10. Screen 5: upload a logo image (any)
11. Screen 6: type something or skip
12. Screen 7: tap Build. Progress preview rotates through the 5 status lines over ~3-5 minutes.
13. Engine log shows: POST, screenshot N bytes, cloning, deploying, returning {url: vno-pharmacy-keiths-XXXXXX.netlify.app, buildTime: ~180s}
14. Phone lands on /review with the real new URL and real business name
15. Hand to client → DND → Preview Mode loads the generated site chrome-free
16. The loaded site shows "Pharmacy Keith's" (not "Serenity Hair") as the business name, with the address/phone/hours Tristan typed
17. Triple-tap top-right returns to /quiz/1

Any step that fails = not done.

---

## Known trade-offs (be honest about these)

- **Builds take 2-5 minutes.** Real work: Puppeteer launch + navigate + screenshot (15-30s), Claude vision call (20-60s depending on load), Netlify API dance (10-20s). Your pre-pitch verification workflow expects this.
- **Per-build cost ~$0.10.** Tracked manually via provider dashboards (no engine-side cap). Set alert at $10/day on Anthropic dashboard tonight.
- **Hotlinked images.** The cloned site references Serenity Hair's image URLs directly. If Serenity Hair changes their CDN or deletes images, old cloned sites break. Acceptable for demos — the prospect is looking at the phone, not auditing image hosting.
- **No CSS purity.** Claude's generated HTML won't match the reference pixel-perfect. It'll match "vibe + structure." That's what we want for pitches — looks professional, is clearly custom-feeling, not mistakeable for a template.
- **Single seed entry.** Only salon works. Every other vertical shows empty state. Expanding the library is manual and deliberate — Phase 5.
- **No progress streaming.** Phone shows rotating placeholder copy, not real-time engine status. Phase 5 can add SSE if the build time feels too opaque.
- **Netlify site count grows.** Every build creates a new Netlify site. Free tier allows hundreds; cleanup is Phase 5+ (daily script to delete sites older than 30 days).

---

## What Phase 5 will add

- Library expansion — 3-5 entries per vertical, manually curated
- Vibe filtering within a vertical (uses the dead `vibe` field from the store)
- fal.ai hero image generation (replaces hotlinked reference images)
- Real-time build progress (SSE from engine to phone)
- Logo injection (Phase 4 ignores the uploaded logo; Phase 5 embeds it in the generated HTML)
- Named Cloudflare Tunnel (stable URL across sessions)
- Netlify site cleanup cron

---

End of Phase 4 spec.
