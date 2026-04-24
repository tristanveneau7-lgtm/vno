/**
 * Phase Tampa Part 1.5 Item 1 — Critic decision record schema.
 *
 * The Critic agent reads the rendered HTML + the reference screenshot +
 * the Art Director's decision record, and emits a structured critique
 * identifying where the generated site falls short of the reference's
 * craft quality. This file defines the shape of that critique record.
 *
 * Mirrors the discipline of `artDirector.ts`: pure types + zod schema.
 * No logic, no agent code, no pipeline wiring. Every field's JSDoc is
 * load-bearing — it doubles as the Item 2 system prompt's field-by-field
 * guidance.
 *
 * The schema is strict: unknown keys are rejected at parse time. Fixed
 * vocabularies are enumerated (verdict, category, severity); free-form
 * strings are reserved for observation text, suggestion text, and
 * preserve notes.
 *
 * Downstream consumers:
 *   - Item 2 (`critic.ts`): validates agent output against this schema
 *     via tool-use forcing; re-uses `sanitizeJsonSchemaForAnthropic`
 *     from `artDirector.ts` for the API-facing schema.
 *   - Item 3 (AD revision mode): reads a prior `CriticDecision` to
 *     inform a second-pass decision record.
 *   - Item 4 (build.ts): branches on `verdict` to decide whether to
 *     run a second AD pass + second cloner.
 *   - Item 5 (critic-harness): replays saved fixtures of this shape.
 */
import { z } from 'zod'

// -----------------------------------------------------------------------------
// Shared vocabularies
// -----------------------------------------------------------------------------

/**
 * Top-level outcome of a critique pass. Three states, not two —
 * collapsing "ship" and "broken" into a single non-revise bucket loses
 * the signal the pipeline needs to log the difference.
 *
 * - `ship`: the site is good enough to deploy as-is. No second pass.
 * - `revise`: the Critic has targeted feedback worth a second AD pass.
 *   The build pipeline hands the critique back to the AD and re-runs
 *   the cloner.
 * - `broken`: the site is structurally wrong (render errors, missing
 *   critical elements, blank sections). Per Item 4's branching the
 *   pipeline still SHIPS the first-pass output — two AD passes is the
 *   budget ceiling — but logs the reasons so Tristan can triage.
 */
const verdictEnum = z.enum(['ship', 'revise', 'broken'])

/**
 * Which dimension of the build a critique targets. Closed vocabulary
 * so the AD has a predictable set of categories to map back onto its
 * decision schema. Not every category maps 1:1 to an AD field — `copy`,
 * `layout`, and `composition` are coarser than any single AD field —
 * but the categories collectively cover the failure modes visually
 * reviewed on the Apr 24 Lumar build.
 *
 * - `photo-placement`: `hero` or any `photoPlacement` that misreads the
 *   reference's compositional intent (wrong role in hero, wrong
 *   variant, wrong slot).
 * - `ornament-placement`: `focalOrnaments` — wrong intent, wrong
 *   anchor, wrong count (too many, too few, or over-spent budget).
 * - `atmosphere`: `atmosphericDirectives` — grain/divider/captionStyle/
 *   backdrop mismatches against the reference's texture posture.
 * - `typography`: headline/body/caption type choices. Currently
 *   expressed via `atmosphericDirectives.captionStyle` and the cloner's
 *   defaults; a typography critique asks the AD to direct typography
 *   more aggressively (via `notes` or `sectionCopy`).
 * - `copy`: `sectionCopy` — lines that read as template-y or
 *   business-generic rather than carrying the reference designer's
 *   voice.
 * - `layout`: section-level arrangement and hierarchy. No single AD
 *   field; surfaces as slot choices and `sectionCopy` entries.
 * - `composition`: page-wide gestalt — asymmetry, rhythm, restraint.
 *   Coarse; surfaces as a cluster of smaller directives rather than a
 *   single field change.
 */
const categoryEnum = z.enum([
  'photo-placement',
  'ornament-placement',
  'atmosphere',
  'typography',
  'copy',
  'layout',
  'composition',
])

/**
 * How serious a critique is. Item 3's REVISION MODE section in the AD
 * system prompt spells out the ordering: the AD addresses `major`
 * critiques first, `moderate` next, and treats `minor` as optional.
 *
 * - `major`: the site is meaningfully worse than the reference on this
 *   axis. Must be addressed on a revise pass.
 * - `moderate`: noticeable gap; address if the fix doesn't regress
 *   something in the preserve list.
 * - `minor`: nitpick. Address if trivially achievable; otherwise skip.
 */
const severityEnum = z.enum(['minor', 'moderate', 'major'])

// -----------------------------------------------------------------------------
// Sub-schemas
// -----------------------------------------------------------------------------

/**
 * One specific issue the Critic identified. Every entry is grounded in
 * either a concrete element in the rendered HTML or a specific mismatch
 * against the reference screenshot — no vague gripes, no hallucinated
 * issues (the Item 2 system prompt's FORBIDDEN section enforces this
 * at the prompt level).
 *
 * `observation` states what's wrong in one sentence; `suggestion` is a
 * one-sentence hint for the AD — not a command. The AD retains
 * authority over the decision record; the Critic only suggests.
 * `targetField` is an optional hint at the AD schema field the
 * suggestion would most directly land in, to save the AD a lookup.
 */
const critiqueSchema = z
  .object({
    /** Which dimension of the build this critique targets. */
    category: categoryEnum,
    /** How serious the Critic considers this issue. */
    severity: severityEnum,
    /**
     * One-sentence statement of what's wrong. Must reference a
     * concrete element visible in the HTML or a specific mismatch
     * against the reference screenshot. No vague craft complaints.
     */
    observation: z.string().min(1),
    /**
     * One-sentence suggestion to the AD for the revise pass. Framed
     * as a hint, not a command — the AD decides how (or whether) to
     * act on it, weighed against the preserve list.
     */
    suggestion: z.string().min(1),
    /**
     * Optional dotted-path hint at the AD schema field the
     * suggestion most directly maps onto (e.g. `"hero.variant"`,
     * `"focalOrnaments[0].prompt"`, `"atmosphericDirectives.grain"`,
     * `"sectionCopy"`). Free-form string — the AD reads it as a hint,
     * not an addressing directive.
     */
    targetField: z.string().optional(),
  })
  .strict()

/**
 * One endorsement of an AD decision the Critic explicitly wants the
 * revise pass to keep. Prevents regression on things that worked.
 *
 * The AD's REVISION MODE prompt (Item 3) treats the preserve list as
 * a constraint: if a critique's suggestion would overwrite something
 * on the preserve list, the AD overrides the critique. Preserve beats
 * critique when they conflict.
 *
 * Structured (aspect + note) rather than a bare string so the AD can
 * quickly scan endorsements by category without parsing free text.
 */
const preserveEntrySchema = z
  .object({
    /** Which category of decision is being preserved. */
    aspect: categoryEnum,
    /**
     * One-sentence description of what specifically to preserve.
     * Must be specific enough that the AD can recognize the decision
     * in its own record (e.g. "the duotone hero variant choice", not
     * "the hero").
     */
    note: z.string().min(1),
  })
  .strict()

/**
 * Provenance metadata attached to every critique record. Same spirit
 * as `artDirectorMetaSchema`: stable values the pipeline and future
 * live-loop key off.
 *
 * `round` distinguishes first-pass critiques (which may trigger a
 * second AD call) from second-pass critiques (logged only per Item 4
 * — never triggers a third AD call). The schema caps `round` at 2 so
 * a bug in the pipeline can't silently request a third critique.
 */
const criticMetaSchema = z
  .object({
    /** Reference library id — copied verbatim from the AD decision's meta. */
    referenceId: z.string().min(1),
    /** Stable business hash — copied verbatim from the AD decision's meta. */
    businessHash: z.string().min(1),
    /** Schema + prompt version. Bump to `critic-v2` on material changes. */
    version: z.literal('critic-v1'),
    /** ISO 8601 timestamp of critique creation. */
    createdAt: z.string().datetime(),
    /**
     * Which pass produced this critique. 1 = first pass (may trigger
     * a revise). 2 = second pass (logged only). Third pass is not
     * allowed — Item 4's build pipeline caps AD calls at 2 per build.
     */
    round: z.union([z.literal(1), z.literal(2)]),
  })
  .strict()

// -----------------------------------------------------------------------------
// Top-level critic schema
// -----------------------------------------------------------------------------

/**
 * The full Critic decision record. Every critique pass produces
 * exactly one of these, validated against this schema before the
 * pipeline acts on the verdict.
 *
 * Invariants the schema enforces:
 *   - `critiques` length ≤ 8 — forces prioritization; if the Critic
 *     has more than 8 issues it isn't targeting the most important.
 *   - `preserve` length ≤ 10 — soft cap to bound tokens; no pass needs
 *     more than 10 endorsements.
 *   - Every object is `.strict()` — unknown keys rejected.
 *   - `score` is an integer in [1, 10].
 *
 * Invariants NOT enforced (context the schema doesn't have):
 *   - `score` calibration against `verdict`. A `ship` verdict with
 *     score 3 would validate, but the Item 2 system prompt steers
 *     toward `ship` only at score ≥ 8 and `broken` only at score ≤ 3.
 *     Prompt discipline, not schema enforcement, keeps these aligned.
 *   - `meta.referenceId` / `meta.businessHash` matching the AD
 *     decision the Critic is reviewing. Item 2's caller copies these
 *     in from the AD decision's meta block so they always line up;
 *     the schema can't see the AD decision, so it can't check.
 */
export const criticSchema = z
  .object({
    /**
     * Overall pass verdict — gates whether the build pipeline runs a
     * second AD pass (see `verdictEnum` for semantics). Item 4's
     * build.ts branches on this field.
     */
    verdict: verdictEnum,
    /**
     * Integer 1-10 craft score. Calibration:
     *   7 = competent template, competent enough to ship but clearly
     *       AI-rendered.
     *   9 = feels like a human made this for this business.
     *   10 = the reference's designer would accept it.
     * Rough but useful for logging, the Item 5 harness (first-pass
     * vs revised-pass delta), and Part 2's Curator (reference
     * scoring reuses this scale).
     */
    score: z.number().int().min(1).max(10),
    /**
     * Up to 8 structured critiques, prioritized by severity. Empty is
     * a valid output for a `ship` verdict — a clean page doesn't need
     * critiques. Length > 8 is rejected.
     */
    critiques: z.array(critiqueSchema).max(8),
    /**
     * AD decisions the Critic explicitly endorses — the revise pass
     * must not regress these. The AD's REVISION MODE prompt treats
     * this list as a hard constraint: preserve beats critique when
     * they conflict. Capped at 10 to bound tokens.
     */
    preserve: z.array(preserveEntrySchema).max(10),
    /** Provenance metadata — reference, business hash, version, timestamp, round. */
    meta: criticMetaSchema,
  })
  .strict()

// -----------------------------------------------------------------------------
// Inferred types (exported for Items 2-5 to consume)
// -----------------------------------------------------------------------------

export type CriticDecision = z.infer<typeof criticSchema>
export type Critique = z.infer<typeof critiqueSchema>
export type PreserveEntry = z.infer<typeof preserveEntrySchema>
export type CriticMeta = z.infer<typeof criticMetaSchema>
export type CriticVerdict = z.infer<typeof verdictEnum>
export type CritiqueCategory = z.infer<typeof categoryEnum>
export type CritiqueSeverity = z.infer<typeof severityEnum>

// -----------------------------------------------------------------------------
// Sample critique — for schema sanity, prompt few-shot, Item 5 fixtures.
// -----------------------------------------------------------------------------

/**
 * A fully-populated, plausible critique for the Lumar Electric trades
 * build that shipped at 6/10 on Apr 24, 2026. Three purposes, same as
 * `SAMPLE_DECISION` in `artDirector.ts`:
 *   1. Schema sanity — if a realistic critique can't be expressed
 *      without stuffing intent into `observation` free text, the
 *      schema is under-specified.
 *   2. Few-shot example in the Item 2 Critic system prompt.
 *   3. Item 5 harness baseline — compares new outputs against this
 *      when iterating on the prompt.
 *
 * The four critiques below map to the failure modes visually reviewed
 * on the Lumar deploy: template-y typography, template-y copy,
 * agency-template three-CTA nav, and a stats band that reads as stock
 * composition. The two preserve entries protect the atmospheric + one
 * photo-placement choices the first pass got right.
 */
export const SAMPLE_CRITIQUE: CriticDecision = {
  verdict: 'revise',
  score: 6,
  critiques: [
    {
      category: 'typography',
      severity: 'major',
      observation:
        'The hero <h1> renders in a generic system sans-serif; the reference\'s hero uses a distinctive editorial serif with tight tracking and an oversized leading letter.',
      suggestion:
        'Direct the cloner toward an editorial serif for the hero headline by encoding a specific font direction in atmosphericDirectives.notes.',
      targetField: 'atmosphericDirectives.notes',
    },
    {
      category: 'copy',
      severity: 'major',
      observation:
        'The hero subhead "Quality electrical services you can trust" reads as AI-template copy; the reference\'s hero carries a first-person line with locale-specific detail.',
      suggestion:
        'Emit a sectionCopy entry for the hero with a first-person subhead grounded in the Lumar owner\'s voice and service area.',
      targetField: 'sectionCopy',
    },
    {
      category: 'layout',
      severity: 'moderate',
      observation:
        'The top nav carries three CTAs ("Get a Quote", "Services", "Contact") in the agency-template pattern; the reference has a single editorial link beside the wordmark.',
      suggestion:
        'Direct via atmosphericDirectives.notes that the header should carry at most one CTA, matching the reference\'s restraint.',
      targetField: 'atmosphericDirectives.notes',
    },
    {
      category: 'composition',
      severity: 'moderate',
      observation:
        'The stats band ("20+ years", "500+ jobs", "24/7 service") reads as stock agency composition; the reference has no counterpart and instead lets the hero breathe directly into the about section.',
      suggestion:
        'Suppress the stats band on the revise pass — omit any sectionCopy entry targeting a stats section so the cloner falls back to hero-then-about.',
    },
  ],
  preserve: [
    {
      aspect: 'photo-placement',
      note:
        'The cutout variant choice for the inside photo in the services section — reads as intentional editorial framing, not a regression risk.',
    },
    {
      aspect: 'atmosphere',
      note:
        'The subtle grain + hairline divider combo — matches the reference\'s quiet restraint and must not regress to none/none on the revise pass.',
    },
  ],
  meta: {
    referenceId: 'mixed-layout-inspiration-b',
    businessHash: 'lumar-electric-2026-04',
    version: 'critic-v1',
    createdAt: '2026-04-24T06:15:00.000Z',
    round: 1,
  },
}

// -----------------------------------------------------------------------------
// Runtime validation — one-line drift check that runs on module load.
// -----------------------------------------------------------------------------

// If SAMPLE_CRITIQUE ever diverges from the schema, this parse throws
// on engine startup. No test runner required; drift surfaces
// immediately. Mirrors the discipline in `artDirector.ts`.
criticSchema.parse(SAMPLE_CRITIQUE)
