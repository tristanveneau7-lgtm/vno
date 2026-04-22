import type { Request, Response } from 'express'
import { nanoid } from 'nanoid'
import { screenshotUrl } from '../lib/puppeteer.js'
import { cloneToHtml, type BusinessInfo } from '../lib/cloner.js'
import { deployHtml, slugify } from '../lib/netlify.js'

/**
 * Phase 4 build pipeline:
 *   1. Validate the payload has the three things we can't proceed without
 *      (vertical, business name, reference URL).
 *   2. Screenshot the reference site with headless Chromium.
 *   3. Send the shot + business info to Claude vision; one retry on failure
 *      because vision calls are flaky enough that a single retry recovers
 *      most transient errors.
 *   4. Deploy the returned HTML to a fresh Netlify site.
 *   5. Return { requestId, url, buildTime } so the phone can navigate to /review.
 *
 * Any failure returns 500 with { requestId, error } — the app's Screen7Build
 * already knows how to surface that as a red error line under the preview panel.
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

    // Step 1: screenshot
    console.log(`[${requestId}] \u2192 screenshotting ${req.body.reference.url}`)
    const screenshot = await screenshotUrl(req.body.reference.url)
    console.log(`[${requestId}] \u2713 screenshot ${screenshot.length} bytes`)

    // Step 2: clone (with one retry)
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

    console.log(`[${requestId}] \u2192 cloning...`)
    let html: string
    try {
      html = await cloneToHtml(screenshot, business, req.body.reference.url)
    } catch (err) {
      console.log(`[${requestId}] \u26a0 clone failed, retrying once: ${err}`)
      html = await cloneToHtml(screenshot, business, req.body.reference.url)
    }
    console.log(`[${requestId}] \u2713 html ${html.length} chars`)

    // Step 3: deploy
    const slug = slugify(business.name)
    console.log(`[${requestId}] \u2192 deploying as vno-${slug}-*`)
    const url = await deployHtml(html, slug)
    console.log(`[${requestId}] \u2713 deployed to ${url}`)

    const buildTime = Number(((Date.now() - startTime) / 1000).toFixed(1))
    const response = { requestId, url, buildTime, phase: 4 }
    console.log(`[${requestId}] \u2192 returning ${JSON.stringify(response)}`)
    res.json(response)
  } catch (err) {
    const buildTime = ((Date.now() - startTime) / 1000).toFixed(1)
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.log(`[${requestId}] \u2717 failed after ${buildTime}s: ${message}`)
    res.status(500).json({ requestId, error: message, phase: 4 })
  }
}
