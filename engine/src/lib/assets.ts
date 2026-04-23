import sharp from 'sharp'

/**
 * Semantic role of an uploaded asset. Captured on Screen 5 of the app (see
 * app/src/lib/store.ts for the client-side source of truth) and flowed
 * through the /build wire shape as `assets.photos[n].role`. Introduced in
 * Phase Tampa Item 0 as pure plumbing: the role is carried on every
 * processed asset record through the pipeline, but nothing downstream
 * makes decisions against it yet. Item 3 (the Art Director agent) is where
 * role-aware reasoning kicks in.
 */
export type PhotoRole = 'logo' | 'outside' | 'inside' | 'hero'

/**
 * A processed asset record. Carries the encoded buffer plus the metadata
 * downstream stages need: `role` for the Art Director (Item 3), `orientation`
 * for the cloner's photo-placement heuristic. Logo records always have
 * `orientation: null` (logos don't carry a portrait/landscape tag). Non-logo
 * records have a tagged orientation — the app gates Continue on this being
 * set, and the build route re-validates on receipt.
 */
export interface ProcessedAsset {
  role: PhotoRole
  buffer: Buffer
  orientation: 'portrait' | 'landscape' | null
}

/**
 * Resize + re-encode the prospect's uploaded logo.
 *
 * Logos have flat colour regions where JPEG artefacts are visible, so we keep
 * them lossless PNG. 400x400 is plenty for a header logo at 2x retina. fit:
 * inside + withoutEnlargement preserves aspect ratio and leaves small logos
 * at native size instead of blurry-upscaling them.
 */
export async function processLogo(base64DataUri: string): Promise<ProcessedAsset> {
  const buf = base64ToBuffer(base64DataUri)
  const buffer = await sharp(buf)
    .rotate()
    .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer()
  return { role: 'logo', buffer, orientation: null }
}

/**
 * Resize + re-encode a prospect hero / secondary photo.
 *
 * 1920px wide is the "retina display max useful size" — anything larger is
 * wasted bandwidth on a landing page. JPEG q90 via mozjpeg is visually
 * identical to q100 on phone screens at roughly 70% the file size. Small
 * uploads stay at native size thanks to withoutEnlargement.
 *
 * Role + orientation travel on the returned record so Phase Tampa Item 3
 * (the Art Director) can reason about which shot is which without needing
 * to re-plumb the pipeline. Item 0 is pure plumbing — the buffer-producing
 * sharp chain is unchanged from pre-Tampa.
 */
export async function processPhoto(
  base64DataUri: string,
  role: Exclude<PhotoRole, 'logo'>,
  orientation: 'portrait' | 'landscape'
): Promise<ProcessedAsset> {
  const buf = base64ToBuffer(base64DataUri)
  const buffer = await sharp(buf)
    .rotate()
    .resize(1920, null, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer()
  return { role, buffer, orientation }
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
