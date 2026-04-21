# VNO — Phase 2: Real Form State

**One-sentence goal:** Make Phase 1's clickable mockup *actually interactive* — every input, toggle, file upload, and selection persists through the quiz and flows to the Review screen.

**What this is NOT:** There is still no backend. No Cloudflare Tunnel. No cloner. No Anthropic API. Tapping "Build the site" still navigates to a canned Preview Mode after a fake delay. The difference vs Phase 1: the business name on the Review screen is the name YOU typed on Screen 2, not "Maison Rose."

**When Phase 2 is done:** Tristan can sit at a café, walk through the full quiz using his friend's barbershop as a test prospect, upload an actual logo from his phone, see it render through the flow, and see the typed business name on the Review screen.

---

## Prerequisites

Phase 1 must be shipped and committed to git. This phase builds directly on `D:\vno\app\`. Do NOT rewrite Phase 1 code — extend it.

## Reference files (in the workspace — read first)

- **`PHASE_1_STATIC_MOCKUP.md`** — the previous phase's spec. Useful context for what was already built.
- **`vno_app_screens_2_through_7.html`** — canonical screen visuals. Don't change the visual design.
- **All the Screen*.tsx files already in `D:\vno\app\src\routes\`** — read each one to understand what's there before modifying.

---

## Architecture decision: state management

**Use Zustand.** One small store at `D:\vno\app\src\lib\store.ts`.

Why Zustand and not React Context: Zustand is simpler (no providers, no reducers), plays well with localStorage for persistence (if you want it later), and doesn't re-render the world on every state change. 3KB gzipped. Install it:

```
npm install zustand
```

**Don't use:** Redux, Jotai, Recoil, React Context, URL params, React Query. Zustand only.

---

## The store shape

`src/lib/store.ts`:

```ts
import { create } from 'zustand'

export type Vertical = 'tattoo' | 'groomer' | 'barber' | 'salon' | 'trades' | 'restaurant' | 'gym' | 'health' | 'auto' | 'daycare'

export interface BusinessInfo {
  name: string
  address: string
  phone: string
  hours: string
  slogan: string
}

export interface Sections {
  landing: true
  gallery: boolean
  phoneCta: boolean
  booking: boolean
  pricing: boolean
  about: boolean
}

export type Vibe = 'editorial' | 'modern' | 'heritage'

export interface Assets {
  logoDataUrl: string | null
  photo1DataUrl: string | null
  photo2DataUrl: string | null
}

export interface QuizState {
  vertical: Vertical | null
  business: BusinessInfo
  sections: Sections
  vibe: Vibe | null
  assets: Assets
  anythingSpecial: string

  setVertical: (v: Vertical) => void
  setBusiness: (b: Partial<BusinessInfo>) => void
  toggleSection: (key: keyof Omit<Sections, 'landing'>) => void
  setVibe: (v: Vibe) => void
  setLogo: (dataUrl: string | null) => void
  setPhoto: (slot: 1 | 2, dataUrl: string | null) => void
  setAnythingSpecial: (text: string) => void
  reset: () => void
}

const initialState = {
  vertical: null,
  business: { name: '', address: '', phone: '', hours: '', slogan: '' },
  sections: { landing: true as const, gallery: true, phoneCta: true, booking: true, pricing: false, about: false },
  vibe: null,
  assets: { logoDataUrl: null, photo1DataUrl: null, photo2DataUrl: null },
  anythingSpecial: '',
}

export const useQuiz = create<QuizState>((set) => ({
  ...initialState,
  setVertical: (v) => set({ vertical: v }),
  setBusiness: (b) => set((s) => ({ business: { ...s.business, ...b } })),
  toggleSection: (key) => set((s) => ({ sections: { ...s.sections, [key]: !s.sections[key] } })),
  setVibe: (v) => set({ vibe: v }),
  setLogo: (dataUrl) => set((s) => ({ assets: { ...s.assets, logoDataUrl: dataUrl } })),
  setPhoto: (slot, dataUrl) => set((s) => ({ assets: { ...s.assets, [`photo${slot}DataUrl`]: dataUrl } })),
  setAnythingSpecial: (text) => set({ anythingSpecial: text }),
  reset: () => set(initialState),
}))
```

**Persistence:** skip localStorage for Phase 2. State resets when the PWA is closed. That's fine for a walking-around pitch tool — each prospect is a fresh quiz.

---

## Screen-by-screen changes

### Screen 1 — Pick the vertical

**Currently:** Salon hardcoded as selected.

**Change to:** User taps any tile → `setVertical(verticalKey)` → that tile renders as selected (white bg, black text), all others unselected. Continue button is disabled until a vertical is picked (40% opacity). Tapping Continue navigates to `/quiz/2`.

**Validation rule:** must pick a vertical before continuing.

### Screen 2 — Tell us about them

**Currently:** 5 hardcoded `<div>` elements styled to look like filled inputs.

**Change to:** Replace all 5 `<div>` field displays with real `<input>` elements bound to the store:

- Business name → `name`, type="text"
- Address → `address`, type="text"
- Phone → `phone`, type="tel" (brings up numeric keypad on phone)
- Hours → `hours`, type="text"
- Slogan → `slogan`, type="text" (optional)

**Style the inputs to look exactly like the Phase 1 `<div>`s looked** — same bg, border, padding, font-size. No visual difference. Use the same token values from `tokens.ts`. Add a subtle focus ring (1px white, 30% opacity) so you can see which field is active. No placeholder text when empty — labels above each input describe what to type.

**Validation rule:** `name`, `address`, `phone`, `hours` are required. `slogan` is optional. Continue disabled until required four are non-empty.

**Keyboard UX:** on mobile, tapping a field focuses the input and brings up the keyboard. Continue button should remain reachable (not covered by keyboard). Use `viewport-fit=cover` in the HTML meta + safe-area CSS if needed.

### Screen 3 — Pick the sections

**Currently:** 6 toggle rows, visual-only (Landing LOCKED, Gallery/Phone CTA/Booking ON, Pricing/About OFF).

**Change to:** 5 tappable rows (Landing row is still locked and non-interactive). Tapping any other row → `toggleSection(key)` → the toggle pill animates to the other side.

**Initial state from the store:** Landing locked on (always), Gallery/Phone CTA/Booking default on, Pricing/About default off. These defaults are set in the store's `initialState`.

**Toggle animation:** CSS transition, ~120ms ease-out, on the toggle circle's `transform: translateX()`. Nothing fancy.

**Continue** is always enabled (Landing is always on, which is a valid minimum config). → `/quiz/4`.

### Screen 4 — Pick the vibe

**Currently:** "Modern" hardcoded as selected.

**Change to:** Tapping any of the 3 tiles → `setVibe('editorial' | 'modern' | 'heritage')` → that tile shows the 1.5px solid white border, others show the thin border. Same visual treatment as Phase 1, just now driven by state.

**Validation:** vibe must be picked to continue.

### Screen 5 — Upload assets

**This is the biggest behavior change.** Currently everything is static. Now:

**Logo upload:**
- The large upload zone is tappable
- Tap → open the OS file picker (HTML `<input type="file" accept="image/*">`, hidden, triggered by a ref)
- User picks an image → `FileReader.readAsDataURL()` → `setLogo(dataUrl)`
- Once logo is set, the upload zone renders a preview: show the logo image at 64×64 with `object-fit: contain`, cream background around it (match Phase 1 visual). Subtext changes from "Tap to upload" to "Logo uploaded · tap to replace"
- Tapping the uploaded zone replaces the logo (re-opens picker)

**Logo validation:** required to continue.

**Photo slots:**
- Each of the 2 slots is tappable
- Tap empty slot → file picker
- Pick → preview renders (fills the slot with `object-fit: cover`)
- Slots are independently optional

**Camera vs Library buttons:**
- These are UX hints for now. In Phase 2, both Camera and Library buttons just trigger the same file picker. On mobile, the OS picker gives the user camera/library choices anyway.
- Later phases can differentiate (Camera = `capture="environment"` attribute, Library = no capture attr).
- For Phase 2: both buttons open the file picker for whichever slot was last tapped. If no slot is active, they target the logo.

**Storage:** images are stored as base64 data URLs in the store. Downside: big payloads in memory (~500KB per logo). Fine for Phase 2; Phase 3 will send these over HTTP.

**Continue** disabled until logo is uploaded.

### Screen 6 — Anything special?

**Currently:** Placeholder text in a `<div>`.

**Change to:** Replace with a real `<textarea>` bound to `anythingSpecial`. Same styling as the Phase 1 div (dark bg, thin border, min-height 130px, 13px font). When empty, show the placeholder text (`e.g. 30 years in business, 2nd-gen owner…`) via the `placeholder` attribute.

**Two buttons:**
- Skip: navigates to `/quiz/7` without changing `anythingSpecial` (state stays whatever it was)
- Continue: navigates to `/quiz/7` with the typed text preserved

Both buttons are always enabled.

### Screen 7 — Ready to build

**No behavior change.** Still shows "Ready to build" + the big button + the 5-line preview panel. Still 2-second setTimeout → `/review`.

(Why no change: there's no backend to call yet. The button still fakes the transition to Review.)

### Review screen

**Currently:** Hardcoded "Maison Rose / Built in 5m 42s".

**Change to:**
- Title: `useQuiz((s) => s.business.name)` — shows whatever they typed on Screen 2
- If name is empty (edge case), fall back to "Your business" as a placeholder
- Subtitle stays "Built in 5m 42s. Looks good?" (fake build time; real Phase 3+)
- The mini-preview card keeps its hardcoded salon site content (no backend to generate real preview yet)
- All three buttons (Hand to client →, Re-clone, Edit inputs) work as before

**"Edit inputs" behavior:** should navigate to `/quiz/1` but NOT reset the store (so typed data persists and user can fix just what they want). If user wants to start fresh, add a subtle "Start over" link somewhere — optional, can defer.

### DndCheck & Preview

**No changes.** Phase 1 implementation is already correct for Phase 2.

---

## Validation helper

Add `src/lib/validation.ts`:

```ts
import { useQuiz } from './store'

export function useCanContinue(step: number): boolean {
  const state = useQuiz()
  switch (step) {
    case 1: return state.vertical !== null
    case 2: return state.business.name.trim() !== ''
             && state.business.address.trim() !== ''
             && state.business.phone.trim() !== ''
             && state.business.hours.trim() !== ''
    case 3: return true
    case 4: return state.vibe !== null
    case 5: return state.assets.logoDataUrl !== null
    case 6: return true
    case 7: return true
    default: return false
  }
}
```

Use this in every screen's Continue button to determine enabled/disabled state. Disabled = 40% opacity, cursor: not-allowed, onClick is no-op.

---

## What each disabled Continue button looks like

Add this styling to `ContinueButton.tsx`:

```tsx
export function ContinueButton({ label = 'Continue', onClick, disabled = false }: {
  label?: string; onClick: () => void; disabled?: boolean
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '13px',
        background: tokens.accent,
        color: tokens.accentText,
        border: 'none',
        fontSize: '13px',
        fontWeight: 500,
        borderRadius: tokens.radius.button,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        marginTop: '22px',
        transition: 'opacity 120ms ease-out',
      }}
    >
      {label}
    </button>
  )
}
```

---

## Execution order for Cowork (8 steps — smaller phase than Phase 1)

Pause after each step, summarize in 2 sentences, wait for "continue" before moving on. Same rules as Phase 1.

- **Step 1:** Install Zustand. Write `src/lib/store.ts`. Write `src/lib/validation.ts`. Update `ContinueButton.tsx` with the disabled prop. Confirm `npm run dev` still compiles.
- **Step 2:** Screen 1 — wire tap-to-select on tiles. Selected state reads from store. Continue button respects `useCanContinue(1)`.
- **Step 3:** Screen 2 — replace display divs with real inputs bound to `setBusiness`. Continue respects validation.
- **Step 4:** Screen 3 — wire toggles to `toggleSection`. Add ~120ms CSS transition on the toggle circle.
- **Step 5:** Screen 4 — wire tile tap to `setVibe`. Selected border state reads from store.
- **Step 6:** Screen 5 — implement real logo + photo upload via hidden file inputs, FileReader, and data URLs. Preview renders on upload. Continue requires logo.
- **Step 7:** Screen 6 — replace div with textarea bound to `anythingSpecial`.
- **Step 8:** Review screen — read business name from store, fallback to "Your business". Run `npm run build`, verify `dist/` works via `npm run preview`, all routes still 200.

---

## Phase 2 is done when

Tristan can:

1. Open the Netlify PWA on his phone
2. Tap a vertical (e.g. Barber) on Screen 1 → it highlights, Continue enables
3. Type real business info on Screen 2 → Continue enables once all 4 required fields are filled
4. Toggle Pricing on / About on → toggles animate smoothly, state persists if he goes back
5. Pick a vibe on Screen 4 → border highlights the chosen tile
6. Upload a real logo from his phone camera roll on Screen 5 → logo preview renders immediately
7. Type a sentence on Screen 6, tap Continue (or Skip)
8. Tap "Build the site →" on Screen 7
9. Review screen shows the business name HE typed (not "Maison Rose")
10. Everything else (DND check, Preview Mode, triple-tap exit) still works from Phase 1

If any of those 10 fail, Phase 2 isn't done.

---

## What Phase 3 will add (do NOT start)

- Tiny Express server on `D:\vno\engine\` that receives the full quiz state as JSON
- Cloudflare Tunnel so the phone can reach the PC
- Engine returns a hardcoded URL (stub) — real cloner is Phase 4
- Review screen's "Built in 5m 42s" becomes the actual measured build time

Phase 2 stops at making the *client* fully interactive. Backend is Phase 3.

---

End of Phase 2 spec.
