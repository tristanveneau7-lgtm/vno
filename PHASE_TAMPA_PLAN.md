# Phase Tampa — Part 1: The Art Director

**Status:** Planned, ready for Cowork kickoff.
**Date drafted:** Apr 23, 2026 evening (post-6.+ ship, next morning after planning session).
**Estimated session length:** ~5-7 hours of Cowork work across 6 items, split across 2-3 sittings.
**Estimated cost:** ~$0.50-1.00 in Anthropic credit + ~$0.05-0.10 per test build (fal.ai).
**Six locked decisions (not up for re-litigation):** see `CURRENT_STATE.md` → "Art Director — six decisions locked today". Restated in brief at the top of each item where relevant.

---

## What this phase is

Phase Tampa Part 1 builds the **Art Director** — a new agent that runs once at build time, after the quiz and before the cloner. It reads the same reference the cloner is using, looks at the business + raw photos, and emits a structured JSON decision record that tells the cloner:

- Which photo is hero, which variant of each photo to use (raw / duotone / cutout)
- Where up to 3 **focal ornaments** should go on the page (custom fal.ai illustrations, each a visual event)
- Which **atmospheric marks** (dotted dividers, flourishes, section breaks, grain) the cloner should apply as a CSS texture pass
- Section-level captions and copy framing hints where the reference warrants it

Alongside the Art Director, the cloner gets a prompt upgrade — CSS-atmosphere directives (grain, polaroid frames, italic serif captions, blurred-photo backdrops) — so that when the Art Director says "apply quiet editorial atmosphere," the cloner knows how. Both ship together. One shippable quality leap.

Part 1 is **not** the live design loop. The loop reuses Art Director decisions as state, but the loop itself is Part 2. Part 1 closes the gap from 7/10 → 9+/10 on the first render.

---

## Phase context — why now

Phase 6.+ just shipped and the engine is producing 7-of-10 sites consistently. The remaining gap is not an engineering problem — the cloner is doing fine at shape, layout, and typography — it's a **craft** problem. Real designer-made sites have hand-placed moments: a photo that's been duotoned to match the palette, a custom scribble in the margin, captions in italic serif with a hand-drawn underline, deliberate asymmetry. The cloner can't invent those on its own because it doesn't know which photo deserves the hero slot, which ornament would read as intentional, or when restraint beats ornamentation.

The Art Director is the brain that makes those calls. Anchoring it to the same reference the cloner is using (decision #2) is what keeps the output coherent: one designer's taste governs both structural choices (cloner) and craft choices (art director). The reference is the taste-source. Both agents serve it.

This is the highest-leverage single change we can ship toward the Tampa north-star ("made by a human for THIS business"). Everything downstream — the live loop, voice-driven editing, vertical templates — is better with an Art Director than without. Build it right, once.

---

## How to start the session

Engine + tunnel running, same as Phase 6.+:

```powershell
# Window 1
cd D:\vno\engine
npm start
```

```powershell
# Window 2 (new PowerShell window)
cd D:\vno\engine
cloudflared tunnel --config tunnel/config.yml run vno-engine
```

Open in editor for context:

- `D:\vno\engine\src\lib\cloner.ts` — the existing agent whose prompt we'll extend
- `D:\vno\engine\src\lib\fal.ts` — the existing flux/schnell decorative-generator pattern we'll extend for focal ornaments
- `D:\vno\engine\src\lib\assets.ts` — the existing photo processing pipeline we'll extend for variant generation
- `D:\vno\engine\src\routes\build.ts` — the pipeline entry point we'll re-wire
- `D:\vno\CURRENT_STATE.md` — the six locked decisions, if Cowork asks why

Because this phase touches the build pipeline, commits must go through Windows PowerShell (the sandbox can't write to `.git` — see auto-memory).

---

## Execution order

Items are listed in dependency order. Each item is independently testable and commit-able. Do not skip ahead — Item 3 (the agent) depends on Item 2 (the schema), which depends on Item 1 (knowing what variants exist to choose from).

0. Photo role capture
1. Photo variant pipeline — raw + duotone + cutout
2. Art Director JSON schema — the contract
3. Art Director agent — the call itself
4. Focal ornament generator — fal.ai, up to 3 per build
5. Cloner upgrade — consume AD's JSON, apply CSS atmosphere
6. Isolation harness + end-to-end smoke test

Commit after each item. Do not batch.

---
# Item 0 — Photo role capture on Screen 5 (pre-Tampa, 20-30 min)

**Ships before Item 1.** Prerequisite for the Art Director.

### Why this item exists

Tristan's standard pitch-prep process produces 4 photos with known semantic roles: logo (pulled manually from Google), outside-of-location (iPhone), inside-of-location (iPhone), and a hero/feature shot (iPhone — owner, signature service, product detail — varies by business).

Giving the Art Director labeled photos instead of mystery pixels is the highest-leverage ~30-minute change we can make before Tampa starts. A labeled "inside" photo gets treated differently from a labeled "hero" photo differently from a labeled "logo." Without labels, the AD has to guess from pixel content, and it will guess wrong often enough to visibly degrade the output.

Positional convention (photo 1 = outside, photo 2 = inside, etc.) is the other option considered and rejected: brittle the first time the capture order changes, and this whole product's supposed to tolerate real-world-messy input.

### Relevant locked decision

None from the Six — this is a late-discovered prereq surfaced during plan review. But it serves decision #2 (same reference governs taste) by giving the Art Director enough context to actually execute on that directive.

### Architecture overview

Screen 5 today has a generic photo upload grid. We replace it with four labeled slots, each with its own upload/camera button and its own preview. Photos flow through the store and BuildPayload carrying a `role` field. Engine validates the new shape and propagates role into each processed photo record for downstream consumption by the Art Director.

The existing orientation toggle (portrait/landscape) stays per-slot — it's still useful layout data.

Nothing about the variant pipeline, the cloner, or the existing cloner's photo handling changes in this item. This is pure upstream plumbing.

### Cowork kickoff (paste verbatim)

> Phase Tampa Part 1, Item 0 — labeled photo upload slots on Screen 5 with role propagation to the engine.
>
> **Why:** The Art Director (Item 3 later) makes substantially better decisions when photos carry semantic roles instead of being mystery pixels. Tristan's standard pitch-prep process produces 4 photos with known roles (logo, outside, inside, hero/feature), so capturing the role is trivial UX work that pays off throughout Phase Tampa.
>
> **Scope:**
>
> 1. **`app/src/routes/Screen5Assets.tsx`** — replace the generic photo upload grid with 4 labeled slots:
>    - **Logo** (required) — "Paste or upload the business's logo. Usually grabbed from Google manually."
>    - **Outside** (recommended) — "Exterior shot of the shop, building, or signage."
>    - **Inside** (recommended) — "Interior shot — where customers spend time."
>    - **Hero / Feature** (optional) — "Owner, signature service, or the thing that best represents this business."
>
>    Each slot:
>    - Has its own camera/upload button
>    - Has its own preview thumbnail
>    - Has its own remove button
>    - Keeps the existing orientation toggle (portrait/landscape) underneath the preview
>
>    Labels render above each slot. Layout: stacked vertically on mobile (they're tall slots with orientation toggles), or 2×2 grid if viewport permits.
>
> 2. **`app/src/lib/store.ts`** — update the photos representation to carry role. Two options, your call based on which is less refactor:
>    - Object-shaped: `photos: { logo, outside, inside, hero }` where each is `Photo | null`
>    - Array-shaped: keep `photos: Photo[]` but add `role: 'logo' | 'outside' | 'inside' | 'hero'` to the `Photo` type
>
>    Bump persist version 5 → 6. Old persisted state without roles can be dropped (we're pre-prod, no user data loss concern).
>
> 3. **`app/src/lib/validation.ts`** — update `useCanContinue(5)`:
>    - Logo is required
>    - At least 2 of {outside, inside, hero} must be present
>    - Brand color (from Phase 6.+ #2.1) requirement still applies
>
> 4. **`app/src/lib/api.ts`** — ensure `BuildPayload` carries role per photo. If you went object-shaped in step 2, flatten to array with role field at the API boundary (engine doesn't need to know about the app's object shape).
>
> 5. **`engine/src/routes/build.ts`** — validate each photo has a valid role (`'logo' | 'outside' | 'inside' | 'hero'`). Pass role into `processPhoto` so it's attached to the photo record on the way through.
>
> 6. **`engine/src/lib/assets.ts`** — update the photo record type to include `role`. No processing change yet — the role is just carried along for Item 3 to consume later.
>
> **Out of scope:**
> - Actually using the role field in any decision-making. That happens in Item 3 when the Art Director consumes it.
> - Variant generation (Item 1). Keep them separate commits.
> - Any special handling for logos (e.g. skipping cutout because logos are already cutouts). Nice idea, add to backlog if not tackled in Item 1.
>
> **Execution order, pause + summary after each step:**
> - Step 1: Store + Photo type update (object or array+role)
> - Step 2: Screen 5 UI refactor to 4 labeled slots
> - Step 3: Validation + api.ts wire
> - Step 4: Engine build.ts validation + assets.ts type update
> - Step 5: Typecheck both sides + app `npm run build`
>
> Smoke test by Tristan on phone after you ping me for Step 5 complete.

### Verification

Rebuild app + redeploy + pull-to-refresh PWA + restart engine. Then:

1. On Screen 5, see 4 labeled slots instead of generic grid
2. Upload a logo → slot populates with preview, orientation toggle stays available
3. Try to Continue with only logo + 1 other → button stays locked
4. Upload logo + outside + inside → Continue enables
5. Add hero too → Continue stays enabled
6. Remove one photo → correct slot clears, Continue re-evaluates
7. Build → engine logs show each photo with its role attached
8. Deployed site still looks like pre-Tampa output (no visible change — we haven't consumed the role yet, by design)

### Acceptance

- 4 labeled slots render cleanly on iPhone
- Each slot uploads/previews/removes independently
- Continue requires logo + 2 of {outside, inside, hero}
- Brand color requirement from Phase 6.+ still enforced
- Role field appears in engine build logs for each photo
- Typecheck clean both sides
- Deployed site from a test build looks identical to a pre-Item-0 build (proves we didn't accidentally change anything downstream)

### Commit

```powershell
git add app/src engine/src/routes engine/src/lib/assets.ts
git commit -m "Phase Tampa #0: labeled photo slots (logo/outside/inside/hero) with role propagation"
git push
```

---

## Downstream impact on the rest of the plan

**Item 1 (variant pipeline)** gains a small optimization: skip cutout generation for photos with `role === 'logo'` because logos typically already have transparent/clean backgrounds. Duotone on a logo rarely helps either. For logos, the `variants` record can be `{ raw, raw, raw }` (all three fields point to the raw processed logo) as a cheap passthrough. Cowork's call during Item 1 implementation.

**Item 2 (schema)** doesn't need to change — the Art Director's schema doesn't reference photo roles directly. Roles live on the input photo records, not the decision record.

**Item 3 (agent)** gets meaningfully better. The system prompt's user message builder now labels each photo: `Photo ${i} (role: ${role})` instead of just `Photo ${i}`. The AD's placement decisions become sharper because it knows "this is the interior" vs "this is the owner" vs "this is the storefront."

**Items 4-6** unchanged.

---

## Renumbering note

The existing plan has Items 1-6. This inserts Item 0 at the front. Execution order becomes:

0. Photo role capture (new)
1. Photo variant pipeline
2. Art Director JSON schema
3. Art Director agent
4. Focal ornament generator
5. Cloner upgrade + build.ts re-wire
6. Isolation harness + smoke test

Seven items total. Time estimate bumps from 5-7 hours to 5.5-7.5 hours.


## Item 1 — Photo variant pipeline (45-60 min)

### Relevant locked decision

**#3: Generate full variant set per photo, up front.** Raw + duotone + cutout for each uploaded photo. Cost is not a constraint. Variants are cached so the (future) loop can swap cheaply.

### Architecture overview

For each photo the user uploads, produce three variants and attach their URLs (or buffers, depending on the existing pipeline) to the photo record:

- **Raw** — the existing processed photo (already done today; reuse `processPhoto` output). This is variant 0.
- **Duotone** — a two-color mapping of the photo. The two colors come from the brand palette (primary + secondary, introduced in Phase 6.+ #2.1). Sharp-native; no external model call.
- **Cutout** — the photo with its background removed. Almost certainly a model call; `sharp` cannot do semantic segmentation. Cowork picks the provider (fal.ai birefnet / rembg / similar) and documents their choice.

Variants are generated unconditionally for every uploaded photo at build time. The Art Director (Item 3) later picks which variant to use per slot; unused variants sit cached and cost nothing to have around.

### Flag for Cowork

Decision #6 says the sharp-vs-fal.ai split is Cowork's call during build. Duotone and raw are trivially sharp. Cutout is genuinely ambiguous and deserves a benchmarked choice — please don't punt it. If fal.ai has a birefnet-equivalent endpoint that returns a clean alpha channel in <3s at <$0.01/call, use it. If not, note the alternative and why.

### Cowork kickoff (paste verbatim)

> Phase Tampa Part 1, Item 1 — Photo variant pipeline. For each photo the user uploads, produce three variants at build time and attach them to the photo record: raw, duotone, cutout.
>
> **Scope:**
>
> 1. **`engine/src/lib/assets.ts`** — extend `processPhoto` (or add a sibling function, your call) to emit a `PhotoVariants` record per photo:
>    ```ts
>    interface PhotoVariants {
>      raw: string      // data URL or hosted URL — whatever matches the existing pipeline
>      duotone: string
>      cutout: string
>    }
>    ```
>    The photo record that flows through to the cloner should carry `variants: PhotoVariants` alongside whatever it already carries (orientation, dimensions, etc.).
>
> 2. **Duotone** — Sharp-native. Map luminance onto a gradient between the brand palette's primary and secondary colors (both already captured in Phase 6.+ #2.1 and available on the build payload). A simple `.tint()` + `.modulate()` chain will not give a true duotone; use `.recomb()` with a luminance matrix or `.linear()` per channel to map highlights → primary and shadows → secondary. Prototype a couple of approaches on a test photo and pick the one that reads cleanly.
>
> 3. **Cutout** — background removal. Sharp cannot do this. Benchmark: (a) fal.ai's birefnet-v2 or equivalent segmentation endpoint, (b) `@imgly/background-removal-node` or similar WASM-based local model. Criteria: clean alpha around hair/edges, <3s per photo, <$0.02 per photo. Pick one, document your pick and why in a single-line code comment. If you pick fal.ai, extend `engine/src/lib/fal.ts` with a `removeBackground(buf)` function that mirrors the existing `generateImage` pattern.
>
> 4. **Build integration** — the existing build route processes N photos in parallel via `Promise.all`. Variant generation should also parallelize per photo and across photos. Three variants × N photos = 3N model/sharp calls total, all in flight at once. Target: variant pipeline adds <5s to a build with 4 photos.
>
> 5. **Type surface** — update `BuildPayload`, `CloneOptions`, and any intermediate DTOs so the variants flow through. Don't invent a new abstraction — add the `variants` field to the existing photo shape wherever it currently lives.
>
> **Execution order, pause + summary after each step:**
> - Step 1: `PhotoVariants` type + extend `processPhoto` stub (returns raw in all three fields for now)
> - Step 2: Real duotone implementation, replace stub
> - Step 3: Cutout — benchmark, pick provider, implement, replace stub
> - Step 4: Wire variants through `BuildPayload` → `CloneOptions` so downstream can access them
> - Step 5: Typecheck + a quick CLI test (see verification below)
>
> **Out of scope for this item:** the cloner doesn't consume variants yet — that's Item 5. For now, the field exists and the cloner ignores it. We want the data plumbing in place before the agent (Item 3) starts making decisions against it.

### Verification

A small CLI script — `engine/scripts/variant-smoke.ts` (Cowork can drop this in) — that takes one JPG path + primary/secondary hex, runs the variant pipeline, and writes `out-raw.jpg`, `out-duotone.jpg`, `out-cutout.png` to a temp folder. Open all three and eyeball them:

- Raw matches the input
- Duotone reads as a clean two-color mapping — no muddy mid-tones, primary in highlights, secondary in shadows
- Cutout has a clean alpha around the subject — hair and edges shouldn't look shredded

### Acceptance

- Three variants produced per photo on every build
- Build-time overhead <5s added for a 4-photo build
- Duotone uses the prospect's actual palette, not a hardcoded pair
- Cutout choice (fal.ai vs local) is documented in a code comment with the benchmark reasoning
- Typecheck clean on `engine/`

### Commit

```powershell
git add engine/src/lib/assets.ts engine/src/lib/fal.ts engine/scripts/variant-smoke.ts engine/src/types
git commit -m "Phase Tampa #1: photo variant pipeline (raw/duotone/cutout) per photo at build time"
git push
```

---

## Item 2 — Art Director JSON schema (30-45 min)

### Relevant locked decision

**#4: Output is a JSON decision record, not prose.** Structured decisions: hero photo + variant, ornament placements, caption text, atmospheric directives. Diffable for the future loop, unambiguous for the cloner.

### Why schema first

Everything in Items 3-5 keys off this schema. Drafting it as a standalone deliverable — before writing agent code, before touching the cloner — forces us to be explicit about what decisions the Art Director is allowed to make and what the cloner is expected to render against. If the schema is wrong, every downstream item bends to cover the gap. Lock it first.

### What the schema needs to express

- **Hero decision** — which photo id is hero, which variant, which layout slot (above-fold full-bleed vs split vs polaroid-corner etc.)
- **Photo placements** — for each remaining photo: section, slot, variant, optional caption
- **Focal ornaments (≤3)** — each with: placement anchor (section + position), intent one-liner (what it's doing for the page), fal.ai prompt (what to generate), target size
- **Atmospheric directives** — a small structured set: grain level (none/subtle/strong), divider style (none/hairline/dotted/flourish), caption style (none/italic-serif/handwritten), backdrop (clean/blurred-photo/paper-texture), plus a free-form `notes` field
- **Section-level copy** — optional caption/subhead per section where the AD wants to direct the cloner's tone
- **Meta** — reference id used, business snapshot hash, timestamp, agent version, a `confidence` field per decision (0-1) to inform the future loop's "what to revisit" picker

### Cowork kickoff (paste verbatim)

> Phase Tampa Part 1, Item 2 — Art Director output schema. Produce a single TypeScript module at `engine/src/types/artDirector.ts` that defines the shape of the decision record the Art Director agent emits. This file is pure types + a `zod` schema for runtime validation. No logic. No agent code. No cloner changes.
>
> **Deliverables:**
>
> 1. `engine/src/types/artDirector.ts` with:
>    - `ArtDirectorDecision` type and matching `artDirectorSchema` (zod)
>    - `HeroDecision`, `PhotoPlacement`, `FocalOrnament`, `AtmosphericDirectives`, `SectionCopy` sub-types
>    - `ArtDirectorMeta` carrying `{ referenceId, businessHash, version, createdAt, confidence: Record<string, number> }`
>
> 2. The schema must be strict enough that an LLM producing JSON against it can't wander — enum the fixed vocabularies (grain level, divider style, caption style, backdrop) rather than leaving them as free-form strings. Free-form is reserved for prompts (focal ornament prompts), section copy text, and the `notes` field on atmospheric directives.
>
> 3. Include a JSDoc comment on each field describing what the cloner is expected to do with it. These comments become part of the Art Director's system prompt in Item 3 — they're doubling as documentation for both humans and the agent.
>
> 4. Include a `SAMPLE_DECISION` const at the bottom — a fully-populated example based on a hypothetical build ("Tidescape reference + fictional coastal coffee shop with 4 photos"). This serves as (a) a sanity check that the schema is expressive enough, (b) a few-shot example for the agent's prompt in Item 3.
>
> **Constraints to build into the schema:**
>
> - `focalOrnaments: FocalOrnament[]` — max length 3, enforced via `.max(3)` on the zod array.
> - `photoPlacements: PhotoPlacement[]` — length must equal the number of non-hero photos.
> - Every `PhotoPlacement.photoId` and `HeroDecision.photoId` must be unique across the record (no photo used twice; the AD must pick one slot per photo). Enforced via a zod refinement.
> - `atmosphericDirectives.grain`, `.divider`, `.captionStyle`, `.backdrop` are enums, not strings.
> - `meta.version` is a literal string — start at `"art-director-v1"` so future prompt revisions are explicit.
>
> **Execution order:** single pass. Write the types, the zod schema, the sample, and a quick test that `artDirectorSchema.parse(SAMPLE_DECISION)` succeeds. Typecheck + lint. Pause for review before Item 3.

### Verification

I review the schema file end-to-end. Specifically I'm checking:

- Is every decision the Art Director might want to make expressible in this shape, without forcing it to stuff intent into a free-form `notes` field? (If yes, schema is expressive enough. If no, we're under-specifying and the agent will drift.)
- Can the cloner render a complete page from this record alone? (If there's any field the cloner would need but isn't in the schema, add it.)
- Is the sample record something I'd actually be happy with if the Art Director produced it verbatim? (If not, what's missing tells us what's missing from the schema.)

### Acceptance

- Schema file parses cleanly with zod
- Sample record validates against the schema
- I've read the file end-to-end and signed off
- No logic in the file other than the schema + sample + a one-line runtime validation test

### Commit

```powershell
git add engine/src/types/artDirector.ts
git commit -m "Phase Tampa #2: Art Director decision record schema + sample"
git push
```

---

## Item 3 — Art Director agent (1.5-2 hours)

### Relevant locked decisions

**#1: One new agent, not a split.** Same brain decides photo treatments AND ornaments — splitting them would Frankenstein the output.
**#2: Same reference as the cloner.** One coherent designer's taste governs both agents.
**#4: Output is a JSON decision record.**

### Architecture overview

A new module `engine/src/lib/artDirector.ts` exports a single function:

```ts
export async function runArtDirector(input: ArtDirectorInput): Promise<ArtDirectorDecision>
```

Inputs:

- The reference (id + URL + any existing metadata) — **same reference the cloner is using**
- The business snapshot (name, vertical, location, about copy, service list — whatever the quiz captured)
- The photos with their variants attached (output of Item 1)
- The brand palette (primary/secondary/accent, from Phase 6.+ #2.1)

The function:

1. Builds a system prompt that (a) explains the Art Director's role, (b) embeds the schema's JSDoc comments as field-by-field guidance, (c) states the "what would the designer who made this reference do with these raw photos and this business?" mental model verbatim.
2. Builds a user message with the reference URL, reference screenshot (passed as vision input), business snapshot, photo URLs + variant URLs (vision inputs), and palette.
3. Calls Claude with structured-output JSON mode anchored to `artDirectorSchema`.
4. Validates the response with zod. Throws a descriptive error on failure — the build route's existing error handling surfaces it.
5. Returns the validated `ArtDirectorDecision`.

### Design principles baked into the prompt

- Reference is the taste-source. "Match the reference's restraint-to-ornamentation ratio" is the core directive.
- Scarcity drives intent. Focal ornaments are scarce by design (max 3) — the prompt should push the agent toward using fewer, not toward maxing out every build.
- Atmosphere is free. Atmospheric marks are cheap to apply, and a quiet editorial reference wants *many* small marks, not few.
- No invention without anchor. The agent should not pick a treatment or ornament that isn't visually justified by the reference.

### Cowork kickoff (paste verbatim)

> Phase Tampa Part 1, Item 3 — Art Director agent. New module: `engine/src/lib/artDirector.ts`. Single exported function `runArtDirector(input): Promise<ArtDirectorDecision>`. Uses the schema from Item 2.
>
> **Scope:**
>
> 1. **Inputs.** Define `ArtDirectorInput` as:
>    ```ts
>    interface ArtDirectorInput {
>      reference: { id: string; url: string; screenshotUrl: string; notes?: string }
>      business: BusinessSnapshot  // reuse the existing type from build.ts
>      photos: PhotoWithVariants[]  // output of Item 1
>      palette: { primary: string; secondary: string; accent: string }
>    }
>    ```
>
> 2. **System prompt.** ~800-1500 words. Sections:
>    - "Who you are" — art director for a small-business landing page. Your taste is anchored entirely to the reference provided.
>    - "What you're doing" — producing a JSON decision record that a renderer (cloner) will execute against. You do not render. You direct.
>    - "The mental model" — quote verbatim from CURRENT_STATE.md: "what would the designer who made this reference do with these raw photos and this business?"
>    - "Scarcity and atmosphere" — ornament budget rules. Quote the locked decision #5 verbatim (focal ≤3, atmospheric unlimited, reference DNA dictates mix).
>    - "Output contract" — paste the schema's JSDoc comments inline as field-by-field instructions.
>    - "Forbidden" — do NOT invent ornaments unmoored from the reference; do NOT use every photo as hero; do NOT exceed 3 focal ornaments; do NOT emit fields not in the schema.
>
> 3. **User message.** Structured as a multi-part content array:
>    - Text: business snapshot (name, vertical, location, services, about copy)
>    - Text: palette hex values
>    - Image: reference screenshot, labeled "REFERENCE — your taste source"
>    - For each photo: image of the raw variant, labeled `Photo ${i} (raw)` + one-line intent hint ("wide landscape of shop exterior" etc. if the quiz captured this). Variants other than raw are not shown to the agent — it picks variants by name from the schema enum, trusting that the cloner has all three cached.
>
> 4. **Model + call pattern.** Use Claude Sonnet (not Opus — latency matters, Sonnet is plenty for this) via the existing Anthropic SDK already wired into cloner.ts. Structured output mode pointed at `artDirectorSchema`. Temperature 0.7 (some creative variance is desirable; 0 makes it mechanical). Max tokens 4096.
>
> 5. **Validation + retry.** On `artDirectorSchema.parse` failure, retry once with a message appended: "Your previous response failed validation with: {zod error}. Emit a record matching the schema exactly." If the second attempt also fails, throw — do not ship a degraded record to the cloner.
>
> 6. **Logging.** Log (a) the input hash, (b) the raw response, (c) validation result. We'll want this when Item 6's smoke test flags bad outputs.
>
> **Out of scope for this item:** wiring the agent into the build route (that's Item 5 — it's bundled with the cloner upgrade because those two changes are the same "make the build pipeline use this" step). For this item, the agent is reachable via the isolation harness (Item 6) but not the production build.
>
> **Execution order, pause + summary after each step:**
> - Step 1: Module scaffold + `ArtDirectorInput` type + empty function that throws NotImplemented
> - Step 2: System prompt drafted (a full version, no placeholders)
> - Step 3: User message builder (multi-part content array)
> - Step 4: Claude call + schema-validated response + retry
> - Step 5: Logging
> - Step 6: Typecheck + unit test with a hardcoded sample input that mocks the Anthropic client

### Verification

Two checks before signing off Item 3:

1. **Read the system prompt.** Print it to a file — `engine/artDirector-systemPrompt.txt` — and read it top to bottom. Every sentence should either (a) describe the role, (b) direct a specific schema field, or (c) forbid a specific failure mode. If a sentence does none of those, cut it.
2. **Run it once in mock mode.** Unit test stubs the Anthropic call to return `SAMPLE_DECISION` (from Item 2). Real validation happens. Structural flow is exercised. No real API spend.

Real end-to-end invocation happens in Item 6.

### Acceptance

- `runArtDirector` compiles and typechecks against the Item 2 schema
- System prompt is committed to a plain-text file alongside the module (for readability and version review)
- Unit test with mocked Anthropic client passes
- Zod validation failure triggers one retry, then throws — verified via a second unit test that mocks an invalid response

### Commit

```powershell
git add engine/src/lib/artDirector.ts engine/src/lib/artDirector-systemPrompt.txt engine/src/__tests__/artDirector.test.ts
git commit -m "Phase Tampa #3: Art Director agent (prompt + call + zod-validated output)"
git push
```

---

## Item 4 — Focal ornament generator (45-60 min)

### Relevant locked decision

**#5 (focal half):** Up to 3 fal.ai-generated ornaments per page. Each one is a visual event; scarcity is what makes them feel intentional.

### Architecture overview

The Art Director emits `focalOrnaments: FocalOrnament[]` with prompts. This item generates the actual PNGs via fal.ai and attaches their URLs back onto the decision record before it's handed to the cloner.

New function in `engine/src/lib/fal.ts` (extending the existing decorative generation pattern):

```ts
export async function generateFocalOrnaments(
  ornaments: FocalOrnament[]
): Promise<FocalOrnamentWithUrl[]>
```

Runs up to 3 flux/schnell calls in parallel. Returns each ornament augmented with `imageUrl`. Failures per-ornament are tolerated: if one of the three fails, the other two still ship and the cloner renders without the failed one (logging the failure).

### Cowork kickoff (paste verbatim)

> Phase Tampa Part 1, Item 4 — focal ornament generator. Extend `engine/src/lib/fal.ts` with a function that turns the Art Director's `focalOrnaments` array into an array of the same ornaments with resolved image URLs.
>
> **Scope:**
>
> 1. **New function:**
>    ```ts
>    export async function generateFocalOrnaments(
>      ornaments: FocalOrnament[]
>    ): Promise<FocalOrnamentWithUrl[]>
>    ```
>    where `FocalOrnamentWithUrl = FocalOrnament & { imageUrl: string; generationFailed?: false } | FocalOrnament & { imageUrl: null; generationFailed: true; error: string }`.
>
> 2. **Parallel execution.** All ornaments (up to 3) run at once via `Promise.allSettled`. Per-ornament failure is logged and marked on the returned record; it does not fail the whole call.
>
> 3. **Prompt wrapping.** The `FocalOrnament.prompt` field is trusted verbatim (it came from the Art Director, which has already been prompted for good fal-ready prompts). Do not prepend or append framing — the AD's prompt is the prompt. Image size comes from `FocalOrnament.targetSize` (enum: `wide`, `square`, `tall` → map to 1024×512, 1024×1024, 512×1024).
>
> 4. **Safety checker.** Disabled, matching the existing decorative pattern (these are abstract illustrations, not photos).
>
> 5. **Call site.** Not wired yet — Item 5 does the wiring. For this item, just export the function and unit-test it with a mock fal client.
>
> **Out of scope:** atmospheric marks. Those are CSS/SVG produced by the cloner at render time, not fal.ai calls.
>
> **Execution order:** single pass. Function + type + unit test. Typecheck. Pause.

### Verification

Unit test with mocked fal client:

- 3 successful ornaments → 3 records with `imageUrl`
- 1 failure among 3 → 2 success records + 1 failure record, function returns successfully
- 3 failures → returns 3 failure records, function still returns successfully (the cloner decides what to do)

One live run against fal.ai with hardcoded prompts (a temporary CLI script, not committed) to confirm the integration works end-to-end. Spot check: do the generated images actually look like ornaments, or is flux/schnell choking on the AD-style prompts? If the latter, the AD's prompt guidance in Item 3's system prompt needs a revision — flag it, do not paper over it.

### Acceptance

- Function compiles and exports
- Unit tests pass for success, partial failure, total failure
- One live run produced visible ornaments that matched the prompts
- Cost per call observed + documented (expected: ~$0.003 × 3 = ~$0.01 per build)

### Commit

```powershell
git add engine/src/lib/fal.ts engine/src/__tests__/fal.test.ts
git commit -m "Phase Tampa #4: focal ornament generator (up to 3 fal.ai illustrations per build)"
git push
```

---

## Item 5 — Cloner upgrade: consume AD decisions + CSS atmosphere pass (1.5-2 hours)

### Relevant locked decisions

**#1:** Art Director runs before cloner. Cloner is downstream.
**#4:** Cloner consumes JSON, not prose.
**#5 (atmospheric half):** Atmospheric marks are CSS/inline SVG the cloner writes — effectively free, bounded only by taste. Reference DNA dictates the mix.

### Architecture overview

Two coupled changes to `engine/src/lib/cloner.ts`:

1. **Consume the decision record.** `CloneOptions` gains `artDirection: ArtDirectorDecision`. The system prompt gains a new section that tells the cloner how to interpret each field (hero → full-bleed above-fold; focal ornaments → absolutely-positioned against their anchor; atmospheric directives → CSS texture pass).
2. **CSS atmosphere upgrade.** Independent of the Art Director's directives, the cloner's prompt gets a new "TEXTURE" section that teaches it how to produce the atmospheric primitives: grain (noise SVG filter), polaroid frames (CSS `box-shadow` + `transform`), italic serif captions (font-stack + `text-decoration-style: wavy` or hand-drawn underline SVG), blurred-photo backdrops (`filter: blur()` + absolute positioning), dotted dividers (inline SVG). This is "the cloner should just be better at this," not a new agent — bundled here because it's the same prompt file.

Plus, the build route (`engine/src/routes/build.ts`) gets re-wired:

```
Quiz payload → validate → processPhoto (×N, Item 1 variants) → runArtDirector (Item 3) → generateFocalOrnaments (Item 4) → cloneToHtml (this item) → deploy
```

### Cowork kickoff (paste verbatim)

> Phase Tampa Part 1, Item 5 — Cloner upgrade. Two coupled changes to `engine/src/lib/cloner.ts` plus a re-wire of `engine/src/routes/build.ts` to run the new pipeline stages in order.
>
> **Part A — CloneOptions + prompt: consume AD decisions.**
>
> 1. `CloneOptions` gains `artDirection: ArtDirectorDecision`. Existing fields stay.
> 2. System prompt gains a new section, **ART DIRECTION**, placed after the existing PALETTE section and before TEXTURE (part B). It tells the cloner:
>    - The `artDirection` field is a decision record from an upstream art director. Honor it exactly.
>    - `hero` specifies which photo + variant + slot. Render the hero accordingly.
>    - `photoPlacements` specifies each remaining photo's section, slot, variant, and optional caption. Render each photo in the specified variant — the variant URL is on the photo record, just use it.
>    - `focalOrnaments` specifies up to 3 generated illustrations (the `imageUrl` is already resolved). Place each one at its anchor with the intent described. Do not add more ornaments. Do not skip a specified ornament unless `generationFailed: true`.
>    - `atmosphericDirectives` specifies grain/divider/caption/backdrop vocab. Apply as CSS in the atmosphere pass.
>    - `sectionCopy` specifies optional per-section captions and subheads. Use them verbatim where provided; write your own otherwise.
> 3. User message gains a JSON-serialized `artDirection` block at the end, clearly delimited.
>
> **Part B — TEXTURE section added to system prompt.**
>
> A new section teaching the cloner how to produce the atmospheric primitives referenced by `atmosphericDirectives`. Sections:
> - **Grain** — when level is subtle/strong, include an SVG noise filter applied at low opacity over the body. Provide the exact SVG + CSS snippet in the prompt so the cloner has a reference implementation. None means no filter.
> - **Dividers** — hairline (1px solid), dotted (CSS `border-top: 1px dotted`), flourish (small inline SVG — provide one example). None means no section dividers; use whitespace.
> - **Caption style** — none (no captions), italic-serif (provide font-stack example + optional underline SVG), handwritten (Kalam / Caveat or similar via Google Fonts).
> - **Backdrop** — clean (white/cream), blurred-photo (one of the uploaded photos at high blur as a section backdrop), paper-texture (SVG noise + warm tint).
>
> Emphasize: **the cloner should default to restraint.** Atmospheric marks are free to apply but easy to overuse. If the reference looks quiet and editorial, apply atmosphere sparingly — a single dotted divider between sections, italic serif captions under photos, no grain. If the reference is warm/handmade, apply more freely — paper backdrop, wavy underlines, grain, flourishes.
>
> **Part C — build.ts re-wire.**
>
> Update `engine/src/routes/build.ts`:
>
> ```
> validate payload
>   → processPhoto (per photo, emits variants) — Item 1
>   → runArtDirector(reference, business, photos, palette) — Item 3
>   → generateFocalOrnaments(decision.focalOrnaments) — Item 4
>   → merge ornament URLs back into decision
>   → cloneToHtml({ ...existingOptions, artDirection: decision }) — this item
>   → deploy to Netlify (existing)
> ```
>
> Each stage logs duration. Target end-to-end: <30s for a 4-photo build.
>
> **Execution order, pause + summary after each step:**
> - Step 1: `CloneOptions` extended + ART DIRECTION section added to system prompt. Don't touch build.ts yet.
> - Step 2: TEXTURE section added. Verify with a dry-run against a saved `SAMPLE_DECISION`.
> - Step 3: User message builder updated to serialize `artDirection`.
> - Step 4: build.ts re-wired. All prior stages stay, new stages slot in where the diagram says.
> - Step 5: Typecheck + existing cloner tests still pass + a new test that the prompt contains ART DIRECTION and TEXTURE sections.
>
> **Do not** change cloner temperature, model, or retry logic in this item. Prompt-only changes.

### Verification

- Read the full updated system prompt end-to-end. It should tell a coherent story: who you are → palette → art direction → texture → output format. No orphan sections.
- Trigger a build end-to-end on the staging engine with a known reference + business + real photos. The deployed site should (a) use a non-raw variant for at least one photo (proving the cloner is honoring `photoPlacements.variant`), (b) render at least one focal ornament if the AD specified any, (c) show visible atmospheric treatment consistent with the AD's directives (grain / dividers / captions).
- If the deployed site ignores AD decisions and looks like a pre-Tampa build, the prompt is not landing. Debug by printing the exact user message sent to the cloner and the full response. Do not ship until AD decisions are visibly honored.

### Acceptance

- `cloneToHtml` compiles against the new `CloneOptions`
- Existing cloner tests still pass
- New prompt-structure test passes
- One end-to-end build on staging produces a site that visibly reflects the AD's decisions
- End-to-end duration <30s for a 4-photo build

### Commit

```powershell
git add engine/src/lib/cloner.ts engine/src/routes/build.ts engine/src/__tests__/cloner.test.ts
git commit -m "Phase Tampa #5: cloner consumes Art Director decisions + CSS atmosphere pass"
git push
```

---

## Item 6 — Isolation harness + end-to-end smoke test (45-60 min)

### Why this item exists

Before declaring Phase Tampa Part 1 shipped, we need to know the Art Director is actually making good calls, not just structurally-valid calls. Schema validation proves the record parses; it doesn't prove the record is *right*. The only way to know "right" is to run the agent on a fixed test case, read the JSON, compare to the reference, and judge.

### Architecture overview

Two pieces:

1. **Isolation harness** — `engine/scripts/art-director-harness.ts`. Takes a reference id + a fixture business + fixture photos from a committed `engine/fixtures/` folder. Runs `runArtDirector` only (no ornament generation, no cloner, no deploy). Writes the decision record to stdout + a file. Lets us iterate on the agent prompt in isolation.
2. **End-to-end smoke test** — full pipeline run on a designated "signal" test case. Picked to maximize Tampa-signal: a reference whose craft is visibly distinctive (suggest: `tidescape` or `bistora` — whichever has the strongest handmade/editorial DNA), combined with a fixture coastal-coffee or artisan-bakery business. Do we see a visible quality jump from 7 → 9?

### Flag for review

The smoke test is a judgment call. I'm the judge. If the site looks generic — "AI rendered from template" — the agent isn't working and we don't ship Part 1. We iterate on the prompt and re-test. Budget for 2-3 iteration rounds before declaring ship-ready.

### Cowork kickoff (paste verbatim)

> Phase Tampa Part 1, Item 6 — isolation harness + smoke test fixtures.
>
> **Scope:**
>
> 1. **`engine/scripts/art-director-harness.ts`** — CLI entry:
>    ```
>    npx tsx engine/scripts/art-director-harness.ts --reference tidescape --business fixtures/businesses/coastal-coffee.json
>    ```
>    Loads the reference + business + photos (from fixtures), calls `runArtDirector`, pretty-prints the decision record, writes it to `./ad-out.json`. No deploy, no cloner, no fal.ai.
>
> 2. **Fixtures:**
>    - `engine/fixtures/businesses/coastal-coffee.json` — realistic business snapshot (name, vertical, about copy, services)
>    - `engine/fixtures/businesses/artisan-bakery.json` — second realistic business
>    - `engine/fixtures/photos/` — 4-6 real photos per fixture business, committed as small JPGs (<200KB each to keep the repo light)
>
> 3. **Smoke-test docs** — a short `engine/fixtures/README.md` explaining how to run the harness and what each fixture is for.
>
> **Out of scope:** automating the judgment. I do that by eye.

### Verification — the judgment session

This one's mine, not Cowork's. Process:

1. Run the harness with `--reference tidescape --business coastal-coffee`. Read the JSON top to bottom.
   - Is the hero photo the right choice?
   - Are the focal ornaments coherent with the reference's style? If tidescape is quiet and editorial, are we seeing ≤1 focal ornament? Or is the AD overspending?
   - Do the atmospheric directives match the reference's mood?
   - Are the section captions in the right voice?
2. Run with `--reference bistora --business artisan-bakery`. Same questions. Different expected answers (bistora is warmer; expect more ornaments).
3. Swap fixtures against references. Tidescape + artisan-bakery, bistora + coastal-coffee. Does the AD adapt, or does it produce near-identical outputs regardless of business?
4. Full end-to-end build for the first pair. Deploy. Compare the deployed site to the reference side-by-side.

If steps 1-3 look right and step 4 looks like a visible 7 → 9 jump, ship. If not, iterate on the system prompt (Item 3) and re-run. Budget 2-3 rounds.

### Acceptance

- Harness runs and produces a validated decision record in <15s
- Two fixtures committed with realistic businesses and photos
- I've run the harness against both fixtures + both references (4 combinations) and judged the output acceptable
- One end-to-end build completes and looks like a visible Tampa-quality jump over pre-Tampa builds
- If the jump isn't there, the plan says so and Phase Tampa Part 1 does *not* ship — we iterate

### Commit

```powershell
git add engine/scripts/art-director-harness.ts engine/fixtures/
git commit -m "Phase Tampa #6: Art Director isolation harness + smoke-test fixtures"
git push
```

---

## End-of-session checklist

When Items 1-6 are all shipped:

- [ ] `git status` shows clean working tree on `main`
- [ ] Six commits, one per item, pushed to GitHub
- [ ] Engine + tunnel still running, no errors in logs
- [ ] `runArtDirector` callable via harness, producing validated records
- [ ] End-to-end build produces a site where AD decisions are visibly honored
- [ ] Smoke test passed on ≥2 reference × business combinations
- [ ] Cost per build measured and documented (expected: ~$0.05-0.10 = AD call ~$0.03 + 3 ornaments ~$0.01 + cutout ×N ~$0.02 + existing cloner)
- [ ] `CURRENT_STATE.md` updated: Phase Tampa Part 1 moved to "shipped," Part 2 (live loop) is the new active phase

Then Phase Tampa Part 1 is done. Part 2 (the live design loop) gets its own plan doc — the loop reuses the decision record as replayable state, which is why Part 1 needed to produce one.

---

## What this phase does NOT do

- Does NOT add the live design loop. The loop is Part 2.
- Does NOT introduce a split between a photo-treatment agent and an ornament agent. One brain. Decision locked (#1).
- Does NOT let the Art Director pick its own reference. Same reference as the cloner. Decision locked (#2).
- Does NOT produce prose output from the Art Director. JSON only. Decision locked (#4).
- Does NOT exceed 3 focal ornaments per build under any circumstances. Scarcity is the point. Decision locked (#5).
- Does NOT change the cloner's temperature, model, or retry logic. Prompt-only changes to the cloner.
- Does NOT introduce new verticals, new references, or new quiz questions. That work is permanently ongoing but independent of this phase.
- Does NOT attempt to productize the Art Director into a user-facing "choose your art director" UI. The AD is invisible infrastructure; the user never sees it.

Stay scoped. Ship Part 1 clean. Part 2 — the loop — is the payoff, and it depends on Part 1 being solid.

---

## Open questions before Cowork kickoff

These are the questions `CURRENT_STATE.md` flagged as needing answers before engineering starts. Status after drafting this plan:

- **JSON schema shape** — answered by Item 2's deliverable. Schema is locked in code before Item 3 touches agent logic.
- **Agent prompt structure (system + user)** — answered by Item 3's kickoff. System prompt sections enumerated.
- **Testing strategy** — answered by Item 6. Isolation harness + fixture-driven smoke test + human judgment gate.
- **Does the cloner's CSS-atmosphere upgrade ship with Art Director, or after?** — Together. Bundled into Item 5. One shippable quality leap.
- **First smoke-test reference + business pairing?** — Tidescape + coastal-coffee (primary), Bistora + artisan-bakery (secondary), cross-pairs for robustness. Fixtures committed in Item 6.

Nothing remaining is blocking. Item 1's Cowork kickoff can start whenever the engine is up.
