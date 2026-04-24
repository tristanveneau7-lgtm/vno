/**
 * Phase Tampa Part 1.5 Item 2 Step 5 unit tests.
 *
 * Runs via Node's built-in test runner (already wired into
 * `npm test` via `tsx --test src/__tests__/*.test.ts`):
 *   npx tsx --test src/__tests__/critic.test.ts
 *
 * Six coverage points required by the plan (three mock-client
 * scenarios + three schema / invariant regressions):
 *
 *   (1) Happy path: first attempt returns a valid decision →
 *       runCritic resolves with that decision, stub called once.
 *       Assert model + tool-name as regression guards for silent
 *       model swaps or tool-name drift.
 *   (2) Retry-then-succeed: first attempt drifts meta.referenceId,
 *       second attempt valid → resolves with the second decision,
 *       stub called twice.
 *   (3) Retry-then-throw: both attempts drift meta.round →
 *       rejects with /failed validation after retry/, stub called
 *       twice.
 *   (4) CRITIC_JSON_SCHEMA: zero unsupported validation keywords
 *       survive sanitization (same discipline as the AD's
 *       regression).
 *   (5) CRITIC_JSON_SCHEMA: every object-shaped node has
 *       `additionalProperties === false`.
 *   (6) checkProvenanceConsistency regression: a response that
 *       passes zod validation but has a drifted meta.referenceId
 *       triggers the retry path, AND the error message reads
 *       "provenance consistency mismatch" (NOT "Schema validation
 *       failed"). Proves the external invariant is doing
 *       independent work beyond zod.
 *
 * The Anthropic client is mocked via the test-only
 * `__setMessagesCreateForTesting` hook exported from critic.ts —
 * zero network calls, zero real-API spend. Mirrors
 * artDirector.test.ts's pattern exactly.
 */
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import type Anthropic from '@anthropic-ai/sdk'
import {
  runCritic,
  __setMessagesCreateForTesting,
  CRITIC_JSON_SCHEMA,
  type CriticInput,
} from '../lib/critic.js'
import { SAMPLE_DECISION } from '../types/artDirector.js'
import { SAMPLE_CRITIQUE, type CriticDecision } from '../types/critic.js'

// -----------------------------------------------------------------------------
// Shared fixtures
// -----------------------------------------------------------------------------

/**
 * A minimal CriticInput whose provenance fields line up exactly with
 * what FORGED_CRITIQUE carries in meta. Building the alignment here
 * (rather than mutating SAMPLE_CRITIQUE at test time) keeps the
 * fixture static and the assertions obvious.
 *
 * Uses SAMPLE_DECISION as the artDirection (its
 * meta.businessHash='driftline-coffee-2026-04' is the hash the forged
 * critique's meta.businessHash must match) and reference.id='tidescape'
 * (matches the AD's reference in SAMPLE_DECISION).
 */
const TEST_INPUT: CriticInput = {
  artDirection: SAMPLE_DECISION,
  html: '<html><body><h1>Driftline Coffee Roasters</h1><p>Small-batch coffee from the coast.</p></body></html>',
  reference: {
    id: 'tidescape',
    url: 'https://tidescape.example',
    screenshotPng: Buffer.from([0x89, 0x50, 0x4e, 0x47]), // PNG header stub
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
  palette: { primary: '#b8733a', secondary: '#143249', accent: '#fffaf5' },
  round: 1,
}

/**
 * SAMPLE_CRITIQUE's meta is wired for the Lumar fixture in the schema
 * module. Rewrite its meta to match TEST_INPUT's provenance so the
 * happy-path test doesn't immediately trip the provenance check.
 * Everything else (verdict, score, critiques, preserve) stays identical
 * to SAMPLE_CRITIQUE.
 */
const FORGED_CRITIQUE: CriticDecision = {
  ...SAMPLE_CRITIQUE,
  meta: {
    ...SAMPLE_CRITIQUE.meta,
    referenceId: TEST_INPUT.reference.id,
    businessHash: TEST_INPUT.artDirection.meta.businessHash,
    round: TEST_INPUT.round,
  },
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
        name: 'emit_critique',
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

// Always restore the real client between tests so a test that forgets
// to reset doesn't poison later tests.
beforeEach(() => {
  __setMessagesCreateForTesting(null)
})
afterEach(() => {
  __setMessagesCreateForTesting(null)
})

// -----------------------------------------------------------------------------
// Tests — mock-client scenarios (1-3)
// -----------------------------------------------------------------------------

test('runCritic: first attempt returns a valid decision → resolves without retry', async () => {
  const mock = makeMockCreate([mockToolUseMessage(FORGED_CRITIQUE)])
  __setMessagesCreateForTesting(mock)

  const decision = await runCritic(TEST_INPUT)

  assert.equal(mock.calls, 1, 'stub should be called exactly once on happy path')
  assert.deepEqual(decision, FORGED_CRITIQUE, 'returned decision should equal mocked tool input')

  // Regression guards for silent model swaps and tool-name drift.
  assert.ok(mock.lastParams, 'lastParams should be populated')
  assert.equal(mock.lastParams!.model, 'claude-opus-4-7', 'model pinned to Opus 4.7')
  assert.ok(Array.isArray(mock.lastParams!.tools), 'tools array present')
  assert.equal(
    mock.lastParams!.tools?.[0]?.name,
    'emit_critique',
    'tool named emit_critique',
  )
})

test('runCritic: first drifts meta.referenceId, second succeeds → resolves after one retry', async () => {
  // Invalid first response: meta.referenceId drifted. This passes zod
  // (non-empty string) but fails checkProvenanceConsistency — which is
  // exactly the path we want to exercise. Second response is the clean
  // FORGED_CRITIQUE.
  const drifted = {
    ...FORGED_CRITIQUE,
    meta: { ...FORGED_CRITIQUE.meta, referenceId: 'not-tidescape' },
  }
  const mock = makeMockCreate([
    mockToolUseMessage(drifted),
    mockToolUseMessage(FORGED_CRITIQUE),
  ])
  __setMessagesCreateForTesting(mock)

  const decision = await runCritic(TEST_INPUT)

  assert.equal(mock.calls, 2, 'stub should be called exactly twice (one retry)')
  assert.deepEqual(
    decision,
    FORGED_CRITIQUE,
    'returned decision should be the second (valid) response',
  )
})

test('runCritic: both attempts drift meta.round → rejects with "after retry" error', async () => {
  // Drifted round passes zod (round=2 is a valid literal) but fails
  // provenance consistency (TEST_INPUT.round === 1). Same failure
  // twice → throws.
  const drifted = {
    ...FORGED_CRITIQUE,
    meta: { ...FORGED_CRITIQUE.meta, round: 2 as const },
  }
  const mock = makeMockCreate([
    mockToolUseMessage(drifted),
    mockToolUseMessage(drifted),
  ])
  __setMessagesCreateForTesting(mock)

  await assert.rejects(
    () => runCritic(TEST_INPUT),
    (err: Error) => {
      assert.match(err.message, /failed validation after retry/)
      return true
    },
    'should throw after second failure',
  )
  assert.equal(mock.calls, 2, 'stub should be called exactly twice before throwing')
})

// -----------------------------------------------------------------------------
// Tests — Anthropic JSON Schema sanitization (4-5)
//
// Critic-specific regressions; the general sanitizer-walker unit
// tests live in artDirector.test.ts since the sanitizer itself is
// owned by artDirector.ts. These two tests verify that the Critic's
// specific schema — emitted through `zodToJsonSchema(criticSchema)` +
// the sanitizer — produces the invariants Anthropic's tool-use
// validator requires.
// -----------------------------------------------------------------------------

test('CRITIC_JSON_SCHEMA: no unsupported validation keywords survive sanitization', () => {
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

  const findings = walk(CRITIC_JSON_SCHEMA, '$')
  assert.deepEqual(
    findings,
    [],
    `CRITIC_JSON_SCHEMA contains unsupported validation keywords at: ${findings.join(', ')}`,
  )
})

test('CRITIC_JSON_SCHEMA: every object-shaped node has additionalProperties === false', () => {
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

  const objectNodes = walkObjects(CRITIC_JSON_SCHEMA)
  assert.ok(
    objectNodes.length > 0,
    'sanity check: at least one object-shaped node in the Critic schema',
  )
  const offenders = objectNodes.filter((n) => n.additionalProperties !== false)
  assert.deepEqual(
    offenders,
    [],
    `object-shaped nodes with additionalProperties !== false: ${JSON.stringify(offenders, null, 2)}`,
  )
})

// -----------------------------------------------------------------------------
// Tests — checkProvenanceConsistency regression (6)
//
// The provenance check is the Critic's external invariant — the
// schema can't see the input context, so this check lives in the
// module. This regression proves the check is doing work zod does
// not: a decision that passes zod validation but has a drifted
// meta.referenceId must be rejected via the provenance path, and
// the retry-then-throw error message must name "provenance
// consistency mismatch" (not "Schema validation failed"). If someone
// accidentally deletes `checkProvenanceConsistency` from
// `callAndValidate`, this test fails loudly.
// -----------------------------------------------------------------------------

test('checkProvenanceConsistency: zod-valid but drifted meta.referenceId fails via provenance path (not schema path)', async () => {
  const drifted = {
    ...FORGED_CRITIQUE,
    meta: { ...FORGED_CRITIQUE.meta, referenceId: 'imposter-reference' },
  }
  const mock = makeMockCreate([
    mockToolUseMessage(drifted),
    mockToolUseMessage(drifted),
  ])
  __setMessagesCreateForTesting(mock)

  await assert.rejects(
    () => runCritic(TEST_INPUT),
    (err: Error) => {
      // Must fail via the provenance invariant, NOT zod schema validation.
      assert.match(
        err.message,
        /provenance consistency mismatch/,
        'error message should name the provenance failure path',
      )
      assert.doesNotMatch(
        err.message,
        /Schema validation failed/,
        'must NOT be a zod-schema-validation failure — the record passed zod',
      )
      // And the specific drifted field should be named in the error.
      assert.match(
        err.message,
        /meta\.referenceId/,
        'error should identify the drifted field',
      )
      return true
    },
  )
  assert.equal(
    mock.calls,
    2,
    'provenance failure should trigger the retry path (2 calls), same as a zod failure',
  )
})
