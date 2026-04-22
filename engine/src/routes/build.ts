import type { Request, Response } from 'express'
import { nanoid } from 'nanoid'
import { screenshotUrl } from '../lib/puppeteer.js'
import { cloneToHtml, type BusinessInfo } from '../lib/cloner.js'
import { processLogo, processPhoto } from '../lib/assets.js'
import { generateDecorativeAssets } from '../lib/fal.js'
import { deploySite, slugify, type AssetFile } from '../lib/netlify.js'

/**
 * Phase 5 build pipeline:
 *   1. Validate the payload has everything we can't proceed without
 *      (vertical, business name, reference URL, all three prospect assets).
 *   2. In PARALLEL: screenshot reference, process prospect assets via sharp,
 *      generate the three decorative PNGs via fal.ai. Screenshot is the long
 *      pole (~10s); asset processing is ~1-2s; fal.ai is ~5-10s with all
 *      three running concurrently. Fanning out saves ~20s vs. sequential.
 *   3. Sequential clone with one retry (Claude vision is the slowest step and
 *      flaky enough that a single retry recovers most transient failures).
 *   4. Multi-file Netlify deploy: index.html + 6 assets at the fixed paths
 *      the cloner's system prompt references (/logo.png, /hero.jpg,
 *      /photo2.jpg, /grain.png, /badge.png, /sketch.png).
 *   5. Return { requestId, url, buildTime, phase: 5 } so the phone can
 *      navigate to /review.
 *
 * Any failure returns 500 with { requestId, error, phase: 5 }. The app's
 * Screen7Build surfaces that as a red error line under the preview panel.
 */
export async function buildRoute(req: Request, res: Response): Promise<void> {
  const requestId = nanoid(8)
  const startTime = Date.now()

  console.log(`\n[${requestId}] POST /build`)
  console.log(`[${requestId}] vertical: ${req.body.vertical ?? '(none)'}`)
  console.log(`[${requestId}] business: ${req.body.business?.name ?? '(none)'}`)
  console.log(`[${requestId}] reference: ${req.body.reference?.url ?? '(none)'}`)

  try {
    if (!req.body.vertical) throw new Error('Missing vertical')
    if (!req.body.business?.name) throw new Error('Missing business.name')
    if (!req.body.reference?.url) throw new Error('Missing reference.url')
    if (!req.body.assets?.logo) throw new Error('Missing assets.logo')
    if (!req.body.assets?.photo1) throw new Error('Missing assets.photo1')
    if (!req.body.assets?.photo2) throw new Error('Missing assets.photo2')

    const business: BusinessInfo = {
      name: req.body.business.name,
      address: req.body.business.address ?? '',
      phone: req.body.business.phone ?? '',
      hours: req.body.business.hours ?? '',
      slogan: req.body.business.slogan,
      anythingSpecial: req.body.anythingSpecial,
      sections: req.body.sections ?? {},
      vertical: req.body.vertical,
    }
    const year = new Date().getFullYear().toString()

    // Parallel: screenshot + prospect asset processing + fal.ai decoratives.
    // All five are independent — no shared state, no ordering constraint.
    console.log(`[${requestId}] \u2192 parallel: screenshot + asset processing + fal.ai`)
    const [screenshot, logoBuf, photo1Buf, photo2Buf, decorative] = await Promise.all([
      screenshotUrl(req.body.reference.url),
      processLogo(req.body.assets.logo),
      processPhoto(req.body.assets.photo1),
      processPhoto(req.body.assets.photo2),
      generateDecorativeAssets(year),
    ])
    console.log(`[${requestId}] \u2713 all parallel work done`)
    console.log(`[${requestId}]   screenshot: ${screenshot.length} bytes`)
    console.log(`[${requestId}]   logo: ${logoBuf.length} bytes`)
    console.log(`[${requestId}]   photo1: ${photo1Buf.length} bytes`)
    console.log(`[${requestId}]   photo2: ${photo2Buf.length} bytes`)
    console.log(`[${requestId}]   grain: ${decorative.grain.length} bytes`)
    console.log(`[${requestId}]   badge: ${decorative.badge.length} bytes`)
    console.log(`[${requestId}]   sketch: ${decorative.sketch.length} bytes`)

    // Sequential: clone (with one retry). Must run after screenshot completes,
    // and we don't want to pay for two concurrent Claude calls if the first
    // would have succeeded.
    console.log(`[${requestId}] \u2192 cloning...`)
    let html: string
    try {
      html = await cloneToHtml(screenshot, business, req.body.reference.url)
    } catch (err) {
      console.log(`[${requestId}] \u26a0 clone failed, retrying once: ${err}`)
      html = await cloneToHtml(screenshot, business, req.body.reference.url)
    }
    console.log(`[${requestId}] \u2713 html ${html.length} chars`)

    // Sequential: deploy 7 files (index + logo + hero + photo2 + 3 decoratives).
    // Paths here MUST match the paths referenced by the cloner's system prompt.
    const slug = slugify(business.name)
    const assets: AssetFile[] = [
      { path: '/logo.png', buffer: logoBuf, contentType: 'image/png' },
      { path: '/hero.jpg', buffer: photo1Buf, contentType: 'image/jpeg' },
      { path: '/photo2.jpg', buffer: photo2Buf, contentType: 'image/jpeg' },
      { path: '/grain.png', buffer: decorative.grain, contentType: 'image/png' },
      { path: '/badge.png', buffer: decorative.badge, contentType: 'image/png' },
      { path: '/sketch.png', buffer: decorative.sketch, contentType: 'image/png' },
    ]
    console.log(`[${requestId}] \u2192 deploying as vno-${slug}-* (7 files)`)
    const url = await deploySite(html, assets, slug)
    console.log(`[${requestId}] \u2713 deployed to ${url}`)

    const buildTime = Number(((Date.now() - startTime) / 1000).toFixed(1))
    const response = { requestId, url, buildTime, phase: 5 }
    console.log(`[${requestId}] \u2192 returning ${JSON.stringify(response)}`)
    res.json(response)
  } catch (err) {
    const buildTime = ((Date.now() - startTime) / 1000).toFixed(1)
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.log(`[${requestId}] \u2717 failed after ${buildTime}s: ${message}`)
    res.status(500).json({ requestId, error: message, phase: 5 })
  }
}
