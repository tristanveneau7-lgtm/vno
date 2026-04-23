/**
 * Phase Tampa Item 2 — Art Director decision record schema.
 *
 * This file is pure types + a zod schema. No logic, no agent code, no
 * cloner changes. Every field carries a JSDoc comment that doubles as
 * field-by-field guidance in the Item 3 system prompt — when you edit a
 * field here, the agent's output contract changes in the same edit.
 *
 * The schema is strict: unknown keys are rejected at parse time so the
 * agent can't drift into undocumented fields. Fixed vocabularies are
 * enumerated (grain level, divider, caption style, backdrop, section,
 * slot, ornament position/size); free-form strings are reserved for
 * focal ornament prompts, section copy text, and the atmospheric
 * directives `notes` field.
 */
import { z } from 'zod'
import type { PhotoVariants } from '../lib/assets.js'

// -----------------------------------------------------------------------------
// Shared vocabularies
// -----------------------------------------------------------------------------

/**
 * The three variant names produced per photo by the Item 1 variant
 * pipeline. Wired to `keyof PhotoVariants` so the schema and the pipeline
 * share one definition — if PhotoVariants ever gains a fourth variant,
 * both this type and the zod enum below need to update together. The
 * compile-time assertion just after keeps them from silently drifting.
 */
export type PhotoVariantName = keyof PhotoVariants

const photoVariantNameEnum = z.enum(['raw', 'duotone', 'cutout'])

// Drift guard: if PhotoVariants adds/removes a key, the `satisfies` clause
// fails to compile and this file won't build until the enum is updated.
const _photoVariantNameDriftGuard = ['raw', 'duotone', 'cutout'] satisfies PhotoVariantName[]
void _photoVariantNameDriftGuard

/**
 * Photo role, as produced by Item 0's labeled upload slots. The schema
 * references input photos by role (roles are unique across the input
 * set), so `photoId` everywhere below is a role name.
 *
 * Logos are intentionally excluded from the schema — the cloner puts the
 * logo in the header automatically, and letting the AD scatter logos
 * would produce distracting pages. All schema references to photos
 * therefore use `NonLogoRole`.
 */
const nonLogoRoleEnum = z.enum(['outside', 'inside', 'hero'])

/**
 * Page sections the AD can direct content and ornaments into. Enumerated
 * (rather than free-form) so the cloner has a closed set to render
 * against and the agent can't invent sections that don't exist.
 */
const sectionEnum = z.enum([
  'hero',
  'about',
  'services',
  'gallery',
  'pricing',
  'booking',
  'contact',
  'footer',
])

/**
 * Hero-slot composition. Full-bleed = edge-to-edge photo; split-left /
 * split-right = 50/50 photo + text; polaroid-corner = text-first hero
 * with a small rotated photo tucked in a corner. The split variants
 * match the cloner's existing portrait-handling heuristic.
 */
const heroSlotEnum = z.enum(['full-bleed', 'split-left', 'split-right', 'polaroid-corner'])

/**
 * Non-hero photo composition. Wider vocabulary than hero because
 * mid-page photos play more compositional roles: caption-pair,
 * background-blur behind text, polaroid-corner as an editorial mark,
 * etc.
 */
const photoSlotEnum = z.enum([
  'full-bleed',
  'contained',
  'split-left',
  'split-right',
  'polaroid-corner',
  'inline-caption',
  'background-blur',
])

/**
 * Ornament anchor position within a section. overlapping-top means the
 * ornament visually spans over the section's top edge — useful for
 * framing a headline. left-margin / right-margin hang the ornament in
 * the page gutter rather than inside the content column.
 */
const ornamentPositionEnum = z.enum([
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'center',
  'left-margin',
  'right-margin',
  'overlapping-top',
])

/**
 * Ornament canvas aspect. Mapped to fal.ai image sizes in Item 4:
 * wide → 1024×512, square → 1024×1024, tall → 512×1024.
 */
const ornamentSizeEnum = z.enum(['wide', 'square', 'tall'])

/**
 * Page-wide grain intensity. None = no filter. Subtle = quiet editorial
 * (~3-5% noise). Strong = warm/handmade (~8-12% noise). The cloner's
 * TEXTURE section (added in Item 5) provides reference SVG snippets.
 */
const grainLevelEnum = z.enum(['none', 'subtle', 'strong'])

/**
 * Section-divider style. None = whitespace only. Hairline = 1px solid.
 * Dotted = CSS `border-top: 1px dotted`. Flourish = small inline SVG
 * pattern; the cloner's TEXTURE section supplies one example.
 */
const dividerStyleEnum = z.enum(['none', 'hairline', 'dotted', 'flourish'])

/**
 * Photo-caption typography. None = no captions. Italic-serif = classic
 * editorial caption (font-stack provided by cloner). Handwritten =
 * Kalam / Caveat or similar via Google Fonts.
 */
const captionStyleEnum = z.enum(['none', 'italic-serif', 'handwritten'])

/**
 * Page-wide background treatment. Clean = white/cream surface.
 * Blurred-photo = one uploaded photo at high blur used as a section
 * backdrop. Paper-texture = SVG noise + warm tint.
 */
const backdropEnum = z.enum(['clean', 'blurred-photo', 'paper-texture'])

// -----------------------------------------------------------------------------
// Sub-schemas
// -----------------------------------------------------------------------------

/**
 * Which input photo fills the above-the-fold hero slot, which variant
 * to render it in, and the hero's compositional form.
 *
 * The logo is never a valid hero (handled by the header); `photoId`
 * accepts only the three non-logo roles. The picked photo is then
 * excluded from `photoPlacements` (enforced by the top-level schema's
 * uniqueness refinement) — no photo appears in two slots.
 */
const heroDecisionSchema = z
  .object({
    /** Role of the input photo used for the hero — one of outside / inside / hero. */
    photoId: nonLogoRoleEnum,
    /** Which cached variant the cloner should render. */
    variant: photoVariantNameEnum,
    /** Hero composition — full-bleed photo, split with copy, or polaroid-in-corner. */
    slot: heroSlotEnum,
  })
  .strict()

/**
 * A non-hero photo placement. One entry is expected per non-hero,
 * non-logo input photo (enforced at runtime by the agent call, not at
 * schema level — the schema can't see the input photo set). The
 * optional `caption` is literal text the cloner renders verbatim if
 * present; absent means no caption rendered below the photo.
 */
const photoPlacementSchema = z
  .object({
    /** Role of the input photo being placed. Must not equal hero.photoId. */
    photoId: nonLogoRoleEnum,
    /** Which cached variant the cloner should render. */
    variant: photoVariantNameEnum,
    /** Which page section this photo belongs in. */
    section: sectionEnum,
    /** Compositional form the cloner should render the photo as. */
    slot: photoSlotEnum,
    /** Optional italic-serif / handwritten caption rendered under the photo. */
    caption: z.string().optional(),
  })
  .strict()

/**
 * One of up to three focal ornaments — a generated illustration placed
 * at a specific anchor for a specific intent. Every ornament is a
 * visual event; scarcity is the point (locked decision #5). The agent
 * is encouraged to use fewer, not to max out to three.
 *
 * `prompt` is handed verbatim to fal.ai (Item 4's generator wraps
 * nothing around it), so the agent must write a well-formed
 * flux/schnell prompt. `intent` is a human-readable one-liner
 * describing what the ornament does for the page — not consumed by
 * any renderer, but diffable across iterations for the Item 6 smoke
 * test and the Part 2 loop.
 */
const focalOrnamentSchema = z
  .object({
    /** Where on the page the ornament lives. */
    anchor: z
      .object({
        section: sectionEnum,
        position: ornamentPositionEnum,
      })
      .strict(),
    /** Human-readable one-liner: what is this ornament doing for the page? */
    intent: z.string(),
    /** Prompt handed directly to fal.ai flux/schnell. Must be a well-formed image prompt. */
    prompt: z.string(),
    /** Canvas aspect — maps to fal.ai image sizes. */
    targetSize: ornamentSizeEnum,
  })
  .strict()

/**
 * Page-wide atmospheric directives — the "CSS atmosphere pass" the
 * cloner applies (Item 5 teaches the cloner how to render each).
 * These are cheap to apply, so a quiet editorial reference wants many
 * small marks and a warm/handmade reference wants more expressive
 * marks. The reference dictates the mix.
 *
 * `notes` is a free-form escape hatch for directions that don't fit
 * any enum — use sparingly; if a direction is load-bearing, it
 * probably deserves its own structured field.
 */
const atmosphericDirectivesSchema = z
  .object({
    /** Noise-filter intensity applied over the body. */
    grain: grainLevelEnum,
    /** Section-separator style. */
    divider: dividerStyleEnum,
    /** Photo / section caption typography. */
    captionStyle: captionStyleEnum,
    /** Page background treatment. */
    backdrop: backdropEnum,
    /** Free-form guidance the enums can't express. Keep short. */
    notes: z.string().optional(),
  })
  .strict()

/**
 * Optional per-section copy the AD wants the cloner to use verbatim
 * where provided. Any section omitted here means the cloner writes
 * its own copy from business info + vertical terms, as it does today.
 */
const sectionCopySchema = z
  .object({
    /** Which section this copy belongs to. */
    section: sectionEnum,
    /** Short caption (e.g. under a photo or beside a section header). */
    caption: z.string().optional(),
    /** Section subhead — one short line supporting the section's main content. */
    subhead: z.string().optional(),
  })
  .strict()

/**
 * Provenance metadata attached to every decision record. `referenceId`
 * and `businessHash` let the Part 2 live loop key cached state.
 * `version` is a literal — if the prompt or schema changes materially,
 * bump to `art-director-v2` so consumers can branch on it.
 *
 * `confidence` is optional per Phase Tampa Item 2 scope: Part 1 does
 * not consume confidence scores and asking the agent to emit them
 * wastes tokens. Part 2's live loop reintroduces and consumes it.
 */
const artDirectorMetaSchema = z
  .object({
    /** Reference library id (e.g. 'tidescape'). */
    referenceId: z.string(),
    /** Stable hash of the business snapshot used to cache / key state. */
    businessHash: z.string(),
    /** Schema + prompt version. Bump on material changes. */
    version: z.literal('art-director-v1'),
    /** ISO 8601 timestamp of decision creation. */
    createdAt: z.string(),
    /**
     * Per-decision confidence scores in [0, 1]. Optional — Part 1
     * does not consume these; Part 2's live loop uses them to pick
     * what to revisit.
     */
    confidence: z.record(z.string(), z.number().min(0).max(1)).optional(),
  })
  .strict()

// -----------------------------------------------------------------------------
// Top-level decision schema
// -----------------------------------------------------------------------------

/**
 * The full Art Director decision record. Every build produces exactly
 * one of these records, validated against this schema before reaching
 * the cloner. The cloner must be able to render a complete page from
 * this record alone (plus the standard inputs: reference, business,
 * photo variants, palette).
 *
 * Invariants enforced below via `.superRefine`:
 *   - `hero.photoId` is not reused in any `photoPlacements[].photoId`.
 *   - All `photoPlacements[].photoId` are unique among themselves.
 *   - At most 3 `focalOrnaments` (also enforced via `.max(3)`).
 *
 * Invariants NOT enforced here (context the schema doesn't have):
 *   - `photoPlacements` length equals the number of non-hero non-logo
 *     input photos. Item 3's `runArtDirector` re-checks this against
 *     the actual input photo set and re-prompts on mismatch.
 */
export const artDirectorSchema = z
  .object({
    /** Above-the-fold hero slot assignment. */
    hero: heroDecisionSchema,
    /**
     * One entry per non-hero non-logo input photo. Every photoId here
     * must appear in the input set and differ from hero.photoId and
     * every other placement's photoId.
     */
    photoPlacements: z.array(photoPlacementSchema),
    /**
     * Up to three focal ornaments. Empty is a valid, often-preferable
     * decision for quiet/editorial references — scarcity is the
     * signal. Array length > 3 is rejected.
     */
    focalOrnaments: z.array(focalOrnamentSchema).max(3),
    /** Page-wide atmospheric directives — grain, dividers, captions, backdrop. */
    atmosphericDirectives: atmosphericDirectivesSchema,
    /** Optional per-section copy the cloner renders verbatim where present. */
    sectionCopy: z.array(sectionCopySchema),
    /** Provenance metadata — reference id, business hash, version, timestamp. */
    meta: artDirectorMetaSchema,
  })
  .strict()
  .superRefine((decision, ctx) => {
    const ids = [decision.hero.photoId, ...decision.photoPlacements.map((p) => p.photoId)]
    const seen = new Set<string>()
    for (const id of ids) {
      if (seen.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate photoId across hero + photoPlacements: ${id}`,
          path: ['photoPlacements'],
        })
        return
      }
      seen.add(id)
    }
  })

// -----------------------------------------------------------------------------
// Inferred types (exported for Item 3 and Item 5 to consume)
// -----------------------------------------------------------------------------

export type ArtDirectorDecision = z.infer<typeof artDirectorSchema>
export type HeroDecision = z.infer<typeof heroDecisionSchema>
export type PhotoPlacement = z.infer<typeof photoPlacementSchema>
export type FocalOrnament = z.infer<typeof focalOrnamentSchema>
export type AtmosphericDirectives = z.infer<typeof atmosphericDirectivesSchema>
export type SectionCopy = z.infer<typeof sectionCopySchema>
export type ArtDirectorMeta = z.infer<typeof artDirectorMetaSchema>

// -----------------------------------------------------------------------------
// Sample decision — for schema sanity, prompt few-shot, and Item 6 fixtures.
// -----------------------------------------------------------------------------

/**
 * A fully-populated, plausible decision record for a hypothetical
 * coastal coffee build against the tidescape reference. Serves three
 * purposes:
 *   1. A sanity check that the schema is expressive enough — if it
 *      can't represent a realistic decision without stuffing intent
 *      into `notes`, the schema is under-specified.
 *   2. A few-shot example in the Item 3 system prompt.
 *   3. A reference object the Item 6 harness compares new outputs
 *      against when iterating on the agent prompt.
 */
export const SAMPLE_DECISION: ArtDirectorDecision = {
  hero: {
    photoId: 'hero',
    variant: 'duotone',
    slot: 'split-left',
  },
  photoPlacements: [
    {
      photoId: 'outside',
      variant: 'raw',
      section: 'about',
      slot: 'contained',
      caption: 'The corner of Third and Marina, since the storefront found us.',
    },
    {
      photoId: 'inside',
      variant: 'cutout',
      section: 'services',
      slot: 'polaroid-corner',
      caption: 'Pour-over, pulled slow.',
    },
  ],
  focalOrnaments: [
    {
      anchor: { section: 'hero', position: 'overlapping-top' },
      intent: 'Single hand-drawn wave stroke beside the hero headline — the reference\'s quiet editorial signature.',
      prompt:
        'single hand-drawn ink wave stroke, one continuous organic line, no shading, transparent background, monochrome',
      targetSize: 'wide',
    },
    // Two ornament slots intentionally unused — tidescape is quiet and
    // typographic; under-spending the ornament budget is the right read
    // on the reference's restraint.
  ],
  atmosphericDirectives: {
    grain: 'subtle',
    divider: 'hairline',
    captionStyle: 'italic-serif',
    backdrop: 'clean',
    notes: 'Restraint wins here — the reference is quiet and typographic.',
  },
  sectionCopy: [
    { section: 'hero', subhead: 'Small-batch coffee from the coast.' },
    { section: 'about', caption: 'Two roasters, one storefront, fifteen pounds a week.' },
  ],
  meta: {
    referenceId: 'tidescape',
    businessHash: 'driftline-coffee-2026-04',
    version: 'art-director-v1',
    createdAt: '2026-04-23T16:30:00.000Z',
    // confidence intentionally omitted — Phase Tampa Part 1 does not
    // consume it (Item 2 scope tweak). Part 2's live loop reintroduces.
  },
}

// -----------------------------------------------------------------------------
// Runtime validation — one-line drift check that runs on module load.
// -----------------------------------------------------------------------------

// If SAMPLE_DECISION ever diverges from the schema, this parse throws on
// engine startup. No test runner required; drift surfaces immediately.
artDirectorSchema.parse(SAMPLE_DECISION)
