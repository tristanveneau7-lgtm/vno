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
