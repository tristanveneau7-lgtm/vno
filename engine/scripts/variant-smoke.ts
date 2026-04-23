/**
 * Phase Tampa Item 1 smoke harness — end-to-end variant pipeline
 * verification against a local JPG. Drives `processPhoto` with the given
 * palette and writes each variant so you can eyeball the three outputs
 * side by side before committing Item 1.
 *
 * Usage:
 *   npx tsx engine/scripts/variant-smoke.ts <input.jpg> <#primary> <#secondary> [outdir]
 *
 * Example (real palette from a sample build):
 *   npx tsx engine/scripts/variant-smoke.ts test-photo.jpg "#b8733a" "#143249"
 *
 * Outputs (written to outdir, defaults to ./variant-smoke-out):
 *   out-raw.jpg      — resized-and-reencoded raw (matches pre-Tampa output exactly)
 *   out-duotone.jpg  — BT.601 luminance-mapped two-color duotone
 *                      (highlights → primary, shadows → secondary)
 *   out-cutout.png   — fal.ai birefnet background removal (PNG with alpha)
 *
 * Requires FAL_KEY in engine/.env (loaded via dotenv/config below). The
 * cutout variant makes a live fal.ai call per invocation — ~$0.01-0.02
 * per run, ~7-8s wall-clock for the cutout alone on a cold worker.
 *
 * What "good" looks like:
 *   - raw: identical to what pre-Tampa would have shipped for this photo.
 *   - duotone: two-color, no muddy midtones. Pure black input pixels read
 *     as the secondary hex, pure white as the primary hex.
 *   - cutout: clean alpha around the subject, no shredded hair/fur/fabric
 *     edges, no halos around the subject's silhouette.
 */
import 'dotenv/config'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { processPhoto } from '../src/lib/assets.js'

async function main() {
  const [inputPath, primary, secondary, outArg] = process.argv.slice(2)
  if (!inputPath || !primary || !secondary) {
    console.error(
      'usage: npx tsx engine/scripts/variant-smoke.ts <input.jpg> <#primary> <#secondary> [outdir]',
    )
    process.exit(2)
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(primary) || !/^#[0-9a-fA-F]{6}$/.test(secondary)) {
    console.error('primary and secondary must be 6-digit hex (e.g. #b8733a)')
    process.exit(2)
  }

  const outDir = resolve(outArg ?? 'variant-smoke-out')
  mkdirSync(outDir, { recursive: true })

  const srcBuf = readFileSync(inputPath)
  const dataUri = `data:image/jpeg;base64,${srcBuf.toString('base64')}`
  console.log(`input:   ${basename(inputPath)} (${(srcBuf.length / 1024).toFixed(0)} KB)`)
  console.log(`palette: primary=${primary} secondary=${secondary}`)
  console.log(`outdir:  ${outDir}`)
  console.log('\nrunning processPhoto(role=outside, orientation=landscape)...')

  const t0 = Date.now()
  const asset = await processPhoto(
    dataUri,
    'outside',
    'landscape',
    // `accent` is unused by the variant pipeline (only primary + secondary
    // drive duotone) — stubbing it with a neutral black keeps the call
    // type-valid without requiring a third CLI arg.
    { primary, secondary, accent: '#000000' },
  )
  const dt = Date.now() - t0

  const rawPath = resolve(outDir, 'out-raw.jpg')
  const duotonePath = resolve(outDir, 'out-duotone.jpg')
  const cutoutPath = resolve(outDir, 'out-cutout.png')
  writeFileSync(rawPath, asset.variants.raw)
  writeFileSync(duotonePath, asset.variants.duotone)
  writeFileSync(cutoutPath, asset.variants.cutout)

  console.log(`\n\u2713 variant pipeline done in ${dt}ms`)
  console.log(`  role:        ${asset.role}`)
  console.log(`  orientation: ${asset.orientation}`)
  console.log(`  raw     \u2192 ${(asset.variants.raw.length / 1024).toFixed(0)} KB \u2192 ${rawPath}`)
  console.log(`  duotone \u2192 ${(asset.variants.duotone.length / 1024).toFixed(0)} KB \u2192 ${duotonePath}`)
  console.log(`  cutout  \u2192 ${(asset.variants.cutout.length / 1024).toFixed(0)} KB \u2192 ${cutoutPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
