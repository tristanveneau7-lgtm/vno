# VNO — Phase 3: Backend Wiring

**One-sentence goal:** Connect the PWA on your phone to an Express server on your home PC via Cloudflare Tunnel, so tapping "Build the site" actually makes a network request — even if the server's response is still hardcoded.

**What this is NOT:** Still no real cloner. Still no fal.ai. Still no Anthropic API calls. The server receives the full quiz payload, logs it, and returns a hardcoded URL pointing to the same placeholder salon site. The point of Phase 3 is to prove the *wire works*, not what flows through it. That's Phase 4.

**When Phase 3 is done:** Tristan opens the PWA on his phone from anywhere, taps through the quiz, hits Build, and watches the request land in the Express server console on his home PC. Then the phone displays the returned URL and Preview Mode loads it.

---

## Prerequisites

**All must be true before Cowork starts:**

1. Phases 1 and 2 are shipped, committed, pushed to GitHub.
2. `D:\vno\app\` exists and builds cleanly via `npm run build`.
3. `cloudflared` is installed on the home PC and `cloudflared --version` works in PowerShell.
4. There is NO existing `D:\vno\engine\` folder yet. (If there is from earlier experiments, delete it.)

## Reference files (read first)

- **`PHASE_1_STATIC_MOCKUP.md`** and **`PHASE_2_FORM_STATE.md`** — prior phase specs for context.
- **`VNO_V3_LOCKED_DECISIONS.md`** — section 3 defines the transport choice. Follow it exactly.

---

## Architecture recap (what we're building)

```
Phone (VNO PWA on Netlify)
  ↓ HTTPS POST /build  { verticalSlug, business, sections, vibe, assets, anythingSpecial }
  ↓
Cloudflare Quick Tunnel  (*.trycloudflare.com)
  ↓
Home PC Express server at http://localhost:3000
  ↓ logs the payload, simulates build (2s delay)
  ↓ returns { url, buildTime, requestId }
  ↓
PWA navigates to /review, which shows the URL + business name
```

Nothing in the pipeline generates real content yet. Phase 4 swaps the stub for real work.

---

## What gets built

### 1. The engine (new)

`D:\vno\engine\` — brand new Node + Express project, completely separate from `D:\vno\app\`. Runs on the home PC. Never deployed anywhere.

```
D:\vno\engine\
├── src\
│   ├── server.ts         # Express setup, CORS, routes
│   └── routes\
│       └── build.ts      # POST /build — logs payload, returns stub
├── package.json
├── tsconfig.json
├── .env                  # user-filled with real keys (never committed)
├── .env.example          # template
├── .gitignore            # node_modules, .env, etc.
└── README.md             # run + tunnel instructions
```

**Dependencies to install:**
- `express` (HTTP server)
- `cors` (allow requests from Netlify origin)
- `dotenv` (load .env)
- `nanoid` (generate requestIds)

**Dev deps:**
- `typescript`
- `tsx` (TypeScript runner — fast, no build step)
- `@types/express`, `@types/cors`, `@types/node`

### 2. PWA changes (additive)

`D:\vno\app\` gets three small additions — nothing in Phases 1 or 2 changes behavior:

- `src/lib/api.ts` — new file. Exports `postBuild(payload)` that `fetch`es the engine.
- `src/lib/env.ts` — new file. Reads `VITE_ENGINE_URL` from `.env`, falls back to a safe default.
- `Screen7Build.tsx` — updated. The setTimeout fake delay gets replaced with a real `await postBuild(...)` call that constructs the payload from the store. On success → `/review`. On error → show an inline error + "Try again" button.
- `Review.tsx` — updated. Reads `buildTime` and `url` from navigation state instead of hardcoding.

Also:
- Persist the store to localStorage so a refresh doesn't wipe the quiz mid-flight. Zustand has a `persist` middleware — use it.

### 3. A .env.example in the app

`D:\vno\app\.env.example` (new):
```
VITE_ENGINE_URL=https://your-cloudflare-tunnel-url.trycloudflare.com
```

Tristan will create `.env` locally by copying this and pasting the real tunnel URL.

---

## Engine implementation

### `engine/src/server.ts`

```ts
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { buildRoute } from './routes/build'

dotenv.config()

const app = express()
const PORT = Number(process.env.PORT) || 3000

app.use(cors({ origin: true, credentials: false }))
app.use(express.json({ limit: '10mb' }))

app.get('/health', (_req, res) => res.json({ ok: true, service: 'vno-engine', phase: 3 }))
app.post('/build', buildRoute)

app.listen(PORT, () => {
  console.log(`[vno-engine] listening on http://localhost:${PORT}`)
  console.log(`[vno-engine] expose via: cloudflared tunnel --url http://localhost:${PORT}`)
})
```

**Notes:**
- `10mb` body limit so logo+photo base64 data URLs fit.
- `cors({ origin: true })` reflects the request origin — safe because this server has no secrets and only does stub work. Lock it down in a later phase.
- No auth yet. Phase 3 is a demo server. Authentication lands when the cloner actually costs money to run.

### `engine/src/routes/build.ts`

```ts
import { Request, Response } from 'express'
import { nanoid } from 'nanoid'

const STUB_SITE_URL = process.env.STUB_SITE_URL || 'https://maison-rose-7a3f.netlify.app'
const SIMULATED_BUILD_MS = 2000

export async function buildRoute(req: Request, res: Response) {
  const requestId = nanoid(8)
  const startTime = Date.now()

  console.log(`\n[${requestId}] POST /build`)
  console.log(`[${requestId}] vertical: ${req.body.vertical ?? '(none)'}`)
  console.log(`[${requestId}] business: ${req.body.business?.name ?? '(none)'}`)
  console.log(`[${requestId}] vibe: ${req.body.vibe ?? '(none)'}`)
  console.log(`[${requestId}] sections:`, req.body.sections)
  console.log(`[${requestId}] has logo: ${!!req.body.assets?.logoDataUrl}`)
  console.log(`[${requestId}] anything special: ${req.body.anythingSpecial?.slice(0, 60) ?? '(none)'}`)
  console.log(`[${requestId}] payload size: ${JSON.stringify(req.body).length} bytes`)

  await new Promise(r => setTimeout(r, SIMULATED_BUILD_MS))

  const buildTime = ((Date.now() - startTime) / 1000).toFixed(1)
  const response = {
    requestId,
    url: STUB_SITE_URL,
    buildTime: Number(buildTime),
    phase: 3,
  }

  console.log(`[${requestId}] → returning ${JSON.stringify(response)}`)
  res.json(response)
}
```

**Why this design:**
- Every request gets a `requestId` so logs stay traceable when Tristan is pitching fast and multiple requests come in back-to-back.
- The 2-second simulated delay mimics the real build time feel without actually doing any work.
- `STUB_SITE_URL` comes from the env so Tristan can swap it later.

### `engine/package.json` scripts

```json
{
  "name": "vno-engine",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "start": "tsx src/server.ts",
    "dev": "tsx watch src/server.ts"
  }
}
```

### `engine/tsconfig.json`

Standard Node + ESM setup. Cowork knows the shape. Don't over-engineer this.

### `engine/.env.example`

```
PORT=3000
STUB_SITE_URL=https://maison-rose-7a3f.netlify.app
ANTHROPIC_API_KEY=
FAL_KEY=
```

Last two are empty placeholders — not used in Phase 3, ready for Phase 4.

### `engine/.gitignore`

```
node_modules/
.env
*.log
dist/
```

### `engine/README.md`

Concise. How to run + how to tunnel + how to test.

---

## App changes

### `app/src/lib/env.ts`

```ts
export const ENGINE_URL = import.meta.env.VITE_ENGINE_URL as string | undefined

export function assertEngineConfigured() {
  if (!ENGINE_URL) {
    throw new Error('VITE_ENGINE_URL is not set. Create app/.env with your Cloudflare Tunnel URL.')
  }
  return ENGINE_URL
}
```

### `app/src/lib/api.ts`

```ts
import { assertEngineConfigured } from './env'
import type { QuizState } from './store'

export interface BuildPayload {
  vertical: QuizState['vertical']
  business: QuizState['business']
  sections: QuizState['sections']
  vibe: QuizState['vibe']
  assets: QuizState['assets']
  anythingSpecial: QuizState['anythingSpecial']
}

export interface BuildResponse {
  requestId: string
  url: string
  buildTime: number
  phase: number
}

export async function postBuild(payload: BuildPayload): Promise<BuildResponse> {
  const engine = assertEngineConfigured()
  const res = await fetch(`${engine}/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(`Build failed: ${res.status} ${res.statusText}`)
  }
  return res.json()
}
```

### `app/src/lib/store.ts` — add persistence

Wrap the `create(...)` call with Zustand's `persist` middleware:

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ... existing types ...

export const useQuiz = create<QuizState>()(
  persist(
    (set) => ({
      // ... existing implementation exactly as Phase 2 ...
    }),
    {
      name: 'vno-quiz',
      // partialize out the assets — base64 images can blow past localStorage quotas
      partialize: (state) => ({
        vertical: state.vertical,
        business: state.business,
        sections: state.sections,
        vibe: state.vibe,
        anythingSpecial: state.anythingSpecial,
      }),
    }
  )
)
```

**Why partialize:** base64 data URLs for photos can easily exceed 5MB, and localStorage has a ~10MB quota on most browsers. If we persist those, the first big upload breaks the store. Text fields only — logos reload on refresh, which is acceptable UX (you just re-pick the image).

### `app/src/routes/Screen7Build.tsx` — call the real API

Replace the existing setTimeout flow with:

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuiz } from '../lib/store'
import { postBuild } from '../lib/api'
// ... existing imports ...

export function Screen7Build() {
  const navigate = useNavigate()
  const state = useQuiz()
  const [status, setStatus] = useState<'idle' | 'building' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleBuild = async () => {
    setStatus('building')
    setErrorMsg(null)
    try {
      const result = await postBuild({
        vertical: state.vertical,
        business: state.business,
        sections: state.sections,
        vibe: state.vibe,
        assets: state.assets,
        anythingSpecial: state.anythingSpecial,
      })
      navigate('/review', { state: { url: result.url, buildTime: result.buildTime, requestId: result.requestId } })
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  // ... render existing Screen 7 UI with:
  // - Big button: label swaps between "Build the site →" (idle) / "Building…" (building) / "Try again" (error)
  // - Below the status preview panel: if status === 'error', show errorMsg in a small red line
  // - button's onClick = handleBuild
}
```

Match the existing visual — the only real UX additions are the error state display and the "Try again" label. Keep the 5-line "Building · preview" panel as is.

### `app/src/routes/Review.tsx` — read from navigation state

The Review screen receives `{ url, buildTime, requestId }` via `useLocation().state`. Update the display:

```tsx
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuiz } from '../lib/store'

export function Review() {
  const navigate = useNavigate()
  const businessName = useQuiz((s) => s.business.name.trim() || 'Your business')
  const { state } = useLocation() as { state?: { url: string; buildTime: number; requestId: string } }

  if (!state) {
    // Direct navigation to /review without state (refresh, bookmark) → send back to start
    navigate('/quiz/1', { replace: true })
    return null
  }

  // ... render with state.url as the domain strip instead of the hardcoded maison-rose-7a3f
  // ... "Built in {state.buildTime}s. Looks good?" as the subtitle
  // ... Hand to client → navigates to /dnd with state forwarded:
  //     navigate('/dnd', { state: { url: state.url } })
}
```

### `app/src/routes/DndCheck.tsx` and `app/src/routes/Preview.tsx`

Forward the `url` through navigation state so Preview loads the real URL from the engine, not the hardcoded one in the route param.

- DndCheck: on "Enter Preview Mode" click, do `navigate('/preview', { state: { url } })` (was `navigate('/preview/${url}')`).
- Preview: read url from `useLocation().state.url` instead of `useParams().url`. Update the route definition in `App.tsx` to `/preview` (no param).

---

## Execution order for Cowork (9 steps)

Pause after each, summarize, wait for "continue."

- **Step 1:** Create `D:\vno\engine\`. Initialize package.json, install deps. Write tsconfig.json and .gitignore.
- **Step 2:** Write `src/server.ts`, `src/routes/build.ts`, `.env.example`, `README.md`. Confirm `npm start` boots cleanly and `GET /health` returns `{ ok: true }`.
- **Step 3:** In the app, write `src/lib/env.ts` and `src/lib/api.ts`. Add `.env.example` to `app/`. Don't wire them up yet — just the files.
- **Step 4:** Update `app/src/lib/store.ts` with Zustand `persist` middleware, partializing out assets. Confirm store still compiles.
- **Step 5:** Update `Screen7Build.tsx` to call `postBuild` with loading/error states. Handle the error path (show message, allow retry).
- **Step 6:** Update `Review.tsx` to read url/buildTime from navigation state, redirect to /quiz/1 if state is missing.
- **Step 7:** Update DndCheck + Preview + App router to forward the url through navigation state instead of URL param. Verify triple-tap exit still works.
- **Step 8:** Run `npm run build` in `app/`. Confirm it succeeds. Do NOT try to run the engine — Tristan runs it manually on his PC.
- **Step 9:** Produce a final "Phase 3 handoff" summary: what Tristan does to test the circuit end-to-end (start engine, start tunnel, paste URL in `.env`, rebuild, redeploy, phone test).

---

## Phase 3 is done when

Tristan (running on his own PC, not in the sandbox):

1. In one PowerShell: `cd D:\vno\engine && npm install && npm start` → server prints `[vno-engine] listening on http://localhost:3000`.
2. In a second PowerShell: `cloudflared tunnel --url http://localhost:3000` → prints a `https://*.trycloudflare.com` URL.
3. Copies that URL into `D:\vno\app\.env` as `VITE_ENGINE_URL=https://...`.
4. `cd D:\vno\app && npm run build` → succeeds.
5. Drags `D:\vno\app\dist\` to Netlify → deploys.
6. Opens the PWA on his phone, taps through the quiz with real inputs.
7. Taps Build → sees "Building…" for ~2 seconds.
8. Looks at his home PC's first PowerShell window → sees the request logged: `[abc12345] POST /build`, vertical, business name, vibe, sections, payload size.
9. Phone lands on /review, showing his typed business name + "Built in 2.0s" + a small preview card.
10. Hand to client → DND check → Preview Mode → the returned URL (still the placeholder salon site) loads chrome-free.
11. Triple-tap top-right → back to /quiz/1.

If any of those 11 fail, Phase 3 isn't done.

---

## Known trade-offs and non-issues

- **The Cloudflare quick tunnel URL changes every time you restart `cloudflared`.** That means each session you have to paste a new URL into `.env` and redeploy. This is annoying but acceptable for Phase 3 — it's a dev setup. Phase 5 upgrades to a named tunnel with a stable URL.
- **No retries on the PWA side.** If a build request fails, the user taps "Try again" — that's the retry. No exponential backoff, no request queue. Fine for a live pitch; the user always knows what's happening.
- **Logo and photos are NOT sent over the wire in Phase 3.** They'd fit in the 10MB body limit, but there's no reason to send them until Phase 4 uses them. The payload includes the assets object (with data URLs) for consistency, but the server just logs `has logo: true/false` and doesn't persist or use them.
- **Localhost on a phone over Wi-Fi won't work.** Tristan's phone goes through the Cloudflare Tunnel, which reaches his PC from anywhere — no same-network requirement. Phone can be on cellular or any Wi-Fi.

---

## What Phase 4 will add

- Real cloner: abi/screenshot-to-code processes a hardcoded reference URL at build time.
- Anthropic API call from the engine to inject business info into the cloned HTML.
- fal.ai for the hero image.
- Netlify deploy step — each build produces a new unique site URL.
- Reference library stub (`references/library.json` gets one real entry for testing).

Phase 3 is the wiring. Phase 4 makes the wiring carry real signal.

---

End of Phase 3 spec.
