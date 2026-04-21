# VNO — Phase 1: Static Mockup App

**One-sentence goal:** Build the entire VNO app frontend with hardcoded fake data, deploy it to Netlify, and make it installable as a PWA on Tristan's phone.

**What this is NOT:** There is no real backend. No form state. No cloner. No API calls. Nothing is connected to anything. It's a beautiful clickable brochure that looks exactly like the real app will look. That's Phase 2's problem.

**When Phase 1 is done:** Tristan opens the app on his phone, taps through all 7 quiz screens, taps Build, sees a fake loading screen, sees a hardcoded salon site in Preview Mode, and it all feels real. Then he knows the shape is right before any backend work happens.

---

## Reference files to read FIRST

These are in Tristan's Claude project (attached to the fresh chat). Read them before writing any code — they show you exactly what each screen looks like:

1. **`vno_app_screens_2_through_7.html`** — canonical designs for quiz screens 2 through 7 in Pitch Black. Match these pixel-for-pixel.
2. **`vno_preview_mode_handoff.html`** — canonical designs for the post-build review, DND transition, and prospect preview screens.
3. **`direction_1_editorial.html`** — the salon homepage design the "prospect" sees in Preview Mode.
4. **`vno_visual_quiz_v2.html`** — reference tile design for Screen 4 (pick the vibe).

For Screen 1 (vertical picker) — there's no dedicated artifact, but it matches the visual language of the other screens. Pitch Black, same header, a 2×5 grid of ten tappable tiles (see "Screen 1 spec" below).

---

## Tech choices (already locked, don't revisit)

- **Vite + React + TypeScript + Tailwind**
- **react-router-dom** for page routing
- **vite-plugin-pwa** for PWA manifest + service worker
- **Deploy:** Netlify (Tristan will do this manually via dashboard — you just produce the `dist/` folder that builds from `npm run build`)
- **Folder:** everything lives in `D:\vno\app\`

Do NOT install: Zustand, Redux, React Query, Formik, Yup, axios, any UI library (Material, Chakra, shadcn), any animation library. None of that is needed for Phase 1.

---

## Pitch Black design tokens (use these everywhere)

Put these in `src/lib/tokens.ts` as the single source of truth. Every component reads from here — no hex literals scattered in components.

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

## Folder structure to produce

```
D:\vno\app\
├── public\
│   ├── icon-192.png              # solid black, white "V" centered
│   ├── icon-512.png              # same, bigger
│   └── manifest.webmanifest
├── src\
│   ├── components\
│   │   ├── Header.tsx            # VNO wordmark + step indicator
│   │   ├── ContinueButton.tsx    # white pill, black text
│   │   └── PhoneShell.tsx        # dark container
│   ├── routes\
│   │   ├── Screen1Vertical.tsx
│   │   ├── Screen2Business.tsx
│   │   ├── Screen3Sections.tsx
│   │   ├── Screen4Reference.tsx
│   │   ├── Screen5Assets.tsx
│   │   ├── Screen6Special.tsx
│   │   ├── Screen7Build.tsx
│   │   ├── Review.tsx
│   │   ├── DndCheck.tsx
│   │   └── Preview.tsx
│   ├── lib\
│   │   └── tokens.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── index.html
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── vite.config.ts
└── .gitignore
```

---

## Router setup

`src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Screen1Vertical } from './routes/Screen1Vertical'
import { Screen2Business } from './routes/Screen2Business'
import { Screen3Sections } from './routes/Screen3Sections'
import { Screen4Reference } from './routes/Screen4Reference'
import { Screen5Assets } from './routes/Screen5Assets'
import { Screen6Special } from './routes/Screen6Special'
import { Screen7Build } from './routes/Screen7Build'
import { Review } from './routes/Review'
import { DndCheck } from './routes/DndCheck'
import { Preview } from './routes/Preview'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/quiz/1" replace />} />
        <Route path="/quiz/1" element={<Screen1Vertical />} />
        <Route path="/quiz/2" element={<Screen2Business />} />
        <Route path="/quiz/3" element={<Screen3Sections />} />
        <Route path="/quiz/4" element={<Screen4Reference />} />
        <Route path="/quiz/5" element={<Screen5Assets />} />
        <Route path="/quiz/6" element={<Screen6Special />} />
        <Route path="/quiz/7" element={<Screen7Build />} />
        <Route path="/review" element={<Review />} />
        <Route path="/dnd" element={<DndCheck />} />
        <Route path="/preview" element={<Preview />} />
      </Routes>
    </BrowserRouter>
  )
}
```

Every screen has a Continue (or equivalent) button that navigates to the next route. Nothing else. No state passing between screens. Each screen renders hardcoded content and renders it the same every time.

---

## Screen-by-screen specs

### Screen 1 — Pick the vertical

**Hardcoded content:** 10 tiles in a 2×5 grid.
**Tile labels, in order:** Tattoo, Groomer, Barber, Salon, Trades, Restaurant, Gym, Health, Auto, Daycare.
**Pre-selected:** Salon (white background, black text). All others are `#161616` with `0.5px solid #262626` border, `#F5F5F5` text.
**Title:** "Pick the vertical"
**Subtitle:** "Tap one. We'll filter from there."
**Step indicator:** "1 / 7"
**Continue button** navigates to `/quiz/2`.

### Screen 2 — Tell us about them

**Read `vno_app_screens_2_through_7.html` for exact visual.** Hardcode these field values so they render as pre-filled "completed" state:

- Business name: `Maison Rose`
- Address: `228 Main St, Moncton`
- Phone: `(506) 555-0114`
- Hours: `Wed–Sat, 10 to 6`
- Slogan (optional, in dim gray): `A chair you return to.`

Use `<div>` with styled borders to look like filled inputs, NOT `<input>` elements. Phase 1 has no input handling. Labels are 11px uppercase color `#666`, letter-spacing 0.05em.

**Continue** → `/quiz/3`.

### Screen 3 — Pick the sections

**Read `vno_app_screens_2_through_7.html` for exact toggle visual.** Six rows, each with a label and a toggle on the right:

- Landing — shows "LOCKED" text instead of a toggle
- Gallery — toggle ON (white pill, circle on right)
- Phone CTA — toggle ON
- Booking — toggle ON
- Pricing — toggle OFF (dim gray pill, circle on left)
- About — toggle OFF

Toggles are visual-only. Tapping does nothing.

**Continue** → `/quiz/4`.

### Screen 4 — Pick the vibe

**Read `vno_app_screens_2_through_7.html` for reference tile visual.** Three tiles stacked vertically. Each tile has a preview thumbnail (use the gradients from the mock), a label, a vibe descriptor.

- Editorial — cream gradient thumbnail — "Serif · quiet · magazine"
- Modern — dark navy thumbnail with "BOLD" text centered — "Sans · confident · dark" — **SELECTED** (1.5px solid white border)
- Heritage — warm cream-to-terracotta gradient — "Warm · crafted · stamped"

**Continue** → `/quiz/5`.

### Screen 5 — Upload assets

**Read `vno_app_screens_2_through_7.html` for the layout.** 

- Big logo upload zone at top showing "LOGO uploaded" state (white square placeholder with black "LOGO" text centered, helper text "Logo uploaded · tap to replace")
- Two empty photo slots side-by-side underneath (dashed border, "+", "PHOTO 1" / "PHOTO 2")
- Camera + Library buttons at bottom (dark, side-by-side)

Nothing is clickable except Continue.

**Continue** → `/quiz/6`.

### Screen 6 — Anything special?

**Read `vno_app_screens_2_through_7.html`.**
- Single textarea-looking `<div>` with placeholder text (dim): `e.g. 30 years in business, 2nd-gen owner, only female-owned barber on the block…`
- Two buttons side-by-side at bottom: "Skip" (dark) and "Continue" (white).

Both buttons navigate to `/quiz/7`.

### Screen 7 — Ready to build

**Read `vno_app_screens_2_through_7.html`.**
- Title: "Ready to build"
- Subtitle: "About six minutes."
- Big white "Build the site →" button.
- Below: a small "Building · preview" panel showing the 5 status lines (`Cloning the reference`, `Designing palette`, `Generating hero image` etc.) with a thin progress bar at 45%.

**Build button behavior:** navigates to `/review` after a 2-second delay (use `setTimeout`). While waiting, swap the button label to `Building…` (dimmed).

### Review (post-build, Tristan's side)

**Read `vno_preview_mode_handoff.html`, Mock 1.**
- Header: VNO wordmark + "ready" instead of step indicator
- Title: `Maison Rose`
- Subtitle: `Built in 5m 42s. Looks good?`
- Preview card with a mini-rendering of the salon site (use the cream bg + serif "A chair you return to." + subcopy from `direction_1_editorial.html`)
- Below the preview: `maison-rose-7a3f.netlify.app` (static text, not a real link)
- Primary button: `Hand to client →` → navigates to `/dnd`
- Two secondary buttons side-by-side: `Re-clone` and `Edit inputs`. Both navigate back to `/quiz/1`.

### DndCheck

**Read `vno_preview_mode_handoff.html`, Mock 2.**
- Title: "One last thing"
- Subtitle: "Silence the phone before handing over. Notifications kill the moment."
- A checkbox-looking row: checkbox starts UNCHECKED. Label: "Do Not Disturb is on" with subtext "Swipe from top-right to toggle".
- Enter Preview Mode button: DISABLED (40% opacity) when checkbox unchecked. When tapped, toggles the checkbox state. When checkbox is checked, button becomes enabled.
- Bottom hint: "Triple-tap top corner to exit later"
- Enabled button navigates to `/preview`.

This IS the one screen with local interactive state (the checkbox). Use `useState` for the checkbox only.

### Preview

**Read `vno_preview_mode_handoff.html` Mock 3 + `direction_1_editorial.html`.**

The entire screen is the salon homepage from `direction_1_editorial.html`, rendered inline (not in an iframe — just render the HTML/JSX directly). Fill the full viewport. No VNO branding anywhere. Cream background `#F8F4EE`.

Contents in order (top to bottom, sized to fit a phone viewport):
- Small header: "Maison Rose" (serif italic) on left, "MENU" on right
- Large serif hero: "A chair / you / return / to." (cream "— MONCTON EST. 2019 —" small-caps above it)
- Descriptive paragraph + a small earth-tone photo placeholder
- "Book a chair" (dark button) + "Call" (outlined button)
- **Bottom footer strip:** dark `#2A2119` background, cream text, centered: `Plus 3 social posts · review cards · desk sign — all included`

**Triple-tap top-right corner exit:** a 60px×60px invisible `<div>` positioned top-right. Track tap timestamps. If 3 taps land within 1 second, `navigate('/quiz/1')`.

---

## PWA configuration

`vite.config.ts`:

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
        description: 'Pitch-ready websites',
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

**Icons:** Generate two PNG files. Solid black background (`#0A0A0A`). Centered white letter "V" at ~50% height, sans-serif, weight 500. Save as `public/icon-192.png` (192×192) and `public/icon-512.png` (512×512). If you can't generate real PNGs, create simple SVGs with the same design and convert them — ImageMagick or any Node package works.

---

## index.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root {
  height: 100%;
  background: #0A0A0A;
  color: #F5F5F5;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  margin: 0;
  -webkit-font-smoothing: antialiased;
}

* {
  box-sizing: border-box;
}
```

---

## Build and deploy

When scaffolding is done, run:

```powershell
cd D:\vno\app
npm install
npm run build
```

Verify `dist/` folder is created. Tell Tristan it's ready. He handles Netlify deploy manually via the dashboard (Add new site → Deploy manually → drag `dist/` folder). Don't try to deploy from command line — Tristan wants dashboard control.

---

## Execution rules for you, Cowork

1. **Read the reference files first.** `vno_app_screens_2_through_7.html`, `vno_preview_mode_handoff.html`, `direction_1_editorial.html`, `vno_visual_quiz_v2.html`. These are the source of truth for visuals. Match them.

2. **Pause after each numbered step below. Summarize what you did in 2 sentences. Wait for "continue" before moving on.**

3. **Execution order (each step is a checkpoint):**
   - Step 1: Scaffold the Vite project, install all dependencies, configure Tailwind + PWA. Confirm `npm run dev` starts a dev server.
   - Step 2: Generate the PWA icons and write the manifest.
   - Step 3: Write `tokens.ts` + the three shared components (Header, ContinueButton, PhoneShell).
   - Step 4: Write Screens 1, 2, 3 (the tap-grid / form / toggle screens).
   - Step 5: Write Screens 4, 5, 6 (references, assets, anything special).
   - Step 6: Write Screen 7 with its setTimeout navigation to /review.
   - Step 7: Write Review screen.
   - Step 8: Write DndCheck screen (the only screen with useState).
   - Step 9: Write Preview screen with triple-tap exit logic.
   - Step 10: Run `npm run build`, verify `dist/` folder, confirm everything works on `npm run preview`.

4. **If any single file exceeds ~150 lines, pause and show it to me.**

5. **Don't install any packages not listed above. If you think you need something extra, ask.**

6. **No tests for Phase 1.** Visual verification only.

7. **No comments in code.** Keep it lean.

8. **No automated deployment.** Produce the `dist/` folder, stop there. Tristan deploys manually.

9. **No error handling or loading states beyond what's specified.** This is a mockup.

10. **Match the reference mocks pixel-for-pixel.** When in doubt, re-read the HTML files. Don't invent decorations.

---

## Phase 1 is done when

All of these are true on Tristan's end:

1. `D:\vno\app\npm run build` completes without errors.
2. `D:\vno\app\dist\` folder exists and contains `index.html` + `assets/`.
3. Tristan uploads `dist/` to Netlify → gets a live URL.
4. Tristan opens the URL on his phone in Safari (iOS) or Chrome (Android).
5. He uses "Add to Home Screen" → installs as PWA.
6. Opening the installed PWA launches in standalone mode (no browser chrome).
7. He can tap through all 7 quiz screens and see each one match the designs.
8. Tapping "Build the site →" on screen 7 waits ~2 seconds, then navigates to Review.
9. Review shows Maison Rose + a mini-preview of the salon site.
10. "Hand to client →" leads to DND → checkbox → Preview Mode.
11. Preview Mode shows the full salon homepage fullscreen, zero VNO chrome.
12. Triple-tapping the top-right corner returns to Screen 1.

If any of those 12 fail, Phase 1 isn't done. Fix before declaring done.

---

## What Phase 2 will add (do NOT start)

- Real form state (what the user types/taps actually persists)
- Validation (can't continue without required fields)
- Logo upload that reads from camera/gallery
- Section toggles that actually toggle

Phase 2 has its own .md that gets written after Phase 1 ships. If you find yourself tempted to add anything from Phase 2 into Phase 1, stop and re-read this file.

---

End of Phase 1 spec.
