import { fal } from '@fal-ai/client'

// fal.ai client reads FAL_KEY from env on first use
fal.config({ credentials: process.env.FAL_KEY })

const GRAIN_PROMPT =
  'subtle film grain texture, monochromatic noise, organic, slightly warm undertone, seamless tile, 5% intensity, clean'
const BADGE_PROMPT = (year: string) =>
  `vintage stamp graphic, circular, "EST ${year}" text in center, ink stamp aesthetic, slightly distressed edges, single color, transparent background`
const SKETCH_PROMPT =
  'hand-drawn flourish, single ink stroke underline with small flourish at end, organic, casual, transparent background, monochrome'

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

export interface DecorativeAssets {
  grain: Buffer
  badge: Buffer
  sketch: Buffer
}

/**
 * Generate three decorative PNGs in parallel via fal.ai flux/schnell.
 *
 * Schnell is the fast/cheap flux variant — ~$0.003 per image × 3 = ~$0.01 per
 * build. 4 inference steps is schnell's designed sweet spot; more steps don't
 * help. Safety checker is disabled because the model sometimes refuses
 * abstract art as "uncertain" and these are decorative shapes, not faces.
 */
export async function generateDecorativeAssets(year: string): Promise<DecorativeAssets> {
  const [grain, badge, sketch] = await Promise.all([
    generateImage(GRAIN_PROMPT, { width: 1024, height: 1024 }),
    generateImage(BADGE_PROMPT(year), { width: 512, height: 512 }),
    generateImage(SKETCH_PROMPT, { width: 512, height: 256 }),
  ])
  return { grain, badge, sketch }
}

/**
 * Run a single flux/schnell generation and download the resulting PNG bytes.
 * Throws on any stage that doesn't return a usable image — cost of a failure
 * is ~$0.003, the caller's retry policy lives one level up.
 */
async function generateImage(
  prompt: string,
  size: { width: number; height: number }
): Promise<Buffer> {
  const result = (await fal.subscribe('fal-ai/flux/schnell', {
    input: {
      prompt,
      image_size: size,
      num_inference_steps: 4, // schnell's sweet spot
      enable_safety_checker: false, // abstract decorative art, not faces
    },
    logs: false,
  })) as { data?: { images?: Array<{ url: string }> } }

  const url = result.data?.images?.[0]?.url
  if (!url) throw new Error('fal.ai returned no image')

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download fal.ai image: ${response.status}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

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

  const result = (await fal.subscribe('fal-ai/birefnet/v2', {
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
