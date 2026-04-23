import axios from 'axios'
import ffmpeg from 'fluent-ffmpeg'
import sharp from 'sharp'
import { PassThrough } from 'node:stream'
import { createRequire } from 'node:module'

// ffmpeg-static is CJS (`module.exports = binaryPath`) and its shipped .d.ts
// uses `export default`, which under NodeNext + strict interop resolves to
// the module namespace type rather than the default value. Use createRequire
// so we get the runtime string|null cleanly without interop casts.
const require = createRequire(import.meta.url)
const ffmpegStatic = require('ffmpeg-static') as string | null

/**
 * Direct-media source for the cloner screenshot step. When a reference in the
 * library supplies an `imageUrl`, we bypass Puppeteer entirely and either (a)
 * fetch the image directly, or (b) extract the first frame of a short video
 * via ffmpeg. Output is always normalized to PNG so cloner.ts's hardcoded
 * `media_type: 'image/png'` stays accurate regardless of the input format.
 *
 * Why this exists: some references clone much better from a hand-picked static
 * frame (Dribbble shots, reel thumbnails, above-the-fold crops) than from a
 * live Puppeteer render of a noisy production site. The live URL still travels
 * separately to the cloner prompt and to the prospect as the click-through.
 */

// ffmpeg-static resolves to the bundled platform binary, or `null` if the
// current platform has no bundled binary. Null means "fall back to system
// PATH," which fluent-ffmpeg handles when setFfmpegPath isn't called.
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic)
}

// Intentionally extension-based, not Content-Type-based: our reference library
// is hand-curated and we control the URLs. Remote servers occasionally serve
// videos with generic `application/octet-stream` headers, which a Content-Type
// check would miss. Query strings and fragments are tolerated so that signed
// CDN URLs (?token=...) still match.
const VIDEO_EXT_RE = /\.(mp4|mov|webm|m4v|avi|mkv)(\?|#|$)/i

export function isVideoUrl(url: string): boolean {
  return VIDEO_EXT_RE.test(url)
}

async function fetchUrlArrayBuffer(url: string): Promise<Buffer> {
  // 30s timeout mirrors the rest of the pipeline's "fail fast rather than
  // hang the whole build" posture. Curated URLs should respond quickly.
  const res = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: 30_000,
  })
  return Buffer.from(res.data)
}

/**
 * Pipe ffmpeg's first-frame output through a PassThrough and collect chunks
 * into a Buffer. Feeding ffmpeg the URL directly lets it stream the video
 * from the network — we never buffer the full mp4 in memory, only the single
 * decoded JPEG frame.
 */
async function firstFrameMjpegFromVideoUrl(videoUrl: string): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    const sink = new PassThrough()
    sink.on('data', (chunk: Buffer) => chunks.push(chunk))
    sink.on('end', () => resolve(Buffer.concat(chunks)))
    sink.on('error', (err) => reject(err))

    ffmpeg(videoUrl)
      // -ss 0 before input is a fast seek to the start; -frames:v 1 grabs
      // exactly one decoded frame; image2 + mjpeg emits a JPEG on stdout.
      .inputOptions(['-ss', '0'])
      .outputOptions(['-frames:v', '1', '-f', 'image2', '-c:v', 'mjpeg'])
      .on('error', (err: Error) => reject(err))
      .pipe(sink, { end: true })
  })
}

/**
 * Upper bound (in px) on the long edge of the normalized screenshot. Matches
 * the effective input size Claude vision uses anyway (~1568px long edge —
 * larger inputs are resized server-side without fidelity gain) and brings
 * wild-aspect references like a 1024x3530 Dribbble mockup or a 4000x3000
 * hero crop down to a predictable range close to Puppeteer's fixed 1440x900.
 * `withoutEnlargement: true` means smaller sources pass through untouched
 * rather than being upscaled into blur.
 */
const MAX_LONG_EDGE_PX = 1600

/**
 * Fetch a direct media URL and return a PNG buffer suitable as the cloner's
 * screenshot input. Videos → first frame via ffmpeg; images → fetched and
 * re-encoded through sharp. Output is always a valid PNG with its longest
 * edge clamped to MAX_LONG_EDGE_PX, preserving aspect ratio.
 */
export async function pngBufferFromMediaUrl(url: string): Promise<Buffer> {
  const raw = isVideoUrl(url)
    ? await firstFrameMjpegFromVideoUrl(url)
    : await fetchUrlArrayBuffer(url)
  return sharp(raw)
    .resize({
      width: MAX_LONG_EDGE_PX,
      height: MAX_LONG_EDGE_PX,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png()
    .toBuffer()
}
