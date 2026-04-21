# VNO v3 — Day 1 Build Spec

**Audience:** Cowork (Claude Code in agent mode)
**Operator:** Tristan (Windows / PowerShell / D: drive)
**Estimated Cowork time:** 4–6 hours of agent work

---

## Goal

Wire the full VNO circuit end-to-end with stubs. By the end of Day 1, the kitchen demo (defined at the bottom of this doc) must pass. We are NOT building the real product today. We are proving the pipes connect. Real screens, real engine, real cloner all come Day 2 onward.

The non-negotiable: by end of day, Tristan can stand in his kitchen with his phone, tap through a deployed PWA, hit Build, get a URL back from his home PC via Cloudflare Tunnel, and see that URL render chrome-free in Preview Mode. If any step in that chain is broken, Day 1 is not done.

---

## Out of scope for Day 1

If Cowork finds itself building any of the following, **stop and check the spec.** These belong to Day 2+:

- Real form state (the quiz screens are stubs — just header + title + Continue)
- Any real input handling (no text fields, no file uploads, no toggles)
- The `/quiz` flow's actual UX from the locked mocks (those come Day 2)
- The build engine's actual pipeline (no screenshot-to-code, no fal.ai, no Claude API calls, no Netlify deploy from the engine)
- Library file population (`library.json` stays empty `[]`)
- The cloner (defer entirely to Day 4)
- The Pitch Black design system being applied across the *content* of stubs (the header chrome uses tokens; stub screens are minimal)
- Multi-environment configs, CI/CD beyond Netlify auto-deploy on push, tests beyond a smoke test

---

## Tristan handles these BEFORE Cowork starts

These are signup / auth / OS-level things Cowork can't do for him. Estimated 30 minutes total.

1. **Create folder and git repo.** From PowerShell:
   ```powershell
   mkdir D:\vno
   cd D:\vno
   git init
   ```
   Create a private GitHub repo (e.g., `tristan/vno`), then:
   ```powershell
   git remote add origin https://github.com/tristan/vno.git
   ```

2. **Netlify account.** Sign up at netlify.com if needed. Connect GitHub. We will create the site via the dashboard once the app folder exists. Do NOT use the Netlify CLI for Day 1 — the dashboard's "Import from Git" is faster and gives you the auth token automatically.

3. **Cloudflare Tunnel installed.** Download `cloudflared` for Windows from cloudflare.com/products/tunnel. Test with:
   ```powershell
   cloudflared tunnel --url http://localhost:3000
   ```
   You should see output like `Your quick Tunnel has been created! Visit it at: https://weird-words-1234.trycloudflare.com`. Copy that URL — you'll need it later. Stop the tunnel for now (Ctrl+C).

4. **Anthropic API key.** Get from console.anthropic.com. Paste into `D:\vno\engine\.env` as `ANTHROPIC_API_KEY=sk-ant-...` (Cowork will create the engine folder; just have the key ready in a notepad).

5. **fal.ai API key.** Get from fal.ai. Have it ready as `FAL_KEY=...`. Not used Day 1 but ready to drop in.

When all five are done, Tristan opens Cowork from `D:\vno\` and pastes this spec. Cowork takes over.

---

## Final folder structure to produce

```
D:\vno\
├── app\                            # the PWA
│   ├── public\
│   │   ├── icon-192.png            # placeholder VNO icon
│   │   ├── icon-512.png            # placeholder VNO icon
│   │   └── manifest.webmanifest
│   ├── src\
│   │   ├── components\
│   │   │   ├── Header.tsx          # VNO wordmark + step indicator
│   │   │   ├── ContinueButton.tsx  # white pill, black text
│   │   │   └── PhoneShell.tsx      # the dark screen wrapper
│   │   ├── routes\
│   │   │   ├── Quiz.tsx            # generic quiz screen, takes step number
│   │   │   ├── Review.tsx          # post-build review screen
│   │   │   └── Preview.tsx         # chrome-free preview iframe
│   │   ├── lib\
│   │   │   ├── tokens.ts           # Pitch Black design tokens (see below)
│   │   │   └── api.ts              # POST to /build, returns URL
│   │   ├── App.tsx                 # router setup
│   │   └── main.tsx                # entry
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── vite.config.ts
│   ├── .env.example                # VITE_ENGINE_URL=...
│   └── .gitignore
│
├── engine\                         # the build server
│   ├── src\
│   │   ├── server.ts               # Express setup
│   │   └── routes\
│   │       └── build.ts            # POST /build → hardcoded response
│   ├── package.json
│   ├── tsconfig.json
│   ├── README.md                   # how to run + how to tunnel
│   ├── .env                        # ANTHROPIC_API_KEY=..., FAL_KEY=...
│   ├── .env.example
│   └── .gitignore
│
├── stub-site\                      # static demo site for Day 1 only
│   └── index.html                  # the salon site Preview Mode loads
│
├── references\
│   └── library.json                # `[]` — populated Day 4+
│
├── .gitignore                      # root gitignore
└── README.md                       # repo overview, links to engine README
```

Three Netlify sites get created (all auto-deployed from this repo via separate publish directories):
- **vno-app** — publishes from `app/dist` (the PWA Tristan installs)
- **vno-stub-site** — publishes from `stub-site` (the demo salon site Day 1's engine returns)
- (no Netlify site for `engine` — it runs on the home PC)

---

## Step 1 — Scaffold the app

```powershell
cd D:\vno
npm create vite@latest app -- --template react-ts
cd app
npm install
npm install -D tailwindcss postcss autoprefixer vite-plugin-pwa
npx tailwindcss init -p
npm install react-router-dom
```

Configure Tailwind in `tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss'
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config
```

Add to `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
html, body, #root { height: 100%; background: #0A0A0A; color: #F5F5F5; }
body { font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; margin: 0; }
```

Configure `vite.config.ts` with PWA plugin:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'VNO',
        short_name: 'VNO',
        description: 'Pitch-ready websites in 60 seconds',
        theme_color: '#0A0A0A',
        background_color: '#0A0A0A',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ]
})
```

Generate placeholder PWA icons (192x192 and 512x512) — solid black squares with a white "V" centered, sans-serif, 50% of the icon height. Save as `public/icon-192.png` and `public/icon-512.png`.

Create `.env.example`:
```
VITE_ENGINE_URL=https://your-tunnel-url.trycloudflare.com
```

Tristan will create the actual `.env` once the tunnel is running.

---

## Step 2 — Pitch Black design tokens

Create `src/lib/tokens.ts` with the exact values used in the locked mocks. These are the source of truth — every component pulls from here, no hex literals in components.

```ts
export const tokens = {
  bg: '#0A0A0A',
  surface: '#161616',
  border: '#262626',
  textPrimary: '#F5F5F5',
  textSecondary: '#888888',
  textTertiary: '#666666',
  accent: '#FFFFFF',
  accentText: '#0A0A0A',

  radius: {
    button: '6px',
    card: '8px',
    container: '12px',
  },

  font: {
    wordmark: { size: '12px', weight: 500, letterSpacing: '0.18em' },
    step: { size: '11px', color: '#666666' },
    title: { size: '20px', weight: 500, letterSpacing: '-0.01em' },
    subtitle: { size: '12px', color: '#888888' },
    body: { size: '14px' },
    fieldLabel: { size: '11px', color: '#666666', letterSpacing: '0.05em', textTransform: 'uppercase' as const },
  },

  spacing: {
    screenPadding: '22px 18px',
    sectionGap: '14px',
    headerMarginBottom: '24px',
  },
} as const
```

---

## Step 3 — Shared components

`src/components/Header.tsx` — the VNO wordmark + step indicator at the top of every quiz screen:
```tsx
import { tokens } from '../lib/tokens'

export function Header({ step, total = 7 }: { step: number; total?: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.spacing.headerMarginBottom }}>
      <span style={{ fontSize: tokens.font.wordmark.size, letterSpacing: tokens.font.wordmark.letterSpacing, fontWeight: tokens.font.wordmark.weight }}>VNO</span>
      <span style={{ fontSize: tokens.font.step.size, color: tokens.font.step.color }}>{step} / {total}</span>
    </div>
  )
}
```

`src/components/ContinueButton.tsx` — the white pill with black text. Accepts label and onClick.
```tsx
import { tokens } from '../lib/tokens'

export function ContinueButton({ label = 'Continue', onClick }: { label?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '13px',
        background: tokens.accent,
        color: tokens.accentText,
        border: 'none',
        fontSize: '13px',
        fontWeight: 500,
        borderRadius: tokens.radius.button,
        cursor: 'pointer',
        marginTop: '22px',
      }}
    >
      {label}
    </button>
  )
}
```

`src/components/PhoneShell.tsx` — wraps quiz screens with the dark frame. Centered on desktop, fills viewport on mobile.
```tsx
import { tokens } from '../lib/tokens'
import { ReactNode } from 'react'

export function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: tokens.bg, color: tokens.textPrimary, padding: tokens.spacing.screenPadding, maxWidth: '480px', margin: '0 auto', boxSizing: 'border-box' }}>
      {children}
    </div>
  )
}
```

---

## Step 4 — Quiz screen stubs

`src/routes/Quiz.tsx` — generic stub that reads the step number from the URL and shows a placeholder:

```tsx
import { useParams, useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { ContinueButton } from '../components/ContinueButton'
import { PhoneShell } from '../components/PhoneShell'
import { tokens } from '../lib/tokens'
import { postBuild } from '../lib/api'
import { useState } from 'react'

const STUB_TITLES: Record<string, string> = {
  '1': 'Pick the vertical',
  '2': 'Tell us about them',
  '3': 'Pick the sections',
  '4': 'Pick the vibe',
  '5': 'Upload assets',
  '6': 'Anything special?',
  '7': 'Ready to build',
}

export function Quiz() {
  const { step } = useParams()
  const navigate = useNavigate()
  const [building, setBuilding] = useState(false)

  const handleContinue = async () => {
    if (step === '7') {
      setBuilding(true)
      const result = await postBuild({ stub: true })
      navigate('/review', { state: result })
    } else {
      navigate(`/quiz/${Number(step) + 1}`)
    }
  }

  return (
    <PhoneShell>
      <Header step={Number(step)} />
      <div style={{ fontSize: tokens.font.title.size, fontWeight: tokens.font.title.weight, letterSpacing: tokens.font.title.letterSpacing }}>
        {STUB_TITLES[step ?? '1']}
      </div>
      <p style={{ fontSize: tokens.font.subtitle.size, color: tokens.font.subtitle.color, marginTop: '4px' }}>
        Stub for Day 1. Real screen lands Day 2.
      </p>
      <ContinueButton
        label={step === '7' ? (building ? 'Building…' : 'Build the site →') : 'Continue'}
        onClick={handleContinue}
      />
    </PhoneShell>
  )
}
```

---

## Step 5 — API helper

`src/lib/api.ts`:
```ts
const ENGINE = import.meta.env.VITE_ENGINE_URL

export async function postBuild(payload: any): Promise<{ url: string; buildTime: number }> {
  const res = await fetch(`${ENGINE}/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Build failed: ${res.status}`)
  return res.json()
}
```

---

## Step 6 — Review and Preview routes

`src/routes/Review.tsx` — the post-build screen with three actions. Shows the URL in a small preview iframe:

```tsx
import { useLocation, useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { PhoneShell } from '../components/PhoneShell'
import { tokens } from '../lib/tokens'

export function Review() {
  const navigate = useNavigate()
  const { state } = useLocation() as { state: { url: string; buildTime: number } }
  if (!state) { navigate('/quiz/1'); return null }

  return (
    <PhoneShell>
      <Header step={0} total={7} />
      <div style={{ fontSize: tokens.font.title.size, fontWeight: 500 }}>Stub Business</div>
      <p style={{ fontSize: tokens.font.subtitle.size, color: tokens.font.subtitle.color, marginTop: '4px' }}>
        Built in {state.buildTime}s. Looks good?
      </p>
      <div style={{ background: tokens.surface, border: `0.5px solid ${tokens.border}`, borderRadius: tokens.radius.card, padding: '10px', marginTop: '14px' }}>
        <iframe src={state.url} style={{ width: '100%', height: '180px', border: 'none', borderRadius: '4px' }} />
        <div style={{ fontSize: '11px', color: tokens.textSecondary, marginTop: '8px' }}>{state.url}</div>
      </div>
      <button
        onClick={() => navigate(`/preview/${encodeURIComponent(state.url)}`)}
        style={{ width: '100%', padding: '14px', background: tokens.accent, color: tokens.accentText, border: 'none', fontSize: '14px', fontWeight: 500, borderRadius: tokens.radius.button, marginTop: '14px', cursor: 'pointer' }}
      >
        Hand to client →
      </button>
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <button
          onClick={() => navigate('/quiz/1')}
          style={{ flex: 1, padding: '11px', background: tokens.surface, border: `0.5px solid ${tokens.border}`, color: tokens.textPrimary, fontSize: '12px', borderRadius: tokens.radius.button, cursor: 'pointer' }}
        >
          Re-clone
        </button>
        <button
          onClick={() => navigate('/quiz/1')}
          style={{ flex: 1, padding: '11px', background: tokens.surface, border: `0.5px solid ${tokens.border}`, color: tokens.textPrimary, fontSize: '12px', borderRadius: tokens.radius.button, cursor: 'pointer' }}
        >
          Edit inputs
        </button>
      </div>
    </PhoneShell>
  )
}
```

`src/routes/Preview.tsx` — DND check overlay first, then the chrome-free iframe with triple-tap-corner exit:

```tsx
import { useParams, useNavigate } from 'react-router-dom'
import { useState, useRef } from 'react'
import { tokens } from '../lib/tokens'

export function Preview() {
  const { url } = useParams()
  const navigate = useNavigate()
  const [confirmed, setConfirmed] = useState(false)
  const [dndChecked, setDndChecked] = useState(false)
  const tapTimes = useRef<number[]>([])
  const decoded = decodeURIComponent(url ?? '')

  const handleCornerTap = () => {
    const now = Date.now()
    tapTimes.current = [...tapTimes.current.filter(t => now - t < 1000), now]
    if (tapTimes.current.length >= 3) {
      tapTimes.current = []
      navigate('/quiz/1')
    }
  }

  if (!confirmed) {
    return (
      <div style={{ minHeight: '100vh', background: tokens.bg, color: tokens.textPrimary, padding: tokens.spacing.screenPadding, maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center', padding: '24px 8px' }}>
          <div style={{ fontSize: '22px', fontWeight: 500, letterSpacing: '-0.01em', marginBottom: '8px' }}>One last thing</div>
          <p style={{ fontSize: '13px', color: tokens.textSecondary, lineHeight: 1.5 }}>
            Silence the phone before handing over.<br/>Notifications kill the moment.
          </p>
        </div>
        <label style={{ background: tokens.surface, border: `0.5px solid ${tokens.border}`, borderRadius: tokens.radius.card, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
          <input type="checkbox" checked={dndChecked} onChange={e => setDndChecked(e.target.checked)} />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 500 }}>Do Not Disturb is on</div>
            <div style={{ fontSize: '11px', color: tokens.textSecondary, marginTop: '2px' }}>Swipe from top-right to toggle</div>
          </div>
        </label>
        <button
          disabled={!dndChecked}
          onClick={() => setConfirmed(true)}
          style={{ width: '100%', padding: '14px', background: tokens.accent, color: tokens.accentText, border: 'none', fontSize: '14px', fontWeight: 500, borderRadius: tokens.radius.button, marginTop: '14px', cursor: dndChecked ? 'pointer' : 'not-allowed', opacity: dndChecked ? 1 : 0.4 }}
        >
          Enter Preview Mode
        </button>
        <p style={{ textAlign: 'center', fontSize: '11px', color: tokens.textTertiary, marginTop: '12px' }}>Triple-tap top corner to exit later</p>
      </div>
    )
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
      <iframe src={decoded} style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} />
      <div
        onClick={handleCornerTap}
        style={{ position: 'absolute', top: 0, right: 0, width: '60px', height: '60px', cursor: 'pointer' }}
        aria-label="Exit preview"
      />
    </div>
  )
}
```

---

## Step 7 — Wire the router

`src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Quiz } from './routes/Quiz'
import { Review } from './routes/Review'
import { Preview } from './routes/Preview'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/quiz/1" />} />
        <Route path="/quiz/:step" element={<Quiz />} />
        <Route path="/review" element={<Review />} />
        <Route path="/preview/:url" element={<Preview />} />
      </Routes>
    </BrowserRouter>
  )
}
```

---

## Step 8 — Scaffold the engine

```powershell
cd D:\vno
mkdir engine
cd engine
npm init -y
npm install express cors dotenv
npm install -D typescript @types/express @types/node @types/cors tsx
npx tsc --init
```

`engine/src/server.ts`:
```ts
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { buildRoute } from './routes/build'

dotenv.config()
const app = express()
app.use(cors())
app.use(express.json())
app.post('/build', buildRoute)
app.get('/health', (_, res) => res.json({ ok: true }))

const port = process.env.PORT || 3000
app.listen(port, () => console.log(`VNO engine listening on :${port}`))
```

`engine/src/routes/build.ts` — the Day 1 stub. Returns a hardcoded URL pointing to the stub-site Netlify deploy. Tristan will paste the actual stub-site URL in here once that's deployed in Step 9:

```ts
import { Request, Response } from 'express'

const STUB_SITE_URL = process.env.STUB_SITE_URL || 'https://vno-stub-site.netlify.app'

export async function buildRoute(req: Request, res: Response) {
  console.log('[build] received payload:', JSON.stringify(req.body))
  // Simulate a tiny delay so the UI can show the building state
  await new Promise(r => setTimeout(r, 500))
  res.json({ url: STUB_SITE_URL, buildTime: 0.5 })
}
```

`engine/package.json` scripts:
```json
{
  "scripts": {
    "start": "tsx src/server.ts",
    "dev": "tsx watch src/server.ts"
  }
}
```

`engine/README.md` — explain how to run + tunnel:
```markdown
# VNO engine (Day 1 stub)

Node + Express server that accepts build requests from the VNO PWA and (for Day 1) returns a hardcoded URL.

## Run locally
\`\`\`powershell
npm install
npm start
\`\`\`
Server listens on http://localhost:3000.

## Expose via Cloudflare Tunnel
\`\`\`powershell
cloudflared tunnel --url http://localhost:3000
\`\`\`
Copy the resulting `*.trycloudflare.com` URL — paste it into `D:\vno\app\.env` as `VITE_ENGINE_URL`.

## Endpoints
- `POST /build` — accepts JSON, returns `{ url, buildTime }`
- `GET /health` — returns `{ ok: true }`

## Day 1 scope
Stub only. Real pipeline (screenshot-to-code, fal.ai, copy gen, Netlify deploy) lands Day 4–5.
```

---

## Step 9 — The stub demo site

`stub-site/index.html` — a single-file salon homepage that Day 1's Preview Mode loads. Use the Editorial Quiet design from `direction_1_editorial.html` (already in the project files). Strip the project wrapper, keep just the inner phone mockup, expand it to fill the viewport with sensible mobile breakpoints. The exact content (`Maison Rose`, "A chair you return to", etc.) stays — it's standing in for what the real engine will produce later.

Deploy to Netlify as a separate site:
- Go to Netlify dashboard → Add new site → Deploy manually
- Drag `D:\vno\stub-site\` folder
- Note the URL (e.g., `https://vno-stub-site.netlify.app`)
- Update `engine/.env` with `STUB_SITE_URL=https://vno-stub-site.netlify.app`

---

## Step 10 — Deploy the app to Netlify

- Push `D:\vno\` to GitHub
- Netlify dashboard → Add new site → Import from Git → select the repo
- Build settings:
  - Base directory: `app`
  - Build command: `npm run build`
  - Publish directory: `app/dist`
- Add environment variable: `VITE_ENGINE_URL=https://your-tunnel-url.trycloudflare.com`
- Deploy
- Note the Netlify URL (e.g., `https://vno-app.netlify.app`)

---

## Day 1 done definition — the kitchen demo

Tristan stands in his kitchen with phone in hand. Cowork has scaffolded everything. Tristan does this manually:

1. **Start engine** in PowerShell:
   ```powershell
   cd D:\vno\engine
   npm start
   ```
   See `VNO engine listening on :3000` in console.

2. **Start tunnel** in another PowerShell window:
   ```powershell
   cloudflared tunnel --url http://localhost:3000
   ```
   Copy the `*.trycloudflare.com` URL.

3. **Update Netlify env var** for `vno-app` site with the new tunnel URL → trigger redeploy.

4. **On phone:** Open `https://vno-app.netlify.app` in Safari (iOS) or Chrome (Android). Use "Add to Home Screen" to install as PWA. Open the installed PWA — should launch in standalone mode (no browser chrome).

5. **Tap through the 7 stub screens.** Each shows just header + title + Continue. On screen 7, the button reads "Build the site →".

6. **Tap Build.** Button shows "Building…" briefly. App POSTs to the tunnel URL → engine logs `[build] received payload: {"stub":true}` → returns the stub site URL → app navigates to /review.

7. **On Review:** see `Stub Business · Built in 0.5s` plus a small iframe preview of the salon site, plus three buttons.

8. **Tap "Hand to client →".** DND check appears. Tick the checkbox. Tap "Enter Preview Mode".

9. **Preview Mode opens:** the salon site fills the entire screen, no VNO chrome anywhere. Triple-tap the top-right corner to exit back to /quiz/1.

If steps 1–9 all work, **Day 1 ships.** Commit, push, take a victory walk.

---

## Day 1 NOT done if any of these are true

- The PWA doesn't install to home screen
- The PWA doesn't open in standalone mode after install
- The Cloudflare Tunnel URL isn't reachable from the phone
- The engine doesn't log the incoming POST
- The Review screen shows a broken iframe
- Preview Mode shows VNO chrome at any point
- Triple-tap exit doesn't work
- Any quiz screen has more than `header + title + Continue` (those are Day 2)
- The engine has any code beyond the stub `/build` route + `/health`
- `library.json` has anything in it

If any of the above is true, fix before declaring Day 1 done. No shortcuts. The kitchen demo is the test.

---

## Notes for Cowork

- Windows + PowerShell. Forward slashes work in npm/Node paths; backslashes in PowerShell file commands.
- Use `tsx` for TypeScript execution in the engine — no `ts-node` needed.
- The `aria-label` on the Preview Mode exit corner is intentional — accessibility for the operator (Tristan), not the prospect.
- Tap timing in Preview Mode: 3 taps within 1 second window. This balances accidental triggers (rare, requires deliberate fast tapping) against discoverability for Tristan (he knows the gesture, can do it without thinking).
- Do NOT add comments to the generated code beyond what's in this spec. Keep it lean.
- Do NOT add tests beyond a smoke test that confirms `/health` returns 200. We'll add real tests as the engine grows.
- Do NOT add a logger library. `console.log` is fine for Day 1.
- If you find yourself writing more than ~50 lines for any single file, stop and re-read this spec. Day 1 should be small.

---

## What Day 2 will add (so Cowork doesn't accidentally start it)

- Real form state in screens 1–7 (per the locked mocks in chat)
- Real input components (text, toggle, file upload, textarea)
- Step-to-step state management (Zustand or React Context)
- Form validation (per-screen)
- "Cannot continue until X is filled" logic
- Vibe filtering on Screen 4 (which references show based on vertical pick)

Days 3–5 add the real engine pipeline. Days 6–7 seed the library. Day 8+ is field testing.

If Cowork is tempted to start any of Day 2 today, it's wrong. Lock Day 1 first.

---

End of spec.
