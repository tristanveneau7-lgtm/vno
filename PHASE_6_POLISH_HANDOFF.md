# VNO — Phase 6 Polish Handoff

**Goal of this document:** take future-Tristan from "Phase 5 shipped" to "I understand exactly what Phase 6 changed, why, and what I would touch if I wanted to bend the behaviour." Short doc — three fixes, one new contract, a handful of known gaps worth remembering.

Three targeted polish fixes on top of the Phase 5 pipeline. No new external services, no new env vars, no new deploy. The engine and the app both keep the Phase 5 shape; Phase 6 only tightens it.

---

## What shipped

**1. Manual photo orientation tagging on Screen 5.** Below each photo preview, a two-button `Portrait / Landscape` toggle. Disabled until the photo is uploaded; accent-fill on the selected side. Re-uploading a photo clears its orientation (a new photo may be oriented differently and silently inheriting the old tag would ship a mislabelled asset). Continue stays locked until all three assets AND both orientations are set. Persist version bumped `3 → 4`.

**2. Canonical current year.** `build.ts` computes `currentYear = new Date().getFullYear()` once and routes it two places: stringified into the existing fal.ai `BADGE_PROMPT(year)` (unchanged behaviour), and as a number into the cloner `CloneOptions.currentYear`. The cloner's system prompt gained a YEAR section telling Claude to use the injected year in the EST badge, the copyright footer, and any "since"/"established" copy — and explicitly not to write `YYYY` literally or default to a past year. The badge line in `DECORATIVE ASSETS` was changed from the bug-prone `"EST. YYYY"` example to `"EST. [current year]"` pointing at the YEAR section.

**3. Orientation-aware layout guidance.** The cloner's system prompt gained a PHOTO PLACEMENT section: landscape photos lead as hero banners and wide feature images; portrait photos go in split-column layouts, tall cards, or sidebars; never stretch a portrait into a wide hero; if both photos are portrait, skip the full-width hero and use a split-layout intro. The user message now includes `photo1 orientation: <tag>. photo2 orientation: <tag>.` so Claude can choose layouts that fit the actual assets. End-to-end smoke verified: `landscape + portrait` produced a landscape hero + side-section split, no stretched crops.

---

## The new contract — `CloneOptions`

`engine/src/lib/cloner.ts` now exports `CloneOptions`:

```ts
export interface CloneOptions {
  currentYear: number
  photo1Orientation: 'portrait' | 'landscape'
  photo2Orientation: 'portrait' | 'landscape'
}
```

…and `cloneToHtml(screenshot, business, referenceUrl, options)` requires it. `build.ts` builds the object literally once and passes the same reference to both the first clone attempt and its retry. If you add a fourth piece of per-build context (say, timezone, or a requested colour accent), extend `CloneOptions` rather than adding a sixth positional arg.

Orientations are validated in `build.ts` as exact `'portrait' | 'landscape'` strings — a typo like `'Portrait'` or `'PORTRAIT'` is rejected at the 400/500 boundary rather than silently leaking into the prompt. The app enforces the same set via TypeScript's `Exclude<PhotoOrientation, null>` type on `setPhotoOrientation`.

On the wire, orientations live **inside** `req.body.assets` (alongside `logo`/`photo1`/`photo2`) — the app's `Assets` interface in `store.ts` was extended directly and `api.ts`'s `BuildPayload.assets` inherits through `QuizState['assets']`, so no separate wire-shape change was needed.

---

## Why we didn't use EXIF (the abandoned approach)

The first draft of Phase 6 tried to fix the sideways-phone-photo problem with `sharp(buf).rotate().resize(...)` on both `processLogo` and `processPhoto` — `sharp` respects EXIF Orientation when you ask. That code was written and then reverted because phone transfers (AirDrop, iCloud, Send to Photos app, save-to-Downloads) routinely strip the EXIF Orientation tag before the file reaches the PC. Once the tag is gone, `sharp.rotate()` is a no-op. The bug wasn't even reliably reproducible offline.

The pivot was: don't try to detect orientation from metadata that may not be there — ask the user. They're looking at the photo on the phone, they already know. The toggle is a single tap per photo and it makes the cloner's layout intent deterministic.

**Important subtlety — orientation tag is layout intent, not pixel rotation.** The tag tells the cloner *where to place the photo* in the HTML layout; it does not rotate the raw pixels. If the prospect's camera roll holds a photo where the pixels are sideways (true for some Android exports), the deployed site will still show those pixels sideways. Fixing that is either a 6.1 item (re-add `sharp.rotate()` for the happy cases where EXIF survives) or a user-side concern (rotate the photo before upload). Today's guarantee is only "the layout won't stretch a portrait into a wide hero" — not "the photo will always be right-side up."

---

## What changed Phase 5 → Phase 6

**App.** `store.ts` — added `PhotoOrientation` type, extended `Assets` with `photo1Orientation`/`photo2Orientation`, added `setPhotoOrientation` setter, made `setPhoto` clear the slot's orientation on re-upload, bumped persist `version: 3 → 4`. `validation.ts` — `useCanContinue(5)` now also requires both orientations non-null. `Screen5Assets.tsx` — added the two-button segmented toggle below each photo preview (disabled while photo is null, accent-fill on active), updated the subtitle to *"Logo + two photos. Tap each photo's orientation so the layout places it right."* No change to `api.ts` (inherited via `QuizState['assets']`).

**Engine.** `cloner.ts` — added `CloneOptions`, extended `cloneToHtml` signature, added PHOTO PLACEMENT + YEAR sections to the system prompt, fixed the `"EST. YYYY"` literal in DECORATIVE ASSETS, threaded `currentYear` + orientations into `buildUserMessage`. `build.ts` — validates both orientations as exact string values, computes `currentYear = new Date().getFullYear()` once as the single source of truth, routes `currentYear.toString()` to fal.ai and the numeric `currentYear` into `CloneOptions`. `assets.ts` — untouched (the aborted `.rotate()` edit was reverted before Step 2).

**Deploy.** Nothing. Same 7-file Netlify deploys, same `engine.vnoweb.ca` named tunnel, same Cloudflare CNAME. The app bundle needs a redeploy because the store/validation/screen code changed, but the engine side is a drop-in restart.

---

## Known gaps — candidates for Phase 6.1 or later

**Netlify slug double-dash bug.** `netlify.ts` builds `siteName = \`vno-${slug}-${suffix}\`` where `suffix = nanoid(6).toLowerCase()`. `nanoid`'s default alphabet is URL-safe and includes `-` and `_`, so the suffix can start with `-` (producing `vno-the-salon--cd2pb`) or contain `_` (producing something Netlify may reject). Observed during Phase 6 Step 5 smoke: engine returned `vno-the-salon--cd2pb.netlify.app` while the live site resolved at `vno-the-salon-cd2pb.netlify.app`. Fix is one line at the top of `netlify.ts`: `const alphabet = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6)` and swap `nanoid(6)` for `alphabet()`. Underscore-containing suffixes would also go away.

**Orientation tag ≠ pixel rotation.** Called out in the "Why we didn't use EXIF" section above. If a prospect's camera roll has a sideways-pixel photo, today's flow still deploys it sideways — the layout just won't crop a portrait into a hero. Candidate 6.1 fix: re-introduce `sharp(buf).rotate()` in `processPhoto` for the happy case where EXIF survives the transfer (no harm if the tag is missing, `.rotate()` becomes a no-op), and add a "this photo looks sideways — rotate it in Photos first" affordance on Screen 5.

**EST badge text vs. fal.ai badge image.** The cloner's YEAR section tells Claude to write the current year in the `<img alt>` text and any surrounding copy; the fal.ai-generated badge PNG is a separate rendered image containing its own year glyphs. Both get the same year today (`currentYear` flows both ways), but if they ever diverge — e.g. Claude writes `2026` in alt text while fal.ai renders `2025` into the pixels — you'll want to log both sources. No diverge observed yet.

**Carried forward from Phase 5 and still open.** Netlify site cleanup (free tier 500-site cap, no auto-delete); SSE build progress (Screen 7's rotating copy still has no idea where the engine actually is). Neither blocks the pitch.

---

## Acceptance — Phase 6 Step 5 end-to-end smoke

Recorded `2026-04-22`. Salon reference (Serenity Hair) + "The Salon" + `photo1=landscape`, `photo2=portrait`.

| # | Check | Result |
|---|---|---|
| 1 | Engine log line `orientations: photo1=landscape, photo2=portrait` | ✓ |
| 2 | Both orientations accepted by validation | ✓ |
| 3 | Build completed | ✓ (78.4s) |
| 4 | Landscape photo placed as full-width hero | ✓ |
| 5 | Portrait photo placed in a side-section split layout (not stretched) | ✓ |
| 6 | EST badge shows `2026` (not `2024`, not `YYYY`) | ✓ |
| 7 | Copyright footer shows `2026` | ✓ |
| 8 | Wire shape between app and engine clean | ✓ |

Cost: ~$0.11 (one Claude vision clone + three fal.ai decoratives). Same as Phase 5.

---

## Appendix — resolved items to retire from PHASE_5_HANDOFF.md

The Phase 5 handoff's "Known gaps — candidates for Phase 5.1" section listed these; Phase 6 closed the second one and partially addressed the first:

- **iPhone EXIF rotation** — intentionally deferred, replaced by human tagging. The root cause (phone transfers strip EXIF) makes EXIF-only detection unreliable.
- **Hardcoded year in the badge** — resolved. `currentYear` is now the single source routed to both fal.ai and the cloner; the `EST. YYYY` literal in the system prompt is gone.

Phase 5's troubleshooting entry *"Preview hero is a blurry stretched mess"* is now covered by the orientation tag pipeline end-to-end and can be removed from the active-bugs list.
