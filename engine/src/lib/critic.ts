/**
 * Phase Tampa Part 1.5 Item 2 — the Critic agent.
 *
 * One exported function, {@link runCritic}, that takes the AD's
 * decision record + the cloner's rendered HTML + the reference
 * screenshot + the business snapshot + the brand palette + the pass
 * round, and returns a validated {@link CriticDecision} record.
 *
 * The Critic is the post-cloner, pre-deploy opinions layer that
 * closes 7/10 -> 9/10. See `PHASE_TAMPA_PART_1_5_PLAN.md` for the full
 * phase framing.
 *
 * Scope reminders (locked in Part 1.5 plan):
 *   - Critic runs post-cloner, pre-deploy (decision #1). Not a
 *     post-deploy diagnostic.
 *   - JSON output via zod-validated tool-use (decision #2). Same
 *     discipline as the AD; prose responses are rejected.
 *   - Max 2 critique rounds per build (decision #3). The pipeline
 *     caps at 2 AD calls; this module is unaware of the cap but the
 *     schema's `meta.round` enum enforces it statically.
 *   - Reads HTML, not a screenshot of the deployed site (decision
 *     #4). Puppeteer is not in this module's call graph.
 *   - Opus 4.7 (decision #5). Same model slug as the AD.
 *   - Critic suggests, AD decides (decision #6). This module never
 *     writes HTML and never mutates an AD decision — it only emits
 *     a critique record.
 *
 * This file is built sub-step by sub-step in Item 2:
 *   Step 1 — module scaffold + CriticInput + empty function
 *   Step 2 — system prompt (mirrored to critic-systemPrompt.txt)
 *   Step 3 — user message builder
 *   Step 4 — Claude call + zod-validated response + retry  <- YOU ARE HERE
 *   Step 5 — unit tests with mocked Anthropic client
 */
import { createHash } from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { sanitizeJsonSchemaForAnthropic } from './artDirector.js'
import { criticSchema, type CriticDecision } from '../types/critic.js'
import type { ArtDirectorDecision } from '../types/artDirector.js'
import type { BrandPalette } from './assets.js'
import type { BusinessInfo } from './cloner.js'

/**
 * The Critic's system prompt — the load-bearing artifact of Phase
 * Tampa Part 1.5. Every sentence here either (a) describes the
 * agent's role, (b) directs a specific schema field, or (c) forbids
 * a specific failure mode. No sentence is decorative.
 *
 * Mirrored verbatim to `critic-systemPrompt.txt` (alongside this
 * module) so it's readable as plain text during review. When you
 * edit the prompt, regenerate the .txt by `cat`-ing the
 * `SYSTEM_PROMPT` constant via a one-liner — there is no build step.
 *
 * Structural DNA matches `artDirector.ts` intentionally: ROLE /
 * WHAT YOU'RE DOING / THE MENTAL MODEL / HOW TO CRITIQUE /
 * PRIORITIZATION / OUTPUT CONTRACT / FORBIDDEN. Consistency across
 * agents is the meta-feature — future debugging benefits from
 * prompts sharing the same skeleton. tool_use forcing + the schema
 * catch structural violations; this prompt catches semantic drift
 * (e.g. the Critic picking the wrong `severity` is a judgment call
 * only the prompt can steer).
 */
export const SYSTEM_PROMPT = `# ROLE

You are a senior art director reviewing the output of a junior designer's build against a reference. The junior designer — the Art Director agent — has already made every decision for this build: hero photo, variant picks, ornament placements, atmospheric directives, section copy. The cloner has rendered those decisions into HTML. Your job is to read what was produced, compare it against what the reference's designer would have done, and emit a structured critique.

You are NOT the Art Director. You do not decide; the AD does. Your critiques are suggestions the AD reads in revision mode — the AD chooses how, or whether, to act on each one. You suggest; the AD decides. The only authority you hold over the build is the verdict field: \`ship\` moves the build to deploy, \`revise\` triggers a second AD pass, \`broken\` ships the first pass anyway and logs your reasons.

Today's baseline for this engine is a 7/10 "AI-rendered from template" output. The AD's first pass closes some of the gap to 9-10/10 — "made by a human for THIS business" — but not all. You close the rest. The gap you are paid to find is the difference between "reasonable decisions" and the insightful decisions the reference's designer would make.

# WHAT YOU'RE DOING

You produce exactly one Critic decision record conforming to the schema in OUTPUT CONTRACT below. You deliver the record by calling the \`emit_critique\` tool — that is the only way to provide your output. The build pipeline reads the tool's input as structured data. Emit no explanations, preamble, postamble, or chain-of-thought around the tool call.

Every field has a specific downstream consumer. Unknown keys are rejected at parse time. Missing required fields are rejected. More than 8 critiques is rejected. The schema is strict; the contract is exact.

The user message contains: the reference screenshot labeled "REFERENCE — your taste source"; the AD's decision record as JSON, delimited with \`=== ART DIRECTION ===\` / \`=== END ===\`; the rendered HTML, delimited with \`=== RENDERED HTML ===\` / \`=== END ===\`; the business snapshot (name, vertical, location, about copy, services); the brand palette; the pass round (1 or 2); and three provenance values (referenceId, businessHash, current ISO timestamp) for the meta block.

# THE MENTAL MODEL

Ask, on every critique: **"Would the designer who made this reference accept this output?"**

The reference's designer already proved what they would do with their chosen subject. Your job is to read the rendered HTML as if you were that designer being shown an intern's take on your own style — where does the intern fall short of what you would have produced for THIS business? Deviation from the reference's posture is the failure mode; matching it is the win.

You compare three things, in priority order: HTML against reference (does the rendered page carry the reference's craft posture?); HTML against AD decision (did the cloner actually render what the AD asked for, or did it silently template-fill around the decisions?); AD decision against reference (did the AD make the right calls in the first place?). The first two are failures you can blame on the pipeline; the third is a failure you can redirect via critique suggestion.

You do not critique things the reference does not express an opinion on. If the reference has no visible stats band, whether the rendered page has one is fair game. If the reference has no visible pricing section, whether the rendered page's pricing section uses the right color is not your problem — it is the cloner's problem, and you cannot fix it through an AD critique.

# HOW TO CRITIQUE

Every critique entry must be grounded in either a concrete element in the HTML or a specific mismatch against the reference screenshot. "The typography feels generic" is useless. "The hero h1 in class hero-title uses a system sans-serif where the reference uses a distinctive editorial serif with tight tracking" is actionable. Specificity is the contract.

Never hallucinate issues. If you cannot point to the HTML element or the reference detail your critique is about, cut the critique. A shorter, sharper critique list beats a longer list that includes guesses.

Never critique things the AD's schema cannot address. The AD emits: hero photo picks, photoPlacements, focalOrnaments prompts + anchors, atmosphericDirectives (grain / divider / captionStyle / backdrop / notes), and sectionCopy. If your suggestion cannot be expressed as a change to one of those fields, it belongs in another agent's scope and does not belong here.

Use the preserve list as a real signal, not a formality. Every decision the AD got right and you want kept through the revise pass goes there. The AD reads the preserve list as a constraint: preserve beats critique when they conflict. If you do not list it, the AD may regress it.

# PRIORITIZATION

Max 8 critiques. The schema enforces this. If you find more than 8 issues, you are not targeting the most important ones — cut until 8 remain, with the majors first.

If the page is already 8+/10, endorse more than you critique. The preserve list grows; the critique list shrinks; the verdict is \`ship\` and the score reflects the quality honestly.

Severity is a judgment call. Use the definitions in OUTPUT CONTRACT as your calibration anchor — \`major\` is reserved for real gaps, not aesthetic preferences.

# OUTPUT CONTRACT

Emit exactly one JSON object conforming to the decision schema. Every enum value is a fixed string; use the values verbatim.

## verdict
One of:
- \`ship\` — the page is good enough to deploy as-is. Use only when the score is at least 8 and the critique list is empty or contains only minors.
- \`revise\` — the page has targeted issues worth a second AD pass. Use at scores 4-7 when the critiques name actionable AD redirections.
- \`broken\` — the page is structurally wrong (missing critical sections, render errors visible in the HTML, placeholder or blank content where business content should be). Use at scores 3 or below. The pipeline ships the first pass anyway and logs your reasons.

## score
Integer 1-10, calibrated:
- 7 = competent template; ships but clearly reads as AI-rendered.
- 9 = feels like a human made this for THIS business.
- 10 = the reference's designer would accept it.

## critiques
An array of 0 to 8 entries, prioritized by severity (majors first). Empty is valid for a \`ship\` verdict. Length over 8 is rejected. Each entry:

- \`category\`: one of —
  - \`photo-placement\` — \`hero\` or a \`photoPlacement\` misreads the reference's compositional intent (wrong role in hero, wrong variant, wrong slot).
  - \`ornament-placement\` — \`focalOrnaments\` are wrong in intent, anchor, or count (too many, too few, or over-spent budget).
  - \`atmosphere\` — \`atmosphericDirectives\` mismatch the reference's texture posture (grain / divider / captionStyle / backdrop).
  - \`typography\` — headline, body, or caption type choices do not match the reference's type system.
  - \`copy\` — \`sectionCopy\` entries read as template-y or business-generic rather than carrying the reference designer's voice.
  - \`layout\` — section-level arrangement and hierarchy mismatch the reference.
  - \`composition\` — page-wide gestalt (asymmetry, rhythm, restraint) mismatches the reference.
- \`severity\`: one of —
  - \`major\` — the site is meaningfully worse than the reference on this axis. Must be addressed on a revise pass.
  - \`moderate\` — noticeable gap; address if the fix does not regress something in the preserve list.
  - \`minor\` — nitpick. Address if trivially achievable; otherwise skip.
- \`observation\`: one sentence naming what is wrong. Must reference a concrete HTML element or a specific reference detail. No vague craft complaints.
- \`suggestion\`: one sentence hinting what the AD should consider. Framed as a hint, not a command — the AD decides how, or whether, to act on it.
- \`targetField\`: optional dotted-path hint at the AD schema field your suggestion most directly lands on (e.g. \`hero.variant\`, \`focalOrnaments[0].prompt\`, \`atmosphericDirectives.grain\`, \`sectionCopy\`). Free-form string; the AD reads it as a hint.

## preserve
An array of 0 to 10 entries. AD decisions you explicitly endorse — the revise pass must not regress these. Each entry:
- \`aspect\`: one of the \`category\` enum values above.
- \`note\`: one sentence specific enough that the AD can recognize the decision in its own record (e.g. "the duotone hero variant choice", not "the hero").

## meta
- \`referenceId\`: the value provided in the user message, verbatim.
- \`businessHash\`: the value provided in the user message, verbatim.
- \`version\`: the literal string \`critic-v1\`.
- \`createdAt\`: the ISO timestamp provided in the user message, verbatim.
- \`round\`: the integer (1 or 2) provided in the user message, verbatim.

# FORBIDDEN

- Do not hallucinate issues. Every critique must point to a concrete HTML element or a specific reference mismatch.
- Do not critique things the AD's schema cannot change. If your suggestion would require a cloner change or a new agent, do not emit it.
- Do not emit more than 8 critiques. Cut to the majors first.
- Do not use \`ship\` with a score below 8. Do not use \`broken\` with a score above 3. Do not use \`revise\` with an empty critique list.
- Do not omit the preserve list when the page has things worth preserving. Regressions on revise passes are failures you could have prevented.
- Do not mutate or re-emit the AD decision. You critique; you do not rewrite.
- Do not emit prose, preamble, postamble, or chain-of-thought around the tool call. Call emit_critique once and only once.
- Do not invent referenceId, businessHash, createdAt, or round — copy the user-message values verbatim.
- Do not derive taste from general knowledge of landing-page conventions. Only from what the reference is doing.
`


// -----------------------------------------------------------------------------
// Inputs
// -----------------------------------------------------------------------------

/**
 * All the context the Critic needs to produce a critique record.
 *
 * `reference.screenshotPng` is the PNG-encoded image the build
 * pipeline already has on hand (the same screenshot the AD received
 * in Item 3). The Critic base64-encodes it inline for Claude's vision
 * input — same pattern as the AD.
 *
 * `html` is the literal HTML emitted by the cloner. The Critic reads
 * it as text (not a rendered screenshot) so critiques can reference
 * concrete class names and element hierarchy. This is decision #4 in
 * the Part 1.5 plan — parsing HTML is cheap, deterministic, and
 * gives structured access without a Puppeteer render step.
 *
 * `artDirection` is the AD's decision record for the build. The
 * Critic compares the AD's intent against what the cloner actually
 * rendered and against what the reference's designer would have
 * done. It must NOT mutate this value.
 *
 * `business` + `palette` are the same snapshots the AD received —
 * handed in again so the Critic can evaluate copy voice ("does this
 * subhead sound like this business?") and color decisions ("did the
 * palette land the way the reference would use it?").
 *
 * `round` distinguishes the first critique pass from the second.
 * Round 1 may trigger a second AD pass in build.ts (Item 4); round
 * 2's verdict is logged only and never triggers a third pass. The
 * value flows straight into `meta.round` on the emitted decision.
 */
export interface CriticInput {
  /** The AD decision record that informed the HTML under review. Read-only. */
  artDirection: ArtDirectorDecision
  /** Literal HTML emitted by the cloner. Shown to the agent as text. */
  html: string
  /** The taste source — same reference the cloner and AD used. */
  reference: {
    /** Reference library id (e.g. 'tidescape'). Travels to `meta.referenceId`. */
    id: string
    /** Reference library entry URL. Shown as context, not fetched. */
    url: string
    /** PNG-encoded reference screenshot — the agent's taste anchor. */
    screenshotPng: Buffer
    /** Optional human-written notes about the reference. */
    notes?: string
  }
  /** Business snapshot — same shape the AD consumed. */
  business: BusinessInfo
  /** Three-color brand palette — same shape the AD consumed. */
  palette: BrandPalette
  /** Which pass this critique is for. Flows into `meta.round`. */
  round: 1 | 2
}

// -----------------------------------------------------------------------------
// Anthropic client + call-path constants
// -----------------------------------------------------------------------------

let _anthropic: Anthropic | null = null
function getClient(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic()
  return _anthropic
}

/**
 * Callable shape of Anthropic's `messages.create` (non-streaming). Used
 * as the type of the test-only override below so test harnesses don't
 * need to import the SDK's inner types.
 */
type MessagesCreateFn = (
  params: Anthropic.Messages.MessageCreateParams,
) => Promise<Anthropic.Messages.Message>

let _messagesCreateOverride: MessagesCreateFn | null = null

/**
 * Test-only hook to replace the Anthropic `messages.create` call with a
 * stub. Pass `null` to restore the real client. The `__` prefix and the
 * `ForTesting` suffix signal this is not part of the supported runtime
 * API — build.ts should never touch it. Mirrors the AD's same-named
 * hook so test harnesses can reuse the pattern.
 */
export function __setMessagesCreateForTesting(fn: MessagesCreateFn | null): void {
  _messagesCreateOverride = fn
}

/**
 * Model slug for the Critic agent. Opus per Part 1.5 decision #5 — the
 * Critic is a judgment agent and cost is not the constraint. Pinned to
 * the explicit -4-7 generation (not the floating `claude-opus-4-0`
 * alias) so future Opus releases don't silently change behavior.
 */
const MODEL = 'claude-opus-4-7' as const

/**
 * Tool name the agent must call to deliver its output. Mirror of the
 * AD's `emit_art_direction` pattern: tool-use forcing is stable in the
 * Anthropic API, structured-outputs beta is still changing surface.
 */
const EMIT_TOOL_NAME = 'emit_critique' as const

/**
 * Max tokens 4096 — the typical critique record is a few KB serialized
 * (worst case: 8 critiques × ~100 words + 10 preserve × ~20 words),
 * 4096 is ample headroom including retries with error context.
 *
 * Note: `temperature` is NOT set on the call — Opus 4.7 rejects the
 * parameter with `400 'temperature' is deprecated for this model`.
 * Discovered during Phase Tampa Part 1 Item 5 bring-up. The model
 * uses its internal default, which is fine for this task.
 */
const MAX_TOKENS = 4096

/**
 * JSON Schema used as the `input_schema` on the forced tool definition.
 * Computed once at module load from the zod schema via
 * `zod-to-json-schema`, then passed through
 * {@link sanitizeJsonSchemaForAnthropic} (imported from
 * `artDirector.ts`) to strip validation keywords Anthropic's tool-use
 * validator rejects. The stripped schema carries only the structural
 * shape — zod runs on every tool response (see {@link callAndValidate})
 * to enforce the refinements the API no longer sees: `.max(8)` on
 * critiques, `.max(10)` on preserve, `.min(1)` on meta strings,
 * `.datetime()` on createdAt, `.int()` + `.min(1)` / `.max(10)` on
 * score, and the literal-union on round.
 *
 * Exported so the Step 5 regression test can assert no unsupported
 * keyword survives sanitization.
 */
export const CRITIC_JSON_SCHEMA = sanitizeJsonSchemaForAnthropic(
  zodToJsonSchema(criticSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }),
) as Anthropic.Messages.Tool.InputSchema

// -----------------------------------------------------------------------------
// User message assembly
// -----------------------------------------------------------------------------

/**
 * Provenance values the agent stamps verbatim into
 * `meta.{referenceId, businessHash, createdAt}`. Kept as a small
 * helper result so the Step 5 unit tests can assert the exact values
 * that flow through.
 *
 * `round` is NOT part of this struct — it is passed to the agent in
 * its own text block (see {@link buildUserMessage}) to match the
 * Cowork plan's ordering: "pass round integer" between the HTML and
 * the provenance block. `round` is a context value the agent copies
 * into meta.round; the other three are identity values that pin the
 * critique to the AD decision it is reviewing.
 */
interface ProvenanceValues {
  referenceId: string
  businessHash: string
  createdAt: string
}

/**
 * Stable 64-bit hash of the business snapshot.
 *
 * **Mirrors** `hashBusinessSnapshot` in `artDirector.ts` — identical
 * implementation (SHA-256 of `JSON.stringify(business)`, truncated to
 * 16 hex chars). Duplicated rather than imported because the AD
 * currently keeps its helper file-local; if that hash ever gets
 * exported, swap this for the shared helper to kill drift risk.
 *
 * Used by (a) {@link computeRequestId} for log-id computation and
 * (b) {@link logInputSummary} for per-call log lines. {@link
 * computeProvenance} inherits its businessHash from the AD's meta
 * block directly rather than recomputing — the AD's hash is the
 * source of truth for the critique record.
 */
function hashBusinessSnapshot(business: BusinessInfo): string {
  return createHash('sha256').update(JSON.stringify(business)).digest('hex').slice(0, 16)
}

/**
 * Compute provenance values that ride into `meta` verbatim.
 *
 * `referenceId` comes from the incoming reference (the taste source
 * for this critique). `businessHash` is inherited from the AD
 * decision's meta block — the AD already validated it and the
 * Critic's schema requires the hashes to agree. `createdAt` is a
 * fresh ISO timestamp at critique-call time (not the AD's timestamp,
 * which is older).
 */
function computeProvenance(input: CriticInput): ProvenanceValues {
  return {
    referenceId: input.reference.id,
    businessHash: input.artDirection.meta.businessHash,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Serialize the business snapshot as a compact text block for the
 * user message. **Mirrors** the same-named helper in `artDirector.ts`
 * line-for-line so the Critic's view of the business matches what
 * the AD saw when it made its decisions.
 */
function businessSnapshotText(business: BusinessInfo): string {
  const lines: string[] = []
  lines.push(`Business: ${business.name}`)
  lines.push(`Vertical: ${business.vertical}`)
  if (business.address) lines.push(`Address: ${business.address}`)
  if (business.phone) lines.push(`Phone: ${business.phone}`)
  if (business.hours) lines.push(`Hours: ${business.hours}`)
  if (business.slogan) lines.push(`Slogan: ${business.slogan}`)
  if (business.anythingSpecial) lines.push(`Notes from the owner: ${business.anythingSpecial}`)
  const enabledSections = Object.entries(business.sections)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name)
  if (enabledSections.length > 0) {
    lines.push(`Sections enabled: ${enabledSections.join(', ')}`)
  }
  return lines.join('\n')
}

/**
 * Build the multi-part user-message content array handed to Claude.
 *
 * Ordering is deliberate and mirrors the AD's `buildUserMessage`
 * philosophy: instruction pointer first; reference second as the
 * taste source; AD decision + HTML next as the material under
 * review; round value last before provenance for
 * recency-anchoring-to-copy-verbatim.
 *
 *   1. One-line instruction pointing back at the system prompt.
 *   2. The REFERENCE screenshot — labeled as the taste source.
 *   3. Optional reference notes (human-written).
 *   4. Business snapshot text.
 *   5. Palette text.
 *   6. The AD decision record, delimited JSON between
 *      \`=== ART DIRECTION ===\` / \`=== END ===\`.
 *   7. The rendered HTML, delimited between
 *      \`=== RENDERED HTML ===\` / \`=== END ===\`.
 *   8. Pass round value — labeled "copy into meta.round verbatim".
 *   9. Provenance values (referenceId / businessHash / createdAt)
 *      labeled "copy into meta verbatim, do not modify".
 *
 * Unlike the AD, the Critic does NOT receive the raw photo variants
 * — it has access to the HTML which already carries `<img>` tags
 * pointing at the deployed variants, and the AD decision JSON which
 * names the chosen variant for each photo. Adding the image bytes
 * would just inflate tokens without adding critique signal.
 */
export function buildUserMessage(input: CriticInput): Anthropic.Messages.ContentBlockParam[] {
  const content: Anthropic.Messages.ContentBlockParam[] = []

  // 1. Instruction pointer.
  content.push({
    type: 'text',
    text: 'Produce one Critic decision record for the build described below. Follow the system prompt exactly. Deliver by calling the emit_critique tool.',
  })

  // 2. Reference screenshot.
  content.push({ type: 'text', text: 'REFERENCE — your taste source:' })
  content.push({
    type: 'image',
    source: {
      type: 'base64',
      media_type: 'image/png',
      data: input.reference.screenshotPng.toString('base64'),
    },
  })

  // 3. Optional human-written reference notes.
  if (input.reference.notes) {
    content.push({ type: 'text', text: `Reference notes: ${input.reference.notes}` })
  }

  // 4. Business snapshot.
  content.push({ type: 'text', text: businessSnapshotText(input.business) })

  // 5. Palette.
  content.push({
    type: 'text',
    text: `Brand palette — primary: ${input.palette.primary}, secondary: ${input.palette.secondary}, accent: ${input.palette.accent}`,
  })

  // 6. The AD decision record, delimited JSON.
  content.push({
    type: 'text',
    text: [
      '=== ART DIRECTION ===',
      JSON.stringify(input.artDirection, null, 2),
      '=== END ===',
    ].join('\n'),
  })

  // 7. The rendered HTML, delimited.
  content.push({
    type: 'text',
    text: [
      '=== RENDERED HTML ===',
      input.html,
      '=== END ===',
    ].join('\n'),
  })

  // 8. Pass round — its own block so the agent clearly sees what to
  //    put in meta.round.
  content.push({
    type: 'text',
    text: `Pass round: ${input.round} — copy into meta.round verbatim.`,
  })

  // 9. Provenance values for the meta block — copied verbatim.
  const { referenceId, businessHash, createdAt } = computeProvenance(input)
  content.push({
    type: 'text',
    text: [
      'Provenance values — copy into meta verbatim, do not modify:',
      `  referenceId: ${referenceId}`,
      `  businessHash: ${businessHash}`,
      `  createdAt: ${createdAt}`,
    ].join('\n'),
  })

  return content
}

// -----------------------------------------------------------------------------
// Main entry point
// -----------------------------------------------------------------------------

/**
 * Produce a validated Critic decision record for a build.
 *
 * Flow (mirrors `runArtDirector`):
 *   1. Compute a stable log request id and emit the input summary.
 *   2. Build the multi-part user message (Step 3's `buildUserMessage`).
 *   3. First attempt: call Claude with tool-use forcing on
 *      `emit_critique`, zod-parse the tool input, run
 *      {@link checkProvenanceConsistency} against the input context.
 *   4. If first attempt validates, return.
 *   5. If it fails, retry once with the validation error appended to
 *      the user message so the agent sees exactly what went wrong.
 *   6. If the retry also fails, throw — no degraded-record ship.
 */
export async function runCritic(input: CriticInput): Promise<CriticDecision> {
  const requestId = computeRequestId(input)
  const startTime = Date.now()
  logInputSummary(requestId, input)

  const userContent = buildUserMessage(input)

  // First attempt.
  console.log(`[CR:${requestId}] attempt 1/2 \u2192 ${MODEL}`)
  const first = await callAndValidate(userContent, input, requestId, 1)
  if (first.success) {
    console.log(`[CR:${requestId}] \u2713 done in ${Date.now() - startTime}ms`)
    return first.data
  }

  // One retry with the validation error appended to the user message
  // so the agent sees exactly what went wrong. Plan directive: retry
  // once, throw on second failure — no degraded-record ship.
  console.log(`[CR:${requestId}] attempt 2/2 \u2192 ${MODEL} (retry)`)
  const retryContent: Anthropic.Messages.ContentBlockParam[] = [
    ...userContent,
    {
      type: 'text',
      text: [
        'Your previous tool call failed validation with:',
        first.error,
        '',
        'Call emit_critique again with a record matching the schema and provenance-consistency constraints exactly.',
      ].join('\n'),
    },
  ]
  const second = await callAndValidate(retryContent, input, requestId, 2)
  if (second.success) {
    console.log(`[CR:${requestId}] \u2713 done in ${Date.now() - startTime}ms (after 1 retry)`)
    return second.data
  }

  const elapsed = Date.now() - startTime
  console.log(`[CR:${requestId}] \u2717 failed after retry in ${elapsed}ms: ${second.error}`)
  throw new Error(`Critic output failed validation after retry: ${second.error}`)
}

// -----------------------------------------------------------------------------
// Call + validation helpers
// -----------------------------------------------------------------------------

type ValidationOutcome =
  | { success: true; data: CriticDecision }
  | { success: false; error: string }

/**
 * Run one Claude call and validate the response against the zod
 * schema plus the provenance-consistency invariant the schema can't
 * see (referenceId / businessHash / round must match the input).
 * Returns a discriminated-union outcome; the caller decides whether
 * to retry or throw.
 *
 * The agent delivers its record via a forced tool call, so the SDK
 * hands us an already-parsed object as `tool_use.input` — no
 * `JSON.parse` step needed. We still zod-parse because zod's
 * `.refine` / `.strict` constraints are not expressible as JSON
 * Schema and the API doesn't enforce them.
 */
async function callAndValidate(
  content: Anthropic.Messages.ContentBlockParam[],
  input: CriticInput,
  requestId: string,
  attempt: 1 | 2,
): Promise<ValidationOutcome> {
  const toolInput = await callClaude(content)
  console.log(`[CR:${requestId}] attempt ${attempt}/2 response: ${safeStringify(toolInput)}`)

  const parsed = criticSchema.safeParse(toolInput)
  if (!parsed.success) {
    const error = `Schema validation failed: ${parsed.error.message}`
    console.log(`[CR:${requestId}] attempt ${attempt}/2 validation: \u2717 ${error}`)
    return { success: false, error }
  }
  const provenanceError = checkProvenanceConsistency(parsed.data, input)
  if (provenanceError) {
    console.log(`[CR:${requestId}] attempt ${attempt}/2 validation: \u2717 ${provenanceError}`)
    return { success: false, error: provenanceError }
  }
  console.log(`[CR:${requestId}] attempt ${attempt}/2 validation: \u2713 ok`)
  return { success: true, data: parsed.data }
}

/**
 * One Anthropic Messages.create call forcing a tool call on
 * `emit_critique`. Returns the tool's parsed input (already
 * JSON-decoded by the SDK). `disable_parallel_tool_use: true`
 * prevents the model from calling multiple tools in one response
 * (we only have one tool here, but the flag is explicit
 * belt-and-suspenders). The tool's `strict: true` asks the API to
 * validate the call's input against our JSON Schema server-side and
 * reject non-conforming calls.
 *
 * Throws if the response contains no `tool_use` block — that
 * shouldn't happen with `tool_choice` forcing, but we defend
 * against the empty-response edge case rather than silently
 * returning undefined to the zod parser.
 */
async function callClaude(content: Anthropic.Messages.ContentBlockParam[]): Promise<unknown> {
  const params: Anthropic.Messages.MessageCreateParams = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content }],
    tools: [
      {
        name: EMIT_TOOL_NAME,
        description:
          'Emit the Critic decision record for this build. This is the ONLY way you deliver your output; call it exactly once with the full record as input.',
        input_schema: CRITIC_JSON_SCHEMA,
        strict: true,
      },
    ],
    tool_choice: {
      type: 'tool',
      name: EMIT_TOOL_NAME,
      disable_parallel_tool_use: true,
    },
  }
  const create: MessagesCreateFn =
    _messagesCreateOverride ??
    ((p) => getClient().messages.create(p) as Promise<Anthropic.Messages.Message>)
  const response = await create(params)
  const toolUse = response.content.find(
    (block): block is Anthropic.Messages.ToolUseBlock =>
      block.type === 'tool_use' && block.name === EMIT_TOOL_NAME,
  )
  if (!toolUse) {
    throw new Error(`Critic response contained no ${EMIT_TOOL_NAME} tool call`)
  }
  return toolUse.input
}

// -----------------------------------------------------------------------------
// Provenance consistency check (external invariant)
// -----------------------------------------------------------------------------

/**
 * Verify the emitted decision's meta block matches the input context
 * exactly on the three fields the agent is instructed to copy
 * verbatim: `referenceId`, `businessHash`, `round`. Analogous to the
 * AD's `checkPhotoPlacementsCoverage` — the schema can't see the
 * input, so this check lives here.
 *
 * Returns null on success, or a human-readable error string on any
 * mismatch. The error flows into the retry prompt verbatim.
 *
 * `createdAt` is NOT checked — it's a fresh timestamp the agent may
 * lag slightly behind or produce its own version of, and the exact
 * wall-clock value is low-signal. As long as it parses as a valid
 * ISO datetime (the zod schema enforces this) we accept it.
 */
function checkProvenanceConsistency(
  decision: CriticDecision,
  input: CriticInput,
): string | null {
  const expectedReferenceId = input.reference.id
  const expectedBusinessHash = input.artDirection.meta.businessHash
  const expectedRound = input.round

  const msgs: string[] = []
  if (decision.meta.referenceId !== expectedReferenceId) {
    msgs.push(
      `meta.referenceId mismatch: got "${decision.meta.referenceId}", expected "${expectedReferenceId}"`,
    )
  }
  if (decision.meta.businessHash !== expectedBusinessHash) {
    msgs.push(
      `meta.businessHash mismatch: got "${decision.meta.businessHash}", expected "${expectedBusinessHash}"`,
    )
  }
  if (decision.meta.round !== expectedRound) {
    msgs.push(
      `meta.round mismatch: got ${decision.meta.round}, expected ${expectedRound}`,
    )
  }
  if (msgs.length === 0) return null
  return `provenance consistency mismatch — ${msgs.join('; ')}`
}

// -----------------------------------------------------------------------------
// Logging helpers
// -----------------------------------------------------------------------------

/**
 * Stable 8-hex-char request id for this Critic call — used as the
 * prefix on every log line emitted by {@link runCritic}. Deterministic
 * for a given input so a re-run of the exact same payload produces
 * the same id. Includes `round` in the key so round-1 and round-2
 * calls on the same business get distinct ids.
 */
function computeRequestId(input: CriticInput): string {
  const key = `${input.reference.id}|${hashBusinessSnapshot(input.business)}|${input.round}`
  return createHash('sha256').update(key).digest('hex').slice(0, 8)
}

/**
 * Log a one-line input summary at call start — reference, business
 * hash, round, and rough byte counts of the AD decision + HTML. The
 * byte counts flag pathological inputs (empty HTML, bloated AD
 * record) without dumping their full contents to the log.
 */
function logInputSummary(requestId: string, input: CriticInput): void {
  const businessHash = hashBusinessSnapshot(input.business)
  const htmlBytes = Buffer.byteLength(input.html, 'utf8')
  const adBytes = Buffer.byteLength(JSON.stringify(input.artDirection), 'utf8')
  console.log(
    `[CR:${requestId}] input: ref=${input.reference.id} business=${businessHash} round=${input.round} html=${htmlBytes}b ad=${adBytes}b`,
  )
}

/**
 * One-line JSON stringify with a length cap so a pathological
 * response can't flood the log. Same 8KB cap as the AD's helper.
 */
function safeStringify(value: unknown): string {
  const MAX = 8192
  let s: string
  try {
    s = JSON.stringify(value)
  } catch {
    return '<unserializable>'
  }
  if (s === undefined) return '<undefined>'
  return s.length > MAX ? `${s.slice(0, MAX)}\u2026 (truncated ${s.length - MAX} chars)` : s
}
