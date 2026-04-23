import sharp, { type Sharp } from 'sharp'
import { removeBackground } from './fal.js'

/**
 * Semantic role of an uploaded asset. Captured on Screen 5 of the app (see
 * app/src/lib/store.ts for the client-side source of truth) and flowed
 * through the /build wire shape as `assets.photos[n].role`. Introduced in
 * Phase Tampa Item 0 as pure plumbing: the role is carried on every
 * processed asset record through the pipeline. Item 1 (variant pipeline)
 * uses it to short-circuit variant generation for the logo slot (logos
 * skip duotone and cutout — see {@link processLogo}). Item 3 (the Art
 * Director agent) is where role-aware layout reasoning kicks in.
 */
export type PhotoRole = 'logo' | 'outside' | 'inside' | 'hero'

/**
 * Three-slot brand palette lifted off the /build payload. Kept as a named
 * interface here (rather than inlined at each call site) so the Phase
 * Tampa Item 1 duotone implementation — which consumes `primary` and
 * `secondary` as the two colors of its luminance mapping — shares one
 * type with the cloner and the build route.
 */
export interface BrandPalette {
  primary: string
  secondary: string
  accent: string
}

/**
 * The three variants produced per photo at build time (Phase Tampa Item 1,
 * locked decision #3):
 *
 *   - `raw`     — the encoded photo as-is (sharp resize + re-encode). Matches
 *                 the pre-Tampa `processPhoto` output exactly.
 *   - `duotone` — two-color luminance mapping using the brand palette's
 *                 primary (highlights) and secondary (shadows). Sharp-native.
 *   - `cutout`  — background-removed PNG with clean alpha around the
 *                 subject. Model call (see {@link processPhoto} for the
 *                 provider pick).
 *
 * All three are generated unconditionally for non-logo photos, in parallel,
 * at build time. Cost is not a constraint (decision #3). The Art Director
 * (Item 3) picks which variant to use per slot; unused variants sit cached.
 *
 * For logos, all three fields point to the same raw buffer — logos are
 * typically already clean cutouts with tight compositions, so duotone
 * rarely helps and cutout segmentation is redundant. See {@link processLogo}.
 */
export interface PhotoVariants {
  raw: Buffer
  duotone: Buffer
  cutout: Buffer
}

/**
 * A processed asset record. Carries variants plus the metadata downstream
 * stages need: `role` for the Art Director (Item 3), `orientation` for the
 * cloner's photo-placement heuristic. Logo records always have
 * `orientation: null` (logos don't carry a portrait/landscape tag). Non-logo
 * records have a tagged orientation — the app gates Continue on this being
 * set, and the build route re-validates on receipt.
 *
 * The old `buffer: Buffer` field from Item 0 is gone — the raw buffer lives
 * at `variants.raw` now, so callers that just want the unprocessed photo
 * reach through one field.
 */
export interface ProcessedAsset {
  role: PhotoRole
  orientation: 'portrait' | 'landscape' | null
  variants: PhotoVariants
}

/**
 * Resize + re-encode the prospect's uploaded logo.
 *
 * Logos have flat colour regions where JPEG artefacts are visible, so we keep
 * them lossless PNG. 400x400 is plenty for a header logo at 2x retina. fit:
 * inside + withoutEnlargement preserves aspect ratio and leaves small logos
 * at native size instead of blurry-upscaling them.
 *
 * Logos skip duotone and cutout — they're typically already clean cutouts
 * (transparent or near-white backgrounds) with tight compositions, and
 * duotone mapping a logo to two brand colors would usually destroy the
 * trademark. All three variant fields point to the same raw buffer as a
 * cheap passthrough; no extra sharp pipelines, no fal.ai call.
 */
export async function processLogo(base64DataUri: string): Promise<ProcessedAsset> {
  const buf = base64ToBuffer(base64DataUri)
  const raw = await sharp(buf)
    .rotate()
    .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer()
  return {
    role: 'logo',
    orientation: null,
    variants: { raw, duotone: raw, cutout: raw },
  }
}

/**
 * Resize + re-encode a prospect hero / secondary photo, and emit the full
 * three-variant set the Art Director chooses from.
 *
 * 1920px wide is the "retina display max useful size" — anything larger is
 * wasted bandwidth on a landing page. JPEG q90 via mozjpeg is visually
 * identical to q100 on phone screens at roughly 70% the file size. Small
 * uploads stay at native size thanks to withoutEnlargement.
 *
 * **Phase Tampa Item 1, Step 1 stub.** `variants.duotone` and
 * `variants.cutout` are both aliased to the raw buffer for now; Steps 2
 * and 3 replace them with real implementations without touching this
 * function's signature. `palette` is accepted in the signature (unused in
 * Step 1) so the Step 2 duotone drop-in is a body change only.
 */
export async function processPhoto(
  base64DataUri: string,
  role: Exclude<PhotoRole, 'logo'>,
  orientation: 'portrait' | 'landscape',
  palette: BrandPalette,
): Promise<ProcessedAsset> {
  const buf = base64ToBuffer(base64DataUri)
  // Set up the resize-and-rotate once; branch via .clone() so raw and
  // duotone pipelines finalize independently. Each branch's toBuffer()
  // triggers its own decode — libvips is fast enough (~50-150ms per
  // decode at 1920px) that the duplicate decode is cheap, and the
  // parallelism keeps wall-clock bounded by the slower branch.
  const base = sharp(buf)
    .rotate()
    .resize(1920, null, { fit: 'inside', withoutEnlargement: true })
  // Raw and duotone are sharp-local (~hundreds of ms). Cutout is a fal.ai
  // call (~1-2s) so it's the long pole — fanning out with Promise.all
  // keeps wall-clock bounded by the cutout latency instead of stacking.
  // Cutout takes the raw buffer, not the base pipeline, because the fal
  // endpoint expects an encoded image (JPEG in our case). We resolve raw
  // first, then pass it forward; Promise.all still parallelizes with
  // duotone because duotone doesn't depend on raw.
  const rawPromise = base.clone().jpeg({ quality: 90, mozjpeg: true }).toBuffer()
  const duotonePromise = generateDuotone(base.clone(), palette.primary, palette.secondary)
  const cutoutPromise = rawPromise.then((rawBuf) => removeBackground(rawBuf))
  const [raw, duotone, cutout] = await Promise.all([rawPromise, duotonePromise, cutoutPromise])
  return {
    role,
    orientation,
    variants: { raw, duotone, cutout },
  }
}

/**
 * Produce a real two-color duotone from a photo pipeline.
 *
 * NOT `.tint()` — tint just overlays a color, which muddies midtones and
 * reads as a filter, not a duotone. Real duotone projects each pixel's
 * RGB onto the luminance axis (scalar L in [0, 255]) and then maps that
 * scalar onto the line in RGB space between the shadow color (L=0 → the
 * palette's secondary) and the highlight color (L=255 → the palette's
 * primary). Midtones interpolate linearly along that line.
 *
 * Sharp-native expression:
 *   1. `.recomb()` with a 3x3 matrix of BT.601 luminance weights collapses
 *      every pixel to (L, L, L). Using a 3-row matrix instead of
 *      `.grayscale()` + re-expand keeps the image at 3 channels throughout
 *      so the per-channel `.linear()` below just works.
 *   2. `.linear([mR, mG, mB], [oR, oG, oB])` applies `out_c = m_c * L + o_c`
 *      per channel. Choosing `m_c = (primary_c - secondary_c) / 255` and
 *      `o_c = secondary_c` gives exactly the line from secondary at L=0 to
 *      primary at L=255. BT.601 is ITU's standard luminance recipe for
 *      photographic content and matches sharp's own `.grayscale()` default.
 *
 * Both colors are trusted as 6-digit hex; build.ts validates shape before
 * this runs.
 */
async function generateDuotone(
  pipeline: Sharp,
  primaryHex: string,
  secondaryHex: string,
): Promise<Buffer> {
  const hi = hexToRgb(primaryHex) // highlight color
  const lo = hexToRgb(secondaryHex) // shadow color
  // BT.601 luminance weights: Y = 0.299R + 0.587G + 0.114B. Each row of the
  // recomb matrix is the same so the output is (L, L, L) per pixel.
  const toLuminance: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ] = [
    [0.299, 0.587, 0.114],
    [0.299, 0.587, 0.114],
    [0.299, 0.587, 0.114],
  ]
  const mult = [
    (hi.r - lo.r) / 255,
    (hi.g - lo.g) / 255,
    (hi.b - lo.b) / 255,
  ]
  const offs = [lo.r, lo.g, lo.b]
  return pipeline
    .recomb(toLuminance)
    .linear(mult, offs)
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer()
}

/**
 * Parse a 6-digit hex string (#RRGGBB) into integer channels.
 * Trusts shape — build.ts validates `#[0-9a-fA-F]{6}` at the route
 * boundary before any palette value reaches here.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/)
  if (!m) throw new Error(`Invalid hex color: ${hex}`)
  return {
    r: parseInt(m[1], 16),
    g: parseInt(m[2], 16),
    b: parseInt(m[3], 16),
  }
}

/**
 * Turn a `data:image/...;base64,<payload>` URI into a raw Buffer.
 * Throws on anything that doesn't match the shape the phone sends.
 */
function base64ToBuffer(dataUri: string): Buffer {
  const match = dataUri.match(/^data:[^;]+;base64,(.+)$/)
  if (!match) throw new Error('Invalid base64 data URI')
  return Buffer.from(match[1], 'base64')
}
