# VNO — Phase 6: Production Quality Polish

**One-sentence goal:** Fix the three biggest visual bugs in Phase 5's output — sideways photos, literal `EST YYYY` / `© 2024` text, and blurry stretched heroes — so every build produced by the engine is trustworthy enough to show a real prospect without cringing.

**What this is NOT:** Not adding new features. Not expanding the reference library (that's Track B, Tristan executes in parallel — see `PHASE_6_TEMPLATE_KIT.md`). Not rewriting the cloner prompt from scratch. Three specific, targeted engine fixes. All changes are engine-side; the app doesn't need a rebuild or redeploy.

**When Phase 6 Polish is done:** Tristan can hit Build from his phone with a portrait-orientation photo and a landscape-orientation photo, and:
- Both photos render in the deployed site with correct orientation (no sideways)
- The EST badge shows the actual current year (e.g. "EST 2026"), not placeholder text
- The footer copyright shows the current year
- The hero image uses a photo whose aspect ratio fits the hero slot; the other photo lands in a position that suits its orientation (not stretched/blurry)

---

## Prerequisites

Phase 5 must be shipped and committed. This phase builds directly on `D:\vno\engine\`. Do NOT touch the app — these are all engine fixes.

Window 1 (engine) and Window 2 (tunnel) stay running throughout. No infrastructure changes.

## Reference files

- `PHASE_5_HANDOFF.md` — current pipeline architecture; the "Contracts and traps" section is especially relevant for the cloner prompt edits
- `PHASE_5_REAL_ASSETS.md` — prior phase spec for pattern reference
- Existing `engine/src/lib/assets.ts` — EXIF fix lives here
- Existing `engine/src/lib/cloner.ts` — year + aspect hints land in the system prompt + user message construction
- Existing `engine/src/routes/build.ts` — aspect detection lives here before the cloner call

---

## Architecture: what changes, where

Three fixes, each isolated to a small surface area:

### Fix 1 — EXIF orientation (assets.ts)

**Problem:** iPhone photos have their orientation encoded in EXIF metadata rather than baked into the pixel data. Sharp strips metadata on output but doesn't auto-apply the rotation, so a portrait photo held sideways by the phone's sensor comes out sideways in the deployed site.

**Fix:** Add `.rotate()` (no arguments) to every sharp pipeline in `assets.ts`. With no arguments, sharp auto-applies the EXIF orientation and bakes it into the pixels, then strips the metadata. Applied to both `processLogo` and `processPhoto`.

**Surface area:** ~3 lines changed in `engine/src/lib/assets.ts`. No new functions.

### Fix 2 — Hardcoded current year (cloner.ts + build.ts)

**Problem:** The cloner's system prompt instructs Claude to render "EST. YYYY" and leaves Claude to infer the year from context. Claude sometimes picks the current year, sometimes writes "YYYY" literally, sometimes writes 2024 because its training data tilts toward older dates. The footer copyright line has the same problem.

**Fix:** Compute `const currentYear = new Date().getFullYear()` inside the build route at call time. Pass it into the cloner function signature. Update the cloner's user message construction (not the system prompt, which stays cacheable) to include a line like: `The current year is ${currentYear}. Use this exact number in the EST badge, the copyright footer, and any "established" language. Do not use any other year. Do not write "YYYY" or a placeholder.`

**Surface area:** `engine/src/lib/cloner.ts` — function signature + one user message line. `engine/src/routes/build.ts` — compute year, pass to `cloneToHtml(screenshot, business, referenceUrl, currentYear)`. No new files.

**Contract note:** the existing `BADGE_PROMPT(year)` in `fal.ts` already takes a year argument and `build.ts` already passes `new Date().getFullYear()` into it, so the fal.ai-generated badge image has always had the correct year. This fix aligns the HTML the cloner produces with the badge image fal.ai produces. Both now reference the same year source of truth.

### Fix 3 — Aspect ratio hints per photo (build.ts + cloner.ts)

**Problem:** The cloner today doesn't know whether `photo1` is landscape, portrait, or square. If a prospect uploads a vertical iPhone selfie as the "hero," the cloner places it in a wide hero slot and the resulting clone either crops it badly (cuts off the subject's head) or stretches it (blurry). Either outcome is a pitch-killer.

**Fix:** After sharp processes each photo in `build.ts`, read its metadata (`sharp(processedBuf).metadata()` returns `{ width, height, ... }`). Derive an aspect category: `landscape` (width > height × 1.2), `portrait` (height > width × 1.2), or `square` (otherwise). Pass these into the cloner alongside the photos.

In `cloner.ts`, add a new section to the system prompt (stays cacheable) that reads roughly:

```
PHOTO PLACEMENT RULES:
- Landscape photos work best as hero images (full-width, top of page) or as wide section backgrounds.
- Portrait photos should be placed in side-by-side layouts (e.g. a 2-column section with text on one side, photo on the other) or as tall card images. Never stretch a portrait into a wide hero.
- Square photos work well in gallery grids or as centered feature images.

You will be told the aspect ratio of each uploaded photo. Use the photo whose aspect best fits the hero slot for the hero. If both photos are portrait, do not create a hero image section — use a split-layout intro instead. If both photos are landscape, put the stronger composition in the hero and the other in a mid-page feature section.
```

Then in the user message, inject: `photo1 aspect: ${photo1Aspect}. photo2 aspect: ${photo2Aspect}.`

**Surface area:** `engine/src/routes/build.ts` — ~6 lines of aspect detection + add to cloner call. `engine/src/lib/cloner.ts` — ~15 lines in the system prompt + one user message line. No new files.

---

## What stays the same

- The wire shape between app and engine is unchanged. App still sends `{ assets: { logo, photo1, photo2 } }`. Engine still validates the same way.
- `fal.ts`, `glossary.ts`, `netlify.ts`, `puppeteer.ts` are untouched.
- The system prompt's existing sections (asset placement rules, glossary injection, reference cloning) all stay. The aspect rules are a new section appended.
- No changes to `server.ts`, `/health`, or the body limit.
- No new dependencies.

---

## Implementation details

### `engine/src/lib/assets.ts`

Change the sharp pipelines from:

```ts
await sharp(buf).resize(400, 400, { fit: 'contain', ... }).png().toBuffer()
```

To:

```ts
await sharp(buf).rotate().resize(400, 400, { fit: 'contain', ... }).png().toBuffer()
```

Apply to both `processLogo` and `processPhoto`. Bare `.rotate()` (no args) is the incantation — it tells sharp "use the EXIF orientation tag to rotate, then strip it." With args (like `.rotate(90)`), it rotates by that number of degrees regardless of EXIF, which is wrong here.

### `engine/src/routes/build.ts`

After the parallel asset processing block completes, before calling `cloneToHtml`:

```ts
const photo1Meta = await sharp(photo1Buf).metadata()
const photo2Meta = await sharp(photo2Buf).metadata()

function aspectOf(meta: { width?: number, height?: number }): 'landscape' | 'portrait' | 'square' {
  const w = meta.width ?? 1
  const h = meta.height ?? 1
  if (w > h * 1.2) return 'landscape'
  if (h > w * 1.2) return 'portrait'
  return 'square'
}

const photo1Aspect = aspectOf(photo1Meta)
const photo2Aspect = aspectOf(photo2Meta)

const currentYear = new Date().getFullYear()
```

Then update the `cloneToHtml` call signature:

```ts
html = await cloneToHtml(screenshot, business, req.body.reference.url, {
  currentYear,
  photo1Aspect,
  photo2Aspect,
  vertical: req.body.vertical, // glossary already uses this; keep explicit
})
```

### `engine/src/lib/cloner.ts`

Signature change:

```ts
export interface CloneOptions {
  currentYear: number
  photo1Aspect: 'landscape' | 'portrait' | 'square'
  photo2Aspect: 'landscape' | 'portrait' | 'square'
  vertical: string
}

export async function cloneToHtml(
  screenshot: Buffer,
  business: BusinessInfo,
  referenceUrl: string,
  options: CloneOptions
): Promise<string>
```

System prompt — append a new section (after the existing asset placement rules, before the glossary injection):

```
PHOTO ASPECT HANDLING:
Every uploaded prospect photo has an aspect ratio. You will be told whether each photo is landscape, portrait, or square. Use this to place photos in layouts they actually fit:

- Landscape (wider than tall): ideal for hero banners, wide section backgrounds, full-bleed feature images.
- Portrait (taller than wide): ideal for split-column layouts (photo next to text), tall card images, or sidebar features. Never stretch a portrait photo into a landscape hero slot — this produces a blurry, cropped result.
- Square: works in gallery grids, circular profile/avatar treatments, or centered feature images.

If photo1 is landscape, it should usually be the hero. If both are portrait, skip the full-width hero and use a split-layout intro section instead. If both are landscape, pick one for the hero and use the other in a mid-page feature section.

YEAR:
The current year will be provided to you. Use that exact year in the EST badge, the copyright footer, and any "established" or "since" language. Never write "YYYY" literally. Never guess or default to a past year.
```

User message — add at the end, after the business info block:

```
The current year is ${options.currentYear}.
photo1 aspect: ${options.photo1Aspect}.
photo2 aspect: ${options.photo2Aspect}.
```

---

## Execution order for Cowork (6 steps)

Pause after each, 2-sentence summary, wait for "continue." Same pattern as Phase 5.

- **Step 1:** Modify `engine/src/lib/assets.ts` to add `.rotate()` to both sharp pipelines in `processLogo` and `processPhoto`. Typecheck clean.
- **Step 2:** Write smoke test for EXIF fix. Tristan uploads a deliberately-rotated JPG (iPhone portrait held sideways) to a tiny test script that runs the new `processPhoto`, then opens the output JPG and confirms it's right-side-up. Cost: $0.
- **Step 3:** Update `engine/src/lib/cloner.ts` with new `CloneOptions` interface, updated function signature, new system prompt sections (aspect handling + year rule), new user message lines. Typecheck clean.
- **Step 4:** Update `engine/src/routes/build.ts` — compute `currentYear`, detect photo aspects, pass new options object into `cloneToHtml`. Typecheck clean.
- **Step 5:** End-to-end smoke test via `smoke-build-curl.ps1` or phone. Use the same `test-logo.png` + `test-photo.jpg` + `test-photo2.jpg` from Phase 5. Verify three things on the deployed site: (a) no sideways photos, (b) badge + footer show the actual current year, (c) hero photo aspect matches its position. Cost: ~$0.11.
- **Step 6:** Deliver short `PHASE_6_POLISH_HANDOFF.md` note covering what changed + the new cloner options contract, plus known gaps that emerge during testing. Append to the main PHASE_5_HANDOFF.md's "Known gaps" section the items this phase resolved.

---

## Phase 6 Polish is done when

1. Engine restarted with Phase 6 changes, `/health` reachable (no phase bump needed — stays at 5)
2. Test photo shot portrait on an iPhone and uploaded via the phone renders correctly oriented on the deployed site
3. The deployed site's EST badge shows `EST 2026` (not "EST YYYY" or "EST 2024")
4. The deployed site's footer shows `© 2026` (not any other year)
5. When photo1 is portrait and photo2 is landscape, the landscape photo lands in the hero; the portrait is used in a split-layout section (not stretched)
6. When both photos are portrait, no full-width hero is rendered — split-layout intro instead
7. `smoke-build-curl.ps1` still passes end-to-end in ~90s
8. Build cost still ~$0.11 (no retry loop added, so no cost regression)

If any of those 8 fail, Phase 6 Polish isn't done.

---

## Explicitly deferred (Phase 6.1 / 7 backlog)

Not shipping in Phase 6. Filed here so they don't get lost:

- **Retry-on-quality-failure for the clone step.** If Claude returns <2000 chars or missing required sections, retry once with a stricter prompt. Medium complexity, real cost (doubles worst-case build cost per failed retry). Defer until template library has more data showing which prompts produce consistent failures.
- **Business name verbatim rule.** Golden Girls → "Golden Girls Salon" footer inconsistency observed during Phase 5 testing. Fix is a one-line system prompt addition. Defer to Phase 6.1 as a quick patch.
- **Preview screenshot on Review screen.** Replace the hardcoded mini-card with an actual screenshot of the generated site. Medium-complexity engine addition (needs a new `GET /preview/:deployId` endpoint that puppeteer-screenshots the deployed URL). Defer.
- **Aspect-ratio hints are first-pass.** If the landscape/portrait/square taxonomy turns out too coarse (e.g. 16:9 vs 4:3 landscape matters for certain layouts), refine later.

---

## What Phase 7 will add (do NOT start)

- Prospect-facing refinements based on pitching data (which verticals get picked up, which templates produce the best clones)
- Possibly: SSE progress streaming from `/build` so Screen 7's progress bar reflects real work
- Possibly: a "regenerate" button on Review screen that re-runs the build with the same inputs but different reference (useful when a clone comes out weak)

Phase 6 ships the three fixes. Template library curation (Track B) happens in parallel on Tristan's side. Phase 7 starts only after Phase 6 Polish and the first few pitching attempts provide real-world signal.

---

End of Phase 6 Polish spec.
