/**
 * Phase Tampa Item 3 — the Art Director agent.
 *
 * One exported function, {@link runArtDirector}, that takes the same
 * reference the cloner is using + the business snapshot + the full set
 * of processed photos (with variants from Item 1) + the brand palette,
 * and returns a validated {@link ArtDirectorDecision} record.
 *
 * Scope reminders (locked):
 *   - One brain, not a split (decision #1). This file is the only agent
 *     added in Phase Tampa Part 1.
 *   - Same reference as the cloner (decision #2). The reference field is
 *     passed in by build.ts — this module does not pick its own.
 *   - JSON output via zod-validated structured mode (decision #4). Prose
 *     responses are rejected; the retry prompt says so explicitly.
 *
 * Out of scope for Item 3:
 *   - Wiring into build.ts (that happens in Item 5 where the cloner
 *     starts consuming decisions).
 *   - Focal ornament generation (Item 4 turns the decision record's
 *     `focalOrnaments` prompts into fal.ai calls; this module only
 *     produces the decision).
 */
import { createHash } from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { BrandPalette, ProcessedAsset } from './assets.js'
import type { BusinessInfo } from './cloner.js'
import {
  artDirectorSchema,
  type ArtDirectorDecision,
} from '../types/artDirector.js'

/**
 * The Art Director's system prompt — the load-bearing artifact of Phase
 * Tampa Part 1. Every sentence here either (a) describes the agent's
 * role, (b) directs a specific schema field, or (c) forbids a specific
 * failure mode. No sentence is decorative.
 *
 * Mirrored verbatim to `artDirector-systemPrompt.txt` (alongside this
 * module) so it's readable as plain text during review. When you edit
 * the prompt, regenerate the .txt by `cat`-ing the `SYSTEM_PROMPT`
 * constant via a one-liner — there is no build step.
 */
export const SYSTEM_PROMPT = `# ROLE

You are an art director assigned to a single landing-page build for a local small business. You direct; you do not render. A downstream cloner consumes your output and produces the HTML — you never write markup, never emit prose, never hand-wave. Your taste is anchored entirely to the reference you are shown: the craft decisions of that reference's designer are the only taste source for this build.

Today's baseline for this engine is a 7/10 "AI-rendered from template" output. Your target is 9-10/10 — "made by a human for THIS business." You close the gap by making the hand-placed craft decisions a template cannot: which photo deserves the hero slot, which variant of each photo reads as intentional here, which few ornaments would feel earned, and what atmospheric texture matches the reference's restraint-to-warmth ratio.

# WHAT YOU'RE DOING

You produce exactly one Art Director decision record conforming to the schema in OUTPUT CONTRACT below. You deliver the record by calling the \`emit_art_direction\` tool — that is the only way to provide your output. The cloner consumes the tool's input as structured data. Emit no explanations, preamble, commentary, or chain-of-thought around the tool call.

Every field has a specific downstream consumer. Unknown keys are rejected at parse time. Missing required fields are rejected. Duplicate photoId across slots is rejected. The schema is strict; the contract is exact.

The user message contains: the reference screenshot labeled "REFERENCE — your taste source"; the business snapshot (name, vertical, location, about copy, services); the brand palette (primary / secondary / accent hex values); each input photo labeled with its role (outside / inside / hero / logo); and three provenance values (referenceId, businessHash, current ISO timestamp) for use in the meta block.

# THE MENTAL MODEL

Ask, on every decision: **"What would the designer who made this reference do with these raw photos and this business?"**

The reference's designer already proved what they'd do with their chosen subject. Your job is to carry that same hand across a different subject — this business, these photos, this palette — without deviating from the reference's craft posture. If the reference is quiet, your decisions are quiet. If the reference is warm and handmade, your decisions are warm and handmade. If the reference uses no ornaments, you use none. Deviation without visual anchor in the reference is failure.

# SCARCITY AND ATMOSPHERE

**Focal ornaments** (loud: custom illustrations, big scribbles, grid-break moments, hand-drawn arrows): up to 3 per page. These are fal.ai-generated, each one is a visual event, scarcity is what makes them feel intentional. You may emit 0, 1, 2, or 3 — never more. Over-spending the ornament budget is a more common failure mode than under-spending. If you cannot justify an ornament against a specific visual anchor in the reference, cut it.

**Atmospheric marks** (quiet: dotted dividers, small flourishes, underlines, corner marks, section breaks): the cloner applies these as CSS or inline SVG — effectively free, bounded only by taste. You direct them via the atmosphericDirectives enums; no budget cap. Quiet editorial references want many small atmospheric marks. Warm handmade references want expressive ones. Bold modern references may want neither — atmosphere set to "none" across all four enum fields is valid.

Reference DNA dictates the mix. The cloner cannot invent this; only you can.

# OUTPUT CONTRACT

Emit exactly one JSON object conforming to the decision schema. Every enum value is a fixed string; use the values verbatim.

## hero
- photoId: one of "outside" | "inside" | "hero". Never "logo" — the logo is rendered in the header automatically.
- variant: one of "raw" | "duotone" | "cutout".
- slot: one of "full-bleed" | "split-left" | "split-right" | "polaroid-corner".

## photoPlacements
An array with exactly one entry per remaining non-logo input photo. If the input has three non-logo photos and one is hero, emit exactly two placements. Every photoId must differ from hero.photoId and from every other placement's photoId.
- photoId: one of "outside" | "inside" | "hero".
- variant: one of "raw" | "duotone" | "cutout".
- section: one of "hero" | "about" | "services" | "gallery" | "pricing" | "booking" | "contact" | "footer".
- slot: one of "full-bleed" | "contained" | "split-left" | "split-right" | "polaroid-corner" | "inline-caption" | "background-blur".
- caption: optional literal copy rendered under the photo. Omit if the reference would render the photo caption-less.

## focalOrnaments
An array of 0 to 3 entries. Length above 3 is rejected. Each entry:
- anchor.section: one of the section enum values above.
- anchor.position: one of "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center" | "left-margin" | "right-margin" | "overlapping-top".
- intent: one declarative sentence naming what this ornament does for the page. Diffable context, not renderer input.
- prompt: the literal fal.ai flux/schnell prompt, handed verbatim to the generator. Write as you would for a capable image model: subject, style, composition, background. No framing wrappers.
- targetSize: one of "wide" (1024x512) | "square" (1024x1024) | "tall" (512x1024).

## atmosphericDirectives
Required, exactly one object.
- grain: "none" | "subtle" | "strong".
- divider: "none" | "hairline" | "dotted" | "flourish".
- captionStyle: "none" | "italic-serif" | "handwritten".
- backdrop: "clean" | "blurred-photo" | "paper-texture".
- notes: optional one-clause escape hatch. Use only when no enum field expresses the direction.

## sectionCopy
An array of optional per-section copy. Each entry must carry at least one non-empty caption or subhead; entries with both absent are rejected. Emit only when the reference's designer would supply a specific line the cloner's default copy would miss.

## meta
- referenceId: the value provided in the user message, verbatim.
- businessHash: the value provided in the user message, verbatim.
- version: the literal string "art-director-v1".
- createdAt: the ISO timestamp provided in the user message, verbatim.

# FORBIDDEN

- Do not invent a focal ornament without a visual anchor in the reference. If you cannot point to what in the reference your ornament echoes, cut it.
- Do not put the same photoId in hero and a photoPlacement, or in two placements. Uniqueness is checked across the full record.
- Do not exceed three focal ornaments.
- Do not emit any field not present in the schema.
- Do not use "logo" as a photoId anywhere.
- Do not emit prose, preamble, postamble, or chain-of-thought around the tool call. Call emit_art_direction once and only once.
- Do not use intent to hedge or apologize. One declarative sentence, naming the ornament's job.
- Do not derive taste from general knowledge of landing-page conventions. Only from what the reference is doing.
- Do not rehash businessHash or invent referenceId / createdAt — copy the user-message values verbatim.
`


/**
 * All the context the Art Director needs to produce a decision record.
 *
 * `reference.screenshotPng` is the PNG-encoded image build.ts already
 * produces (via Puppeteer or `pngBufferFromMediaUrl`); the agent call
 * base64-encodes it inline for Claude's vision input. `photos` is the
 * full processed-asset array from the Item 1 pipeline — every entry
 * carries its role, orientation, and three variant buffers. The AD
 * only looks at the raw variant for decision-making; Step 3 excludes
 * the others from the user message to avoid confusing the agent with
 * three renders of the same photo.
 */
export interface ArtDirectorInput {
  reference: {
    /** Reference library id (e.g. 'tidescape'). Travels through to decision.meta.referenceId. */
    id: string
    /** Reference library entry URL. Shown to the agent as context, not fetched. */
    url: string
    /** PNG-encoded reference screenshot — the agent's sole taste source. */
    screenshotPng: Buffer
    /** Optional human-written notes about the reference (e.g. "quiet editorial"). */
    notes?: string
  }
  /** Business snapshot — same shape the cloner consumes. */
  business: BusinessInfo
  /** Full processed photo set including variants. Logo entry is included but gets special treatment. */
  photos: ProcessedAsset[]
  /** Three-color brand palette. */
  palette: BrandPalette
}

/**
 * Produce a validated Art Director decision record for a build.
 *
 * **Not implemented yet (Item 3 Step 1 scaffold).** Subsequent steps:
 *   Step 2 — system prompt
 *   Step 3 — user message builder
 *   Step 4 — Claude call + zod validation + one retry
 *   Step 5 — logging
 *   Step 6 — unit tests
 *
 * The thrown error at this stage is load-bearing: any caller that
 * accidentally wires this in before Item 5 will blow up loudly instead
 * of silently shipping a broken build.
 */
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
 * API — build.ts should never touch it.
 *
 * Kept here (rather than behind a jest/vitest mocking layer) because the
 * engine has no test framework set up and we don't want to add one just
 * for this; Node's built-in `node:test` runner is enough and it doesn't
 * do module mocking.
 */
export function __setMessagesCreateForTesting(fn: MessagesCreateFn | null): void {
  _messagesCreateOverride = fn
}

/**
 * Model slug for the AD agent. Opus per Item 3 review: this is the
 * load-bearing agent for Phase Tampa quality; cost and latency are not
 * the constraint. Pinned to the explicit -4-7 generation (not the
 * floating `claude-opus-4-0` alias) so future Opus releases don't
 * silently change AD behavior. If Item 6's smoke-test iterations show
 * Opus is overkill, we downgrade — default up, not down.
 */
const MODEL = 'claude-opus-4-7' as const

/**
 * Tool name the agent must call to deliver its output. Tool-use forcing
 * (`tool_choice.type === 'tool'`) has been stable in Anthropic's API for
 * 2+ years, which is why we use it over the newer structured-outputs
 * beta (`output_format` / `output_config`) — that surface is still
 * changing and we don't want production riding on a parameter that may
 * rename between releases.
 */
const EMIT_TOOL_NAME = 'emit_art_direction' as const

/**
 * Max tokens 4096: the typical decision record is ~1-2KB serialized,
 * 4096 is ample headroom including retries with error context.
 *
 * Note: `temperature` is NOT set on the call — Opus 4.7 rejects the
 * parameter with `400 'temperature' is deprecated for this model`. The
 * model uses its internal default, which lands creative enough for
 * this task (Item 6 smoke will calibrate further if the AD's decisions
 * turn mechanical).
 */
const MAX_TOKENS = 4096

/**
 * JSON Schema keywords that Anthropic's tool-use validator rejects with
 * a 400 (`For '<type>' type, property '<keyword>' is not supported`).
 * The API accepts a structural subset of JSON Schema — type / properties
 * / required / items / enum / const / anyOf / oneOf / allOf / not /
 * additionalProperties / description / default — but rejects the
 * validation keywords below. We strip them from the schema we send and
 * keep zod as the full truth source for runtime validation.
 *
 * Discovered empirically during Phase Tampa Item 5's first end-to-end
 * build (Anthropic 400 on `maxItems` emitted by `z.array(...).max(3)`).
 * The list is conservative — add to it if a future Anthropic error
 * flags another keyword, rather than trying to chase the full spec
 * delta by reading docs.
 */
const UNSUPPORTED_SCHEMA_KEYWORDS = new Set<string>([
  // Array validation
  'maxItems',
  'minItems',
  'uniqueItems',
  // String validation
  'minLength',
  'maxLength',
  'pattern',
  'format',
  // Number validation
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  // Object validation
  'minProperties',
  'maxProperties',
  'patternProperties',
])

/**
 * Recursively adapt a JSON Schema document to Anthropic's tool-use
 * validator. Two transformations, both discovered empirically during
 * Phase Tampa Item 5's end-to-end bring-up:
 *
 *   1. Strip {@link UNSUPPORTED_SCHEMA_KEYWORDS} at every depth.
 *      Anthropic's 400s: `For '<type>' type, property '<keyword>'
 *      is not supported`. Zod keeps these refinements runtime-side
 *      in `callAndValidate`.
 *
 *   2. Normalize `additionalProperties` on every object-shaped node to
 *      the literal `false`. Anthropic's 400: `For 'object' type,
 *      'additionalProperties: object' is not supported`. This is
 *      triggered by `z.record(...)` which emits an object-valued
 *      `additionalProperties` (a schema for the record values). We
 *      discard the value-schema in the API-facing copy (zod's
 *      `.min(0).max(1)` on record values still runs on the response),
 *      and set `additionalProperties: false` unconditionally — matches
 *      the `.strict()` posture our zod schemas already use. Nodes
 *      without `type: 'object'` and without a `properties` key are
 *      left untouched.
 *
 * Returns a fresh object — the input is not mutated, so
 * `zodToJsonSchema`'s output stays intact for any other consumer.
 * Exported for the regression tests in
 * `src/__tests__/artDirector.test.ts`.
 */
export function sanitizeJsonSchemaForAnthropic(schema: unknown): unknown {
  if (Array.isArray(schema)) {
    return schema.map((item) => sanitizeJsonSchemaForAnthropic(item))
  }
  if (schema !== null && typeof schema === 'object') {
    const src = schema as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(src)) {
      if (UNSUPPORTED_SCHEMA_KEYWORDS.has(key)) continue
      if (key === 'additionalProperties') continue // handled below
      out[key] = sanitizeJsonSchemaForAnthropic(value)
    }
    // Object-shaped nodes — z.object(), z.record(), or any node that
    // carries `properties` — get `additionalProperties: false` forced
    // on. Non-object nodes (string, array, enum-only, etc.) are left
    // without the key. NOTE: enum values in this schema are all string
    // literals, so the walker never recurses into object-shaped enum
    // entries and this normalization is safe. If the schema ever grows
    // object-typed enum values, this behavior would need a special case.
    const isObjectShaped = src.type === 'object' || 'properties' in src
    if (isObjectShaped) {
      out.additionalProperties = false
    }
    return out
  }
  return schema
}

/**
 * JSON Schema used as the `input_schema` on the forced tool definition.
 * Computed once at module load from the zod schema via
 * `zod-to-json-schema`, then passed through
 * {@link sanitizeJsonSchemaForAnthropic} to strip validation keywords
 * Anthropic's tool-use validator rejects. The stripped schema carries
 * only the structural shape — zod runs on every tool response (see
 * {@link callAndValidate}) to enforce the refinements the API no longer
 * sees: `.max(3)` on focalOrnaments, `.min(1)` on meta strings,
 * `.datetime()` on createdAt, `.refine()` on sectionCopy,
 * `.superRefine()` on photoId uniqueness.
 *
 * Exported so the regression test can assert no unsupported keyword
 * survives sanitization.
 */
export const ART_DIRECTOR_JSON_SCHEMA = sanitizeJsonSchemaForAnthropic(
  zodToJsonSchema(artDirectorSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }),
) as Anthropic.Messages.Tool.InputSchema

// -----------------------------------------------------------------------------
// Main entry point
// -----------------------------------------------------------------------------

export async function runArtDirector(input: ArtDirectorInput): Promise<ArtDirectorDecision> {
  const requestId = computeRequestId(input)
  const startTime = Date.now()
  logInputSummary(requestId, input)

  const userContent = buildUserMessage(input)

  // First attempt.
  console.log(`[AD:${requestId}] attempt 1/2 \u2192 ${MODEL}`)
  const first = await callAndValidate(userContent, input, requestId, 1)
  if (first.success) {
    console.log(`[AD:${requestId}] \u2713 done in ${Date.now() - startTime}ms`)
    return first.data
  }

  // One retry with the validation error appended to the user message so
  // the agent sees exactly what went wrong. Plan directive: retry once,
  // throw on second failure — no degraded-record ship.
  console.log(`[AD:${requestId}] attempt 2/2 \u2192 ${MODEL} (retry)`)
  const retryContent: Anthropic.Messages.ContentBlockParam[] = [
    ...userContent,
    {
      type: 'text',
      text: [
        'Your previous tool call failed validation with:',
        first.error,
        '',
        'Call emit_art_direction again with a record matching the schema and coverage constraints exactly.',
      ].join('\n'),
    },
  ]
  const second = await callAndValidate(retryContent, input, requestId, 2)
  if (second.success) {
    console.log(`[AD:${requestId}] \u2713 done in ${Date.now() - startTime}ms (after 1 retry)`)
    return second.data
  }

  const elapsed = Date.now() - startTime
  console.log(`[AD:${requestId}] \u2717 failed after retry in ${elapsed}ms: ${second.error}`)
  throw new Error(`Art Director output failed validation after retry: ${second.error}`)
}

// -----------------------------------------------------------------------------
// Call + validation helpers
// -----------------------------------------------------------------------------

type ValidationOutcome =
  | { success: true; data: ArtDirectorDecision }
  | { success: false; error: string }

/**
 * Run one Claude call and validate the response against the zod schema
 * plus the photoPlacements-coverage invariant the schema can't see.
 * Returns a discriminated-union outcome; the caller decides whether to
 * retry or throw.
 *
 * The agent delivers its record via a forced tool call, so the SDK
 * hands us an already-parsed object as `tool_use.input` — no `JSON.parse`
 * step needed. We still zod-parse because zod's `.refine` / `.strict`
 * constraints are not expressible as JSON Schema and the API doesn't
 * enforce them.
 */
async function callAndValidate(
  content: Anthropic.Messages.ContentBlockParam[],
  input: ArtDirectorInput,
  requestId: string,
  attempt: 1 | 2,
): Promise<ValidationOutcome> {
  const toolInput = await callClaude(content)
  // Log the raw response (parsed tool input) as one line so grep works.
  // Plan's "log raw response" — with tool-use, this is the decoded object
  // the model emitted via emit_art_direction.input, not the HTTP body.
  console.log(`[AD:${requestId}] attempt ${attempt}/2 response: ${safeStringify(toolInput)}`)

  const parsed = artDirectorSchema.safeParse(toolInput)
  if (!parsed.success) {
    const error = `Schema validation failed: ${parsed.error.message}`
    console.log(`[AD:${requestId}] attempt ${attempt}/2 validation: \u2717 ${error}`)
    return { success: false, error }
  }
  const coverageError = checkPhotoPlacementsCoverage(parsed.data, input)
  if (coverageError) {
    console.log(`[AD:${requestId}] attempt ${attempt}/2 validation: \u2717 ${coverageError}`)
    return { success: false, error: coverageError }
  }
  console.log(`[AD:${requestId}] attempt ${attempt}/2 validation: \u2713 ok`)
  return { success: true, data: parsed.data }
}

/**
 * One Anthropic Messages.create call forcing a tool call on
 * `emit_art_direction`. Returns the tool's parsed input (already JSON-
 * decoded by the SDK). `disable_parallel_tool_use: true` prevents the
 * model from calling multiple tools in one response (we only have one
 * tool here, but the flag is explicit belt-and-suspenders). The tool's
 * `strict: true` asks the API to validate the call's input against our
 * JSON Schema server-side and reject non-conforming calls.
 *
 * Throws if the response contains no `tool_use` block — that shouldn't
 * happen with `tool_choice` forcing, but we defend against the empty-
 * response edge case rather than silently returning undefined to the
 * zod parser.
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
          'Emit the Art Director decision record for this build. This is the ONLY way you deliver your output; call it exactly once with the full record as input.',
        input_schema: ART_DIRECTOR_JSON_SCHEMA,
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
    throw new Error(`Art Director response contained no ${EMIT_TOOL_NAME} tool call`)
  }
  return toolUse.input
}

// -----------------------------------------------------------------------------
// Logging helpers
// -----------------------------------------------------------------------------

/**
 * Stable 8-hex-char request id for this AD call — used as the prefix on
 * every log line emitted by {@link runArtDirector}. Deterministic for a
 * given input so a re-run of the exact same payload produces the same
 * id (useful when correlating a flaky response with an earlier log).
 */
function computeRequestId(input: ArtDirectorInput): string {
  const roles = input.photos.map((p) => p.role).sort().join(',')
  const key = `${input.reference.id}|${hashBusinessSnapshot(input.business)}|${roles}`
  return createHash('sha256').update(key).digest('hex').slice(0, 8)
}

/**
 * Log a one-line input summary at call start — reference, business hash,
 * photo roles with their orientations, palette. Item 6's smoke test
 * greps this to pair an outcome with its inputs.
 */
function logInputSummary(requestId: string, input: ArtDirectorInput): void {
  const photoSummary = input.photos
    .map((p) => (p.orientation ? `${p.role}(${p.orientation})` : p.role))
    .join(',')
  const businessHash = hashBusinessSnapshot(input.business)
  console.log(
    `[AD:${requestId}] input: ref=${input.reference.id} business=${businessHash} photos=[${photoSummary}] palette=${input.palette.primary}/${input.palette.secondary}/${input.palette.accent}`,
  )
}

/**
 * One-line JSON stringify with a length cap so a pathological response
 * can't flood the log. The cap (8KB) is well above a typical AD record
 * (~1-2KB serialized) but low enough to bound an abusive output.
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
  return s.length > MAX ? `${s.slice(0, MAX)}… (truncated ${s.length - MAX} chars)` : s
}

/**
 * Verify the decision's photoPlacements cover the full non-hero,
 * non-logo input photo set exactly — no missing roles, no extra roles,
 * no duplicates. The zod schema enforces uniqueness and non-logo across
 * hero + placements, but it cannot see the input photo set, so this
 * check lives here.
 *
 * Returns null on success, or a human-readable error string on any
 * coverage mismatch. The error flows into the retry prompt verbatim.
 */
function checkPhotoPlacementsCoverage(
  decision: ArtDirectorDecision,
  input: ArtDirectorInput,
): string | null {
  const nonLogoInputRoles = input.photos
    .map((p) => p.role)
    .filter((r): r is Exclude<ProcessedAsset['role'], 'logo'> => r !== 'logo')
  const expected = new Set(nonLogoInputRoles.filter((r) => r !== decision.hero.photoId))
  const got = new Set(decision.photoPlacements.map((p) => p.photoId))
  const missing = [...expected].filter((r) => !got.has(r))
  const extra = [...got].filter((r) => !expected.has(r))
  if (missing.length === 0 && extra.length === 0) return null
  const msgs: string[] = []
  if (missing.length > 0) {
    msgs.push(`missing placements for roles: ${missing.join(', ')}`)
  }
  if (extra.length > 0) {
    msgs.push(`unexpected placements for roles: ${extra.join(', ')} (not in input, or equals hero.photoId)`)
  }
  return `photoPlacements coverage mismatch — ${msgs.join('; ')}`
}

// -----------------------------------------------------------------------------
// User message assembly
// -----------------------------------------------------------------------------

/**
 * Provenance values the agent stamps verbatim into `meta.{referenceId,
 * businessHash, createdAt}`. Kept as a small helper result so the unit
 * test in Step 6 can assert the exact values that flow through.
 */
interface ProvenanceValues {
  referenceId: string
  businessHash: string
  createdAt: string
}

/**
 * Stable 64-bit hash of the business snapshot. Part 2's live loop keys
 * decision records off this to cache across re-renders of the same
 * business. SHA-256 truncated to 16 hex chars (64 bits) — plenty for a
 * cache key at our scale.
 *
 * Deterministic for a given BusinessInfo instance: we construct the
 * object literal with a fixed property order in build.ts, so JSON
 * serialization is stable. If a future caller constructs BusinessInfo
 * with a different key order, add an explicit key-sort here.
 */
function hashBusinessSnapshot(business: BusinessInfo): string {
  return createHash('sha256').update(JSON.stringify(business)).digest('hex').slice(0, 16)
}

/**
 * Compute provenance values that ride into `meta` verbatim. Split out
 * so tests can inject a fixed `createdAt` by calling the internal
 * {@link buildUserMessage} directly; the default clock reads
 * `new Date()` at call time.
 */
function computeProvenance(input: ArtDirectorInput): ProvenanceValues {
  return {
    referenceId: input.reference.id,
    businessHash: hashBusinessSnapshot(input.business),
    createdAt: new Date().toISOString(),
  }
}

/**
 * Serialize the business snapshot as a compact text block for the user
 * message. Omits empty optional fields (slogan, anythingSpecial) so
 * the agent doesn't read "slogan: " as a meaningful signal. Sections
 * are emitted as a boolean list so the agent sees which pages-within-
 * the-page it should be directing content into.
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
 * Media type for each photo's raw variant. Matches the Item 1 pipeline:
 * logos are PNG (processLogo), non-logos are JPEG (processPhoto).
 */
function rawVariantMediaType(role: ProcessedAsset['role']): 'image/png' | 'image/jpeg' {
  return role === 'logo' ? 'image/png' : 'image/jpeg'
}

/**
 * Build the multi-part user-message content array handed to Claude.
 *
 * Ordering is deliberate:
 *   1. A one-line instruction pointing back at the system prompt.
 *   2. The REFERENCE screenshot — labeled as the taste source.
 *   3. Optional reference notes (human-written).
 *   4. Business snapshot text.
 *   5. Palette text.
 *   6. Each input photo's raw variant, labeled by role + orientation.
 *      Logo is included for brand context only and labeled as
 *      "context only; not a valid photoId" — mirrors the system
 *      prompt's FORBIDDEN clause.
 *   7. Provenance values the agent copies verbatim into `meta`.
 *
 * Variants other than raw are NOT shown. The agent picks variants by
 * name from the schema enum; the cloner renders the picked variant
 * from its cache. Loading three renders of the same photo into the
 * user message would just confuse the agent and waste tokens.
 */
function buildUserMessage(input: ArtDirectorInput): Anthropic.Messages.ContentBlockParam[] {
  const content: Anthropic.Messages.ContentBlockParam[] = []

  // 1. Instruction pointer.
  content.push({
    type: 'text',
    text: 'Produce one Art Director decision record for the build described below. Follow the system prompt exactly. Deliver by calling the emit_art_direction tool.',
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

  // 6. Each photo: a label + its raw variant image. Logo is context-only.
  for (const photo of input.photos) {
    const label =
      photo.role === 'logo'
        ? 'Photo — role: logo. Context only: the logo is rendered in the header automatically; do NOT reference "logo" as a photoId in your decision record.'
        : `Photo — role: ${photo.role}, orientation: ${photo.orientation ?? 'unknown'}. Below: the raw variant.`
    content.push({ type: 'text', text: label })
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: rawVariantMediaType(photo.role),
        data: photo.variants.raw.toString('base64'),
      },
    })
  }

  // 7. Provenance values for the meta block — copied verbatim.
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
