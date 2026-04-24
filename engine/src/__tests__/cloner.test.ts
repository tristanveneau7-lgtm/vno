/**
 * Phase Tampa Item 5 Step 5 prompt-structure tests.
 *
 * Not an end-to-end test of cloneToHtml — that requires a live Claude
 * call. These are structural assertions on SYSTEM_PROMPT that guard
 * against regressions: if a future edit accidentally drops the ART
 * DIRECTION or TEXTURE sections, or loses the strip-white-background
 * directive that makes flux ornaments composite correctly, the build
 * would visibly break but we'd only find out end-to-end. These tests
 * fail in CI before that ships.
 *
 * Run: `npm test` or `npx tsx --test src/__tests__/cloner.test.ts`.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SYSTEM_PROMPT } from '../lib/cloner.js'

test('cloner SYSTEM_PROMPT: has ART DIRECTION section', () => {
  assert.match(SYSTEM_PROMPT, /^# ART DIRECTION\b/m, 'prompt must include a "# ART DIRECTION" header')
})

test('cloner SYSTEM_PROMPT: has TEXTURE section', () => {
  assert.match(SYSTEM_PROMPT, /^# TEXTURE\b/m, 'prompt must include a "# TEXTURE" header')
})

test('cloner SYSTEM_PROMPT: TEXTURE section carries the strip-white-background directive for focal ornaments', () => {
  // Light-page strategy (multiply) is the primary directive. Dark-page
  // (invert + screen) is the alternative. At least one must be present,
  // and the section must explicitly identify it as not optional.
  assert.match(
    SYSTEM_PROMPT,
    /mix-blend-mode:\s*multiply/,
    'multiply compositing directive must be present for light-page ornaments',
  )
  assert.match(
    SYSTEM_PROMPT,
    /filter:\s*invert\(1\)[\s\S]+mix-blend-mode:\s*screen/,
    'invert + screen compositing directive must be present for dark-page ornaments',
  )
  assert.match(
    SYSTEM_PROMPT,
    /flux(\/schnell)?\s+(does not|doesn't)\s+honor\s+"transparent background"/i,
    'prompt must explain WHY compositing is required (flux limitation)',
  )
})

test('cloner SYSTEM_PROMPT: carries the "restraint posture" rule for atmosphere', () => {
  assert.match(
    SYSTEM_PROMPT,
    /Restraint posture/,
    'prompt must include a "Restraint posture" subsection in TEXTURE',
  )
  // The actual directive — "CEILING, not the FLOOR" — is the load-bearing
  // phrase that keeps the cloner from over-applying.
  assert.match(
    SYSTEM_PROMPT,
    /CEILING,\s*not the FLOOR/,
    'prompt must state that directives are the ceiling, not the floor',
  )
})

test('cloner SYSTEM_PROMPT: ART DIRECTION section explicitly skips failed ornaments', () => {
  // The cloner must NOT render a broken <img> for a failed ornament.
  // This is the contract with build.ts's buildRenderableDecision, which
  // sets deployPath=null + generationFailed=true on failures.
  assert.match(
    SYSTEM_PROMPT,
    /generationFailed/,
    'prompt must reference the generationFailed field',
  )
  assert.match(
    SYSTEM_PROMPT,
    /SKIP IT|skip it/,
    'prompt must tell the cloner to skip failed ornaments',
  )
})

test('cloner SYSTEM_PROMPT: every image reference comes from artDirection', () => {
  assert.match(
    SYSTEM_PROMPT,
    /Every image reference in your output HTML must come from the `artDirection` record/,
    'prompt must forbid emitting image paths outside the artDirection record',
  )
})

test('cloner SYSTEM_PROMPT: section ordering — ART DIRECTION before TEXTURE', () => {
  const adIdx = SYSTEM_PROMPT.indexOf('# ART DIRECTION')
  const textureIdx = SYSTEM_PROMPT.indexOf('# TEXTURE')
  assert.ok(adIdx > 0, 'ART DIRECTION section must exist')
  assert.ok(textureIdx > 0, 'TEXTURE section must exist')
  assert.ok(
    adIdx < textureIdx,
    'ART DIRECTION must precede TEXTURE (AD specifies the atmospheric enums, TEXTURE teaches how to render them)',
  )
})
