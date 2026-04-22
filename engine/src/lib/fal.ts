import { fal } from '@fal-ai/client'

// fal.ai client reads FAL_KEY from env on first use
fal.config({ credentials: process.env.FAL_KEY })

const GRAIN_PROMPT =
  'subtle film grain texture, monochromatic noise, organic, slightly warm undertone, seamless tile, 5% intensity, clean'
const BADGE_PROMPT = (year: string) =>
  `vintage stamp graphic, circular, "EST ${year}" text in center, ink stamp aesthetic, slightly distressed edges, single color, transparent background`
const SKETCH_PROMPT =
  'hand-drawn flourish, single ink stroke underline with small flourish at end, organic, casual, transparent background, monochrome'

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
