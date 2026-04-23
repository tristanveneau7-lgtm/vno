import sharp from 'sharp'

/**
 * Resize + re-encode the prospect's uploaded logo.
 *
 * Logos have flat colour regions where JPEG artefacts are visible, so we keep
 * them lossless PNG. 400x400 is plenty for a header logo at 2x retina. fit:
 * inside + withoutEnlargement preserves aspect ratio and leaves small logos
 * at native size instead of blurry-upscaling them.
 */
export async function processLogo(base64DataUri: string): Promise<Buffer> {
  const buf = base64ToBuffer(base64DataUri)
  return sharp(buf)
    .rotate()
    .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

/**
 * Resize + re-encode a prospect hero / secondary photo.
 *
 * 1920px wide is the "retina display max useful size" — anything larger is
 * wasted bandwidth on a landing page. JPEG q90 via mozjpeg is visually
 * identical to q100 on phone screens at roughly 70% the file size. Small
 * uploads stay at native size thanks to withoutEnlargement.
 */
export async function processPhoto(base64DataUri: string): Promise<Buffer> {
  const buf = base64ToBuffer(base64DataUri)
  return sharp(buf)
    .rotate()
    .resize(1920, null, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer()
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
