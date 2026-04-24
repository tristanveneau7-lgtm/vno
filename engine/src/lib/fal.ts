import { fal } from '@fal-ai/client'
import type { FocalOrnament } from '../types/artDirector.js'

// fal.ai client reads FAL_KEY from env on first use
fal.config({ credentials: process.env.FAL_KEY })

// -----------------------------------------------------------------------------
// Test-only override for fal.subscribe
// -----------------------------------------------------------------------------

/**
 * Callable shape of `fal.subscribe` as used in this module — endpoint
 * string + options object, returns whatever fal returns (typed as
 * `unknown` so callers cast to their expected shape, same pattern as
 * the real client).
 */
type FalSubscribeFn = (endpoint: string, options: { input: unknown; logs?: boolean }) => Promise<unknown>

let _falSubscribeOverride: FalSubscribeFn | null = null

/**
 * Test-only hook to replace all fal.subscribe calls inside this module
 * with a stub. Matches the pattern used in {@link artDirector.ts}:
 * `__` + `ForTesting` suffix marks it as non-production. Pass `null` to
 * restore the real client.
 */
export function __setFalSubscribeForTesting(fn: FalSubscribeFn | null): void {
  _falSubscribeOverride = fn
}

/** Dispatch helper — uses the override if set, falls through to the real client. */
async function subscribeFn(endpoint: string, options: { input: unknown; logs?: boolean }): Promise<unknown> {
  if (_falSubscribeOverride) return _falSubscribeOverride(endpoint, options)
  return fal.subscribe(endpoint, options as Parameters<typeof fal.subscribe>[1])
}

/**
 * fal.ai birefnet/v2 model variant to use for cutouts. Phase Tampa Item 1
 * Step 3 provider pick: BiRefNet (bilateral reference network) is the
 * state-of-the-art open-weights segmentation model in 2025-26 and fal.ai's
 * v2 endpoint exposes six variants. "General Use (Heavy)" is tuned for
 * general photography (storefronts, interiors, product, people) which
 * covers our four photo roles. @imgly/background-removal-node was
 * considered and rejected due to AGPL v3 license incompatibility with
 * VNO's closed-source engine (AGPL §13 network-service clause).
 */
const BIREFNET_MODEL = 'General Use (Heavy)' as const

/**
 * Remove the background from a photo, returning a PNG buffer with alpha.
 *
 * Uses fal.ai's BiRefNet v2 endpoint (see {@link BIREFNET_MODEL} for the
 * variant pick + provider reasoning). `refine_foreground: true` applies a
 * post-pass that cleans up edge feathering — the extra ~100-200ms is worth
 * it for hair/fur cases that would otherwise shred.
 *
 * The input buffer is uploaded to fal.ai's storage via the client's
 * `fal.storage.upload` helper (it accepts a Blob; we wrap the raw buffer
 * in one). Passing a data URI directly as `image_url` is the other
 * supported path but fails or truncates for >1MB inputs, which our 1920-
 * wide JPEGs frequently exceed — the storage upload is more reliable.
 *
 * Typical wall-clock: ~1-2s (upload + inference + download). Well under
 * Item 1's <3s/photo budget. Cost: ~$0.01-0.02 per call (confirmed on
 * first live build — see Item 1 Step 3 smoke run).
 */
export async function removeBackground(imageBuf: Buffer): Promise<Buffer> {
  // Blob wrap so we can hand off to fal.storage.upload. The MIME hint is
  // decorative — fal detects by content, but correct MIME helps debuggers.
  // Wrapping the Buffer in a Uint8Array view (zero-copy) instead of
  // passing the Buffer directly keeps the Blob constructor type-safe
  // regardless of whether @types/node exposes Buffer.buffer as
  // ArrayBufferLike vs strict ArrayBuffer (the standalone-tsc delta).
  const view = new Uint8Array(imageBuf.buffer, imageBuf.byteOffset, imageBuf.byteLength)
  const blob = new Blob([view], { type: 'image/jpeg' })
  const imageUrl = await fal.storage.upload(blob)

  const result = (await subscribeFn('fal-ai/birefnet/v2', {
    input: {
      image_url: imageUrl,
      model: BIREFNET_MODEL,
      refine_foreground: true,
      output_format: 'png',
    },
    logs: false,
  })) as { data?: { image?: { url: string } } }

  const resultUrl = result.data?.image?.url
  if (!resultUrl) throw new Error('fal.ai birefnet returned no image')

  const response = await fetch(resultUrl)
  if (!response.ok) {
    throw new Error(`Failed to download fal.ai cutout: ${response.status}`)
  }
  const ab = await response.arrayBuffer()
  return Buffer.from(ab)
}

// -----------------------------------------------------------------------------
// Focal ornament generation (Phase Tampa Item 4)
// -----------------------------------------------------------------------------

/**
 * Map `FocalOrnament.targetSize` enum values to fal.ai `image_size`
 * dimensions. Must match the JSDoc on the schema's `ornamentSizeEnum`:
 *   wide   → 1024×512   (banner-like)
 *   square → 1024×1024  (medallion-like)
 *   tall   → 512×1024   (portrait mark)
 */
const ORNAMENT_DIMENSIONS: Record<FocalOrnament['targetSize'], { width: number; height: number }> = {
  wide: { width: 1024, height: 512 },
  square: { width: 1024, height: 1024 },
  tall: { width: 512, height: 1024 },
}

/**
 * Result of generating one ornament. Discriminated on
 * `generationFailed`:
 *   - success: `{ ...ornament, imageUrl: string, generationFailed?: false }`
 *   - failure: `{ ...ornament, imageUrl: null, generationFailed: true, error: string }`
 *
 * The failure variant exists so `generateFocalOrnaments` can always
 * resolve — a single ornament failure does not fail the batch. Callers
 * in the build pipeline (Item 5) render what succeeded and skip what
 * didn't; the cloner is told explicitly to not attempt placing failed
 * ornaments.
 */
export type FocalOrnamentWithUrl =
  | (FocalOrnament & { imageUrl: string; generationFailed?: false })
  | (FocalOrnament & { imageUrl: null; generationFailed: true; error: string })

/**
 * Turn the Art Director's focal ornament specs into resolved URLs, one
 * per input ornament.
 *
 * Runs up to 3 flux/schnell calls in parallel via `Promise.allSettled`
 * so a single ornament's failure (rate limit, transient server issue,
 * prompt rejected by content classifier) does not fail the build — the
 * successful ornaments still ship. Per-ornament failures log here;
 * the cloner sees the failure flag in its inputs and skips the anchor.
 *
 * AD prompts are handed to fal verbatim. The system prompt in
 * {@link artDirector.ts} instructs the agent to write flux-ready
 * prompts, so no framing wrappers are added here — if the AD's prompt
 * style breaks flux, that's an AD prompt bug, not this function's.
 *
 * Cost: ~$0.003 per ornament × 3 max = ~$0.01 per build. Wall-clock
 * bounded by the slowest single call (~3-5s for schnell at 1024px).
 */
export async function generateFocalOrnaments(
  ornaments: FocalOrnament[],
): Promise<FocalOrnamentWithUrl[]> {
  const settled = await Promise.allSettled(
    ornaments.map((ornament) => generateOneFocalOrnamentUrl(ornament)),
  )
  return settled.map((result, i): FocalOrnamentWithUrl => {
    const ornament = ornaments[i]!
    if (result.status === 'fulfilled') {
      return { ...ornament, imageUrl: result.value }
    }
    const errMsg = result.reason instanceof Error ? result.reason.message : String(result.reason)
    // Per-ornament failures log here so the trail shows which anchors
    // got skipped and why — build.ts's summary log (Item 5) will add
    // the roll-up counts.
    console.log(`[ornament] generation failed for "${ornament.intent}": ${errMsg}`)
    return {
      ...ornament,
      imageUrl: null,
      generationFailed: true,
      error: errMsg,
    }
  })
}

/**
 * One flux/schnell generation. Returns the hosted fal URL directly —
 * no download. Item 5 handles downloading each URL to a Buffer for
 * Netlify deploy; fal URLs are short-lived so the download must follow
 * promptly after this call returns.
 */
async function generateOneFocalOrnamentUrl(ornament: FocalOrnament): Promise<string> {
  const size = ORNAMENT_DIMENSIONS[ornament.targetSize]
  const result = (await subscribeFn('fal-ai/flux/schnell', {
    input: {
      prompt: ornament.prompt, // verbatim — AD writes the prompt
      image_size: size,
      num_inference_steps: 4, // schnell's sweet spot
      enable_safety_checker: false, // abstract illustrations, not photos
    },
    logs: false,
  })) as { data?: { images?: Array<{ url: string }> } }
  const url = result.data?.images?.[0]?.url
  if (!url) throw new Error('fal.ai returned no image URL for focal ornament')
  return url
}
