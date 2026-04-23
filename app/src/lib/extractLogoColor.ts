/**
 * Extract a three-color brand palette from a logo image and return it as a
 * readonly tuple [primary, secondary, accent] of 7-char lowercase hex
 * strings. Used on Screen 5 to seed assets.palette from the prospect's
 * uploaded logo in a single tap.
 *
 * Approach:
 *   1. Render the logo to a 64×64 offscreen canvas, walk the pixel buffer,
 *      bucket by quantized RGB (step 32 → 3 bits per channel → 512 total),
 *      skip transparent (alpha < 128) and near-white (all channels > 240)
 *      pixels.
 *   2. Sort buckets by population, descending. Walk the sorted list and
 *      pick up to three centroid colors, where each pick must be "distinct"
 *      — at least DISTINCTNESS_THRESHOLD away from every earlier pick in
 *      Euclidean RGB distance. This prevents returning three near-identical
 *      browns from a photo-realistic logo whose dominant hue happens to
 *      straddle two adjacent quantization buckets.
 *   3. Fill remaining slots if fewer than three distinct picks were found.
 *      Uses the average relative luminance of the picks to choose a
 *      "contrast" color: avg < 0.5 → white, avg >= 0.5 → black. Then:
 *         N=2 → slot 3 = contrast (one missing slot).
 *         N=1 → slot 2 = contrast, slot 3 = the opposite of contrast
 *                 (so a monochromatic logo yields a palette that spans both
 *                 ends of the tonal range, e.g. dark pink → [pink, white,
 *                 black], instead of collapsing to two identical fills).
 *   4. If zero distinct picks (e.g. a fully transparent or pure-white
 *      image), return a neutral ['#000000', '#666666', '#ffffff'] fallback
 *      so downstream still gets valid hexes and the user can override each
 *      slot via the per-swatch color picker on Screen 5.
 *
 * Non-white skip is deliberate (logos sit on white backgrounds, we want the
 * "ink"). Black is NOT skipped — a black wordmark's brand color is
 * legitimately black. If the heuristic picks something unexpected, the user
 * overrides per-slot via the swatch pickers.
 *
 * All work is client-side; no network, no external deps.
 */

// Quantization step in bits: 5 bits → step of 32 per channel → 512 buckets.
// Larger step coarsens the palette; smaller means more buckets and slower
// scans. 32 hits the sweet spot for typical small-business logo colors.
const BUCKET_STEP_BITS = 5

// Minimum Euclidean RGB distance between two picks to count them as
// distinct. 48 is ~1.5× the quantization step in a single channel — enough
// to reject two adjacent buckets that differ only by rounding noise, but
// permissive enough to let moderately-similar brand colors (e.g. light and
// dark teal) both make the palette. If smoke tests show palettes that
// collapse to two near-identical shades, bump this up; if legit distinct
// brand colors are getting rejected, bump it down.
const DISTINCTNESS_THRESHOLD = 48

type Centroid = { r: number; g: number; b: number }
type Bucket = Centroid & { count: number }

/**
 * Three hex strings in role order: primary, secondary, accent.
 */
export type LogoPalette = readonly [string, string, string]

export async function extractLogoPalette(dataUrl: string): Promise<LogoPalette> {
  const img = new Image()
  img.src = dataUrl
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Failed to decode logo image'))
  })

  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.drawImage(img, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)

  const buckets = new Map<number, Bucket>()
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a < 128) continue // transparent
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (r > 240 && g > 240 && b > 240) continue // near-white background
    const key =
      ((r >> BUCKET_STEP_BITS) << 6) |
      ((g >> BUCKET_STEP_BITS) << 3) |
      (b >> BUCKET_STEP_BITS)
    const existing = buckets.get(key)
    if (existing) {
      existing.count++
      existing.r += r
      existing.g += g
      existing.b += b
    } else {
      buckets.set(key, { count: 1, r, g, b })
    }
  }

  // Top-N distinct picks, in population order. We walk the full sorted list
  // (not just the first few) because a dominant hue can occupy several
  // adjacent buckets; we need to skip past those to find the next truly
  // different color.
  const sorted = [...buckets.values()].sort((a, b) => b.count - a.count)
  const picks: Centroid[] = []
  for (const bucket of sorted) {
    if (picks.length >= 3) break
    const centroid: Centroid = {
      r: Math.round(bucket.r / bucket.count),
      g: Math.round(bucket.g / bucket.count),
      b: Math.round(bucket.b / bucket.count),
    }
    const isDistinct = picks.every((p) => rgbDistance(p, centroid) >= DISTINCTNESS_THRESHOLD)
    if (isDistinct) picks.push(centroid)
  }

  // All pixels were transparent / near-white, or nothing survived the
  // distinctness filter. Return a neutral three-color fallback so the
  // caller still gets valid hexes.
  if (picks.length === 0) {
    return ['#000000', '#666666', '#ffffff']
  }

  // Under-filled: pick a luminance-based "contrast" color and fill the
  // missing slots so the palette still spans a usable tonal range. N=2
  // needs one fill (slot 3 = contrast). N=1 needs two fills: slot 2 gets
  // the contrast, slot 3 gets the opposite — that way a monochromatic logo
  // produces a palette with both a white AND a black slot, not two copies
  // of the same fill. Picks retain their extraction (= population) order
  // so primary stays the most common color.
  if (picks.length < 3) {
    const avgLum =
      picks.reduce((sum, p) => sum + relativeLuminance(p.r, p.g, p.b), 0) / picks.length
    const contrast = avgLum < 0.5 ? '#ffffff' : '#000000'
    const opposite = contrast === '#ffffff' ? '#000000' : '#ffffff'
    const hexes = picks.map(toHex)
    if (hexes.length === 1) {
      hexes.push(contrast, opposite)
    } else {
      hexes.push(contrast)
    }
    return [hexes[0], hexes[1], hexes[2]]
  }

  return [toHex(picks[0]), toHex(picks[1]), toHex(picks[2])]
}

function rgbDistance(a: Centroid, b: Centroid): number {
  const dr = a.r - b.r
  const dg = a.g - b.g
  const db = a.b - b.b
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

// NTSC / Rec. 601 relative-luminance weights, normalized to 0..1. Good-enough
// dark-vs-light proxy for the fill decision; we don't need sRGB-gamma
// accuracy for a binary white/black choice.
function relativeLuminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

function toHex(c: Centroid): string {
  const h = (n: number) => n.toString(16).padStart(2, '0')
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`
}
