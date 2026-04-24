/**
 * Phase Tampa Item 4 unit tests — focal ornament generator.
 *
 * Three coverage points required by the plan:
 *   (1) All 3 ornaments succeed → 3 imageUrl records.
 *   (2) 1 of 3 fails → 2 success records + 1 failure record, function still resolves.
 *   (3) All 3 fail → 3 failure records, function still resolves.
 *
 * fal.subscribe is mocked via the test-only `__setFalSubscribeForTesting`
 * hook exported from fal.ts — no network, no real-API spend.
 *
 * Run: `npm test` or `npx tsx --test src/__tests__/fal.test.ts`.
 */
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  generateFocalOrnaments,
  __setFalSubscribeForTesting,
  type FocalOrnamentWithUrl,
} from '../lib/fal.js'
import type { FocalOrnament } from '../types/artDirector.js'

// -----------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------

const MOCK_URL = 'https://fal.mock/ornament.png'

/**
 * Three realistic ornaments. Prompts differ so the "1 of 3" test can
 * dispatch success/failure per input prompt rather than per call index
 * (allSettled fan-out means call order isn't deterministic).
 */
const ORNAMENTS: FocalOrnament[] = [
  {
    anchor: { section: 'hero', position: 'overlapping-top' },
    intent: 'Wave stroke beside the hero headline',
    prompt: 'ink wave stroke — continuous organic line',
    targetSize: 'wide',
  },
  {
    anchor: { section: 'about', position: 'right-margin' },
    intent: 'Arrow pointing from about copy to services',
    prompt: 'ink arrow — sketched wobble',
    targetSize: 'square',
  },
  {
    anchor: { section: 'footer', position: 'center' },
    intent: 'Flourish curl under the footer sign-off',
    prompt: 'ink flourish — single curl',
    targetSize: 'tall',
  },
]

// -----------------------------------------------------------------------------
// Setup / teardown — always restore real fal between tests.
// -----------------------------------------------------------------------------

beforeEach(() => __setFalSubscribeForTesting(null))
afterEach(() => __setFalSubscribeForTesting(null))

// -----------------------------------------------------------------------------
// Helpers for narrowing the discriminated union in assertions.
// -----------------------------------------------------------------------------

function successRecord(r: FocalOrnamentWithUrl): r is Extract<FocalOrnamentWithUrl, { imageUrl: string }> {
  return r.imageUrl !== null
}
function failureRecord(r: FocalOrnamentWithUrl): r is Extract<FocalOrnamentWithUrl, { generationFailed: true }> {
  return r.imageUrl === null
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

test('generateFocalOrnaments: all 3 succeed → 3 imageUrl records', async () => {
  const mock = async () => ({ data: { images: [{ url: MOCK_URL }] } })
  __setFalSubscribeForTesting(mock)

  const results = await generateFocalOrnaments(ORNAMENTS)

  assert.equal(results.length, 3)
  for (const r of results) {
    assert.ok(successRecord(r), `expected success, got failure for "${r.prompt}"`)
    assert.equal(r.imageUrl, MOCK_URL)
    // generationFailed is optional on success; if present must be false.
    if ('generationFailed' in r) assert.equal(r.generationFailed, false)
  }
})

test('generateFocalOrnaments: 1 of 3 fails → 2 success + 1 failure, function resolves', async () => {
  // Dispatch by prompt (not call index) because allSettled fan-out
  // doesn't guarantee call order.
  const mock = async (_endpoint: string, options: { input: unknown }) => {
    const prompt = (options.input as { prompt: string }).prompt
    if (prompt.includes('arrow')) throw new Error('mocked arrow failure')
    return { data: { images: [{ url: MOCK_URL }] } }
  }
  __setFalSubscribeForTesting(mock)

  const results = await generateFocalOrnaments(ORNAMENTS)

  assert.equal(results.length, 3)
  const byPrompt = new Map(results.map((r) => [r.prompt, r]))

  const wave = byPrompt.get('ink wave stroke — continuous organic line')!
  const arrow = byPrompt.get('ink arrow — sketched wobble')!
  const flourish = byPrompt.get('ink flourish — single curl')!

  assert.ok(successRecord(wave))
  assert.equal(wave.imageUrl, MOCK_URL)

  assert.ok(failureRecord(arrow))
  assert.equal(arrow.imageUrl, null)
  assert.equal(arrow.generationFailed, true)
  assert.match(arrow.error, /mocked arrow failure/)

  assert.ok(successRecord(flourish))
  assert.equal(flourish.imageUrl, MOCK_URL)
})

test('generateFocalOrnaments: all 3 fail → 3 failure records, function still resolves', async () => {
  const mock = async () => {
    throw new Error('mocked total fal outage')
  }
  __setFalSubscribeForTesting(mock)

  const results = await generateFocalOrnaments(ORNAMENTS)

  assert.equal(results.length, 3)
  for (const r of results) {
    assert.ok(failureRecord(r))
    assert.equal(r.imageUrl, null)
    assert.equal(r.generationFailed, true)
    assert.match(r.error, /mocked total fal outage/)
  }
})

test('generateFocalOrnaments: empty input → empty output, no fal calls', async () => {
  // Defensive corner — if the AD emits zero focal ornaments (quiet
  // editorial reference), we should not call fal at all.
  let calls = 0
  __setFalSubscribeForTesting(async () => {
    calls++
    return { data: { images: [{ url: MOCK_URL }] } }
  })
  const results = await generateFocalOrnaments([])
  assert.equal(results.length, 0)
  assert.equal(calls, 0)
})

test('generateFocalOrnaments: empty images array → failure record', async () => {
  // fal occasionally returns an empty images array for borderline prompts
  // even on success response. generateOneFocalOrnamentUrl treats this as
  // failure ("returned no image URL"), and the batch wrapper translates
  // it into a failure record without tanking the rest.
  const mock = async (_endpoint: string, options: { input: unknown }) => {
    const prompt = (options.input as { prompt: string }).prompt
    if (prompt.includes('arrow')) return { data: { images: [] } }
    return { data: { images: [{ url: MOCK_URL }] } }
  }
  __setFalSubscribeForTesting(mock)

  const results = await generateFocalOrnaments(ORNAMENTS)
  const arrow = results.find((r) => r.prompt.includes('arrow'))!
  assert.ok(failureRecord(arrow))
  assert.match(arrow.error, /no image URL/)
})
