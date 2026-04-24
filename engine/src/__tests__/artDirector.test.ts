/**
 * Phase Tampa Item 3 Step 6 unit tests.
 *
 * Runs via Node's built-in test runner (no jest/vitest dep needed):
 *   npx tsx --test src/__tests__/artDirector.test.ts
 *
 * Three coverage points required by the plan:
 *   (1) Happy path: first attempt returns a valid decision → runArtDirector
 *       resolves with that decision and the stub is called exactly once.
 *   (2) Retry-then-succeed: first attempt returns something that fails
 *       validation, second attempt returns a valid decision → resolves
 *       with the second decision and stub is called exactly twice.
 *   (3) Retry-then-throw: both attempts fail validation → rejects with
 *       an error mentioning "after retry" and stub is called exactly twice.
 *
 * The Anthropic client is mocked via the test-only
 * `__setMessagesCreateForTesting` hook exported from artDirector.ts —
 * zero network calls, zero real-API spend.
 */
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import type Anthropic from '@anthropic-ai/sdk'
import {
  runArtDirector,
  __setMessagesCreateForTesting,
  ART_DIRECTOR_JSON_SCHEMA,
  sanitizeJsonSchemaForAnthropic,
  type ArtDirectorInput,
} from '../lib/artDirector.js'
import { SAMPLE_DECISION } from '../types/artDirector.js'

// -----------------------------------------------------------------------------
// Shared fixtures
// -----------------------------------------------------------------------------

/**
 * A minimal ArtDirectorInput whose non-logo photo roles exactly cover
 * SAMPLE_DECISION's {hero.photoId='hero', placements=[outside, inside]}.
 * Coverage check requires:
 *   non-logo input roles == {hero.photoId} ∪ {placements[*].photoId}
 * so the input must have logo + outside + inside + hero.
 */
const TEST_INPUT: ArtDirectorInput = {
  reference: {
    id: 'tidescape',
    url: 'https://tidescape.example',
    screenshotPng: Buffer.from([]),
    notes: 'quiet editorial',
  },
  business: {
    name: 'Driftline Coffee Roasters',
    address: '123 Marina',
    phone: '555-0199',
    hours: 'Mon-Fri 8-5',
    sections: { landing: true, about: true, pricing: false },
    vertical: 'restaurant',
  },
  photos: [
    {
      role: 'logo',
      orientation: null,
      variants: { raw: Buffer.from([]), duotone: Buffer.from([]), cutout: Buffer.from([]) },
    },
    {
      role: 'outside',
      orientation: 'landscape',
      variants: { raw: Buffer.from([]), duotone: Buffer.from([]), cutout: Buffer.from([]) },
    },
    {
      role: 'inside',
      orientation: 'portrait',
      variants: { raw: Buffer.from([]), duotone: Buffer.from([]), cutout: Buffer.from([]) },
    },
    {
      role: 'hero',
      orientation: 'landscape',
      variants: { raw: Buffer.from([]), duotone: Buffer.from([]), cutout: Buffer.from([]) },
    },
  ],
  palette: { primary: '#b8733a', secondary: '#143249', accent: '#fffaf5' },
}

// -----------------------------------------------------------------------------
// Mock helpers
// -----------------------------------------------------------------------------

/**
 * Build a fake Anthropic Messages.Message containing one `tool_use`
 * block whose `input` is the given decision record. Only the fields
 * `callClaude` actually reads are populated; the rest is cast through.
 */
function mockToolUseMessage(toolInput: unknown): Anthropic.Messages.Message {
  return {
    content: [
      {
        type: 'tool_use',
        id: 'toolu_test',
        name: 'emit_art_direction',
        input: toolInput,
      },
    ],
  } as unknown as Anthropic.Messages.Message
}

/**
 * A stub `messages.create` that returns a queued response per call.
 * Tracks call count so tests can assert how many attempts were made.
 * Throws if drained — that surfaces as a test failure rather than a
 * silent undefined return.
 */
interface MockCreateFn {
  (params: Anthropic.Messages.MessageCreateParams): Promise<Anthropic.Messages.Message>
  calls: number
  lastParams: Anthropic.Messages.MessageCreateParams | null
}

function makeMockCreate(responses: Anthropic.Messages.Message[]): MockCreateFn {
  let calls = 0
  let lastParams: Anthropic.Messages.MessageCreateParams | null = null
  const fn = async (
    params: Anthropic.Messages.MessageCreateParams,
  ): Promise<Anthropic.Messages.Message> => {
    if (calls >= responses.length) {
      throw new Error(`mock messages.create exhausted at call ${calls + 1}`)
    }
    lastParams = params
    const response = responses[calls]
    calls++
    return response
  }
  const out = fn as unknown as MockCreateFn
  Object.defineProperty(out, 'calls', { get: () => calls })
  Object.defineProperty(out, 'lastParams', { get: () => lastParams })
  return out
}

// -----------------------------------------------------------------------------
// Test setup / teardown
// -----------------------------------------------------------------------------

// Always restore the real client between tests so a test that forgets to
// reset doesn't poison later tests.
beforeEach(() => {
  __setMessagesCreateForTesting(null)
})
afterEach(() => {
  __setMessagesCreateForTesting(null)
})

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

test('runArtDirector: first attempt returns a valid decision → resolves without retry', async () => {
  const mock = makeMockCreate([mockToolUseMessage(SAMPLE_DECISION)])
  __setMessagesCreateForTesting(mock)

  const decision = await runArtDirector(TEST_INPUT)

  assert.equal(mock.calls, 1, 'stub should be called exactly once on happy path')
  assert.deepEqual(decision, SAMPLE_DECISION, 'returned decision should equal mocked tool input')
  // Sanity: the tool invocation params were constructed correctly.
  assert.ok(mock.lastParams, 'lastParams should be populated')
  assert.equal(mock.lastParams!.model, 'claude-opus-4-7', 'model pinned to Opus')
  assert.ok(Array.isArray(mock.lastParams!.tools), 'tools array present')
  assert.equal(
    mock.lastParams!.tools?.[0]?.name,
    'emit_art_direction',
    'tool named emit_art_direction',
  )
})

test('runArtDirector: first fails validation, second succeeds → resolves after one retry', async () => {
  // Invalid first response: `hero` field replaced with `null`, which zod
  // rejects at the object-required-field level. Second response is the
  // full valid SAMPLE_DECISION.
  const invalidFirst = { ...SAMPLE_DECISION, hero: null }
  const mock = makeMockCreate([
    mockToolUseMessage(invalidFirst),
    mockToolUseMessage(SAMPLE_DECISION),
  ])
  __setMessagesCreateForTesting(mock)

  const decision = await runArtDirector(TEST_INPUT)

  assert.equal(mock.calls, 2, 'stub should be called exactly twice (one retry)')
  assert.deepEqual(decision, SAMPLE_DECISION, 'returned decision should be the second (valid) response')
})

// -----------------------------------------------------------------------------
// Anthropic JSON Schema sanitization (Item 5 regression — Anthropic's
// tool-use validator rejects validation keywords like maxItems/format/etc.
// We strip them from the schema we send, keep zod as the runtime truth.)
// -----------------------------------------------------------------------------

test('ART_DIRECTOR_JSON_SCHEMA: no unsupported validation keywords survive sanitization', () => {
  // Keywords Anthropic's tool-use validator is known (or strongly
  // suspected) to reject. Must match the set maintained in
  // artDirector.ts. Walk the schema tree and assert none appear anywhere.
  const UNSUPPORTED = [
    'maxItems', 'minItems', 'uniqueItems',
    'minLength', 'maxLength', 'pattern', 'format',
    'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
    'minProperties', 'maxProperties', 'patternProperties',
  ]

  function walk(node: unknown, path: string): string[] {
    if (Array.isArray(node)) {
      return node.flatMap((item, i) => walk(item, `${path}[${i}]`))
    }
    if (node !== null && typeof node === 'object') {
      const findings: string[] = []
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (UNSUPPORTED.includes(k)) findings.push(`${path}.${k}`)
        findings.push(...walk(v, `${path}.${k}`))
      }
      return findings
    }
    return []
  }

  const findings = walk(ART_DIRECTOR_JSON_SCHEMA, '$')
  assert.deepEqual(
    findings,
    [],
    `ART_DIRECTOR_JSON_SCHEMA contains unsupported validation keywords at: ${findings.join(', ')}`,
  )
})

test('ART_DIRECTOR_JSON_SCHEMA: every object-shaped node has additionalProperties === false', () => {
  // Anthropic's tool-use validator 400s on `additionalProperties` set
  // to anything other than `false` (or absent). z.record(...) emits an
  // object-valued additionalProperties; .strict() zod objects emit
  // false; unannotated objects emit undefined. The sanitizer normalizes
  // all three to the literal `false`. This test walks the actual
  // exported schema and asserts that invariant end-to-end.

  type ObjectNode = { path: string; additionalProperties: unknown }
  function walkObjects(node: unknown, path = '$'): ObjectNode[] {
    if (Array.isArray(node)) {
      return node.flatMap((item, i) => walkObjects(item, `${path}[${i}]`))
    }
    if (node !== null && typeof node === 'object') {
      const rec = node as Record<string, unknown>
      const out: ObjectNode[] = []
      const isObjectShaped = rec.type === 'object' || 'properties' in rec
      if (isObjectShaped) {
        out.push({ path, additionalProperties: rec.additionalProperties })
      }
      for (const [k, v] of Object.entries(rec)) {
        out.push(...walkObjects(v, `${path}.${k}`))
      }
      return out
    }
    return []
  }

  const objectNodes = walkObjects(ART_DIRECTOR_JSON_SCHEMA)
  assert.ok(objectNodes.length > 0, 'sanity check: at least one object-shaped node in schema')
  const offenders = objectNodes.filter((n) => n.additionalProperties !== false)
  assert.deepEqual(
    offenders,
    [],
    `object-shaped nodes with additionalProperties !== false: ${JSON.stringify(offenders, null, 2)}`,
  )
})

test('sanitizeJsonSchemaForAnthropic: coerces object-valued additionalProperties to false', () => {
  // z.record(...) emits this exact shape — the root cause of the
  // Anthropic 400 that this fix responds to.
  const input = {
    type: 'object',
    properties: {
      confidence: {
        type: 'object',
        additionalProperties: { type: 'number' }, // object-valued → must become false
      },
    },
  }
  const out = sanitizeJsonSchemaForAnthropic(input) as typeof input
  assert.equal(out.properties.confidence.additionalProperties, false)
})

test('sanitizeJsonSchemaForAnthropic: adds additionalProperties: false on object nodes missing it', () => {
  // An unannotated zod object (no .strict(), no .passthrough()) might
  // emit a node without additionalProperties. Anthropic wants it
  // explicit — the sanitizer adds it.
  const input = {
    type: 'object',
    properties: {
      inner: { type: 'object', properties: { x: { type: 'string' } } },
    },
  }
  const out = sanitizeJsonSchemaForAnthropic(input) as typeof input & {
    additionalProperties: unknown
    properties: { inner: { additionalProperties: unknown } }
  }
  assert.equal(out.additionalProperties, false, 'root object gets additionalProperties: false')
  assert.equal(out.properties.inner.additionalProperties, false, 'nested object gets additionalProperties: false')
})

test('sanitizeJsonSchemaForAnthropic: leaves non-object nodes untouched (no additionalProperties added)', () => {
  // Strings, arrays, enum-only nodes — none should gain additionalProperties.
  const input = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      role: { enum: ['a', 'b'] }, // no type key, no properties — not object-shaped
    },
  }
  const out = sanitizeJsonSchemaForAnthropic(input) as typeof input & {
    properties: {
      name: Record<string, unknown>
      tags: Record<string, unknown>
      role: Record<string, unknown>
    }
  }
  assert.equal('additionalProperties' in out.properties.name, false, 'string node should not get additionalProperties')
  assert.equal('additionalProperties' in out.properties.tags, false, 'array node should not get additionalProperties')
  assert.equal('additionalProperties' in out.properties.role, false, 'enum-only node should not get additionalProperties')
})

test('sanitizeJsonSchemaForAnthropic: strips maxItems / minLength / format anywhere in the tree', () => {
  // Direct unit test of the walker — independent of the zod schema so a
  // refactor of zod-to-json-schema's output shape doesn't mask a bug in
  // the stripper itself.
  const input = {
    type: 'object',
    properties: {
      tags: { type: 'array', maxItems: 5, items: { type: 'string', minLength: 1 } },
      email: { type: 'string', format: 'email', pattern: '.+@.+' },
      score: { type: 'number', minimum: 0, maximum: 1 },
      nested: {
        type: 'object',
        properties: {
          list: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string' } },
        },
      },
    },
  }
  const out = sanitizeJsonSchemaForAnthropic(input) as typeof input
  assert.equal('maxItems' in out.properties.tags, false)
  assert.equal('minLength' in out.properties.tags.items, false)
  assert.equal('format' in out.properties.email, false)
  assert.equal('pattern' in out.properties.email, false)
  assert.equal('minimum' in out.properties.score, false)
  assert.equal('maximum' in out.properties.score, false)
  assert.equal('minItems' in out.properties.nested.properties.list, false)
  assert.equal('uniqueItems' in out.properties.nested.properties.list, false)
  // Structural keywords survive.
  assert.equal(out.type, 'object')
  assert.equal(out.properties.tags.type, 'array')
  assert.equal(out.properties.tags.items.type, 'string')
  // Input is not mutated.
  assert.equal(input.properties.tags.maxItems, 5)
})

test('runArtDirector: 4-ornament response still rejected at zod layer post-sanitize', async () => {
  // Regression for the Anthropic-maxItems-stripping fix. The API no
  // longer enforces focalOrnaments.max(3) server-side (we stripped
  // maxItems from its view of the schema), but zod's refinement is
  // unchanged and must still reject over-3 responses in callAndValidate.
  // If zod stopped catching this, the "scarcity" invariant would quietly
  // erode and 4+ ornaments would ship.
  const tooMany = {
    ...SAMPLE_DECISION,
    focalOrnaments: [
      SAMPLE_DECISION.focalOrnaments[0]!,
      SAMPLE_DECISION.focalOrnaments[0]!,
      SAMPLE_DECISION.focalOrnaments[0]!,
      SAMPLE_DECISION.focalOrnaments[0]!,
    ],
  }
  const mock = makeMockCreate([
    mockToolUseMessage(tooMany),
    mockToolUseMessage(tooMany),
  ])
  __setMessagesCreateForTesting(mock)

  await assert.rejects(
    () => runArtDirector(TEST_INPUT),
    (err: Error) => {
      assert.match(err.message, /failed validation after retry/)
      // The retry prompt should include zod's specific error about the
      // max-3 array constraint, which is how the model learns what to fix.
      return true
    },
    'zod must still reject 4 ornaments even though the API schema no longer does',
  )
  assert.equal(mock.calls, 2, 'both attempts should fire before the throw')
})

test('runArtDirector: both attempts fail validation → rejects with "after retry" error', async () => {
  // Coverage mismatch: second placement swapped to 'hero' means both
  // hero.photoId and photoPlacements[1].photoId are 'hero'. The zod
  // schema's .superRefine rejects duplicate photoId across the record,
  // so this is a zod failure, not a coverage failure — same retry path.
  const invalid = {
    ...SAMPLE_DECISION,
    photoPlacements: [
      SAMPLE_DECISION.photoPlacements[0],
      { ...SAMPLE_DECISION.photoPlacements[1], photoId: 'hero' as const },
    ],
  }
  const mock = makeMockCreate([
    mockToolUseMessage(invalid),
    mockToolUseMessage(invalid),
  ])
  __setMessagesCreateForTesting(mock)

  await assert.rejects(
    () => runArtDirector(TEST_INPUT),
    (err: Error) => {
      assert.match(err.message, /failed validation after retry/)
      return true
    },
    'should throw after second failure',
  )
  assert.equal(mock.calls, 2, 'stub should be called exactly twice before throwing')
})
