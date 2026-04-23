/**
 * Extract the dominant non-white color from a logo image as a 7-char lowercase
 * hex (e.g. "#1a2b3c"). Used on Screen 5 to seed brandColor from the prospect's
 * uploaded logo rather than asking them to pick a color manually.
 *
 * Approach: render the logo into a 64x64 offscreen canvas, walk the pixel
 * buffer, bucket by quantized RGB (step 32 → 8 steps per channel → 512
 * buckets total), count pixels per bucket, ignore transparent pixels
 * (alpha < 128) and near-white pixels (all channels > 240). Return the
 * averaged color of the most-populated bucket.
 *
 * Near-white skip is deliberate: logos are typically placed on white
 * backgrounds and we want the "ink," not the backdrop. We do NOT skip black
 * or gray — a black-on-white wordmark's "brand color" is legitimately black,
 * and that's a fine accent choice. If the heuristic picks something
 * unexpected, the user can fall back to "Pick custom" on Screen 5.
 *
 * All work is client-side; no network, no external deps. Returns a Promise
 * because the HTMLImageElement decode is async.
 */
export async function extractLogoColor(dataUrl: string): Promise<string> {
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

  type Bucket = { count: number; r: number; g: number; b: number }
  const buckets = new Map<number, Bucket>()
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a < 128) continue // transparent
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (r > 240 && g > 240 && b > 240) continue // near-white background
    // Quantize to step 32: 3 bits per channel, packed r-g-b into a 9-bit key.
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5)
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

  let best: Bucket | null = null
  for (const v of buckets.values()) {
    if (!best || v.count > best.count) best = v
  }
  if (!best) {
    // All pixels were transparent or near-white. Unlikely for real logos but
    // possible for white-on-white edge cases. Return a neutral fallback so
    // the caller still gets a valid hex and the user can correct via custom.
    return '#000000'
  }

  const r = Math.round(best.r / best.count)
  const g = Math.round(best.g / best.count)
  const b = Math.round(best.b / best.count)
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}
