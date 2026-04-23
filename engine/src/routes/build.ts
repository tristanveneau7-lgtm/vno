import type { Request, Response } from 'express'
import { nanoid } from 'nanoid'
import { screenshotUrl } from '../lib/puppeteer.js'
import { cloneToHtml, type BusinessInfo } from '../lib/cloner.js'
import {
  processLogo,
  processPhoto,
  type PhotoRole,
  type ProcessedAsset,
} from '../lib/assets.js'
import { generateDecorativeAssets } from '../lib/fal.js'
import { deploySite, slugify, type AssetFile } from '../lib/netlify.js'
import { isVideoUrl, pngBufferFromMediaUrl } from '../lib/media.js'

/**
 * Phase 5 build pipeline + Phase Tampa Item 0 photo-role plumbing:
 *   1. Validate the payload has everything we can't proceed without
 *      (vertical, business name, reference URL, all required prospect
 *      assets). Assets now arrive as assets.photos: Array<{ role, dataUrl,
 *      orientation }> — the old flat logo/photo1/photo2 wire shape is gone.
 *      Logo is required, plus at least 2 of { outside, inside, hero }.
 *   2. In PARALLEL: screenshot reference, process prospect assets via sharp
 *      (each processed asset now carries its role + orientation on the
 *      returned record — no processing change, pure plumbing for Item 3),
 *      generate the three decorative PNGs via fal.ai. Screenshot is the long
 *      pole (~10s); asset processing is ~1-2s; fal.ai is ~5-10s with all
 *      three running concurrently. Fanning out saves ~20s vs. sequential.
 *   3. Sequential clone with one retry (Claude vision is the slowest step and
 *      flaky enough that a single retry recovers most transient failures).
 *      The cloner still consumes photo1/photo2 semantics; we map roles to
 *      those slots here (hero > outside > inside precedence for photo1).
 *      That mapping goes away in Item 5 when the cloner consumes the Art
 *      Director's decision record directly.
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

    // Phase Tampa Item 0 wire shape: assets.photos is an array of labeled
    // entries; assets.palette is unchanged. The old flat logo/photo1/photo2
    // fields are gone. Parse the array into a role-keyed map so the rest of
    // the route can look up slots by name instead of array index.
    const photosIn: unknown = req.body.assets?.photos
    if (!Array.isArray(photosIn)) {
      throw new Error('Missing or invalid assets.photos (expected array)')
    }
    const VALID_ROLES: readonly PhotoRole[] = ['logo', 'outside', 'inside', 'hero'] as const
    interface InputPhoto {
      dataUrl: string
      orientation: 'portrait' | 'landscape' | null
    }
    const byRole: Partial<Record<PhotoRole, InputPhoto>> = {}
    for (const raw of photosIn) {
      if (!raw || typeof raw !== 'object') {
        throw new Error('Invalid entry in assets.photos (expected object)')
      }
      const entry = raw as Record<string, unknown>
      const role = entry.role
      const dataUrl = entry.dataUrl
      const orientation = entry.orientation
      if (typeof role !== 'string' || !VALID_ROLES.includes(role as PhotoRole)) {
        throw new Error(`Invalid assets.photos[].role: ${JSON.stringify(role)}`)
      }
      if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
        throw new Error(`Invalid assets.photos[${role}].dataUrl`)
      }
      // Orientation contract: logo must be null (logos don't carry the tag);
      // non-logo must be exactly 'portrait' or 'landscape'. We check string
      // values explicitly (not just truthiness) because typos like
      // 'Portrait' or 'PORTRAIT' would silently leak into the cloner prompt
      // and produce subtly wrong placements — same defense as pre-Tampa.
      if (role === 'logo') {
        if (orientation !== null) {
          throw new Error('assets.photos[logo].orientation must be null')
        }
      } else {
        if (orientation !== 'portrait' && orientation !== 'landscape') {
          throw new Error(
            `Missing or invalid assets.photos[${role}].orientation (expected 'portrait' | 'landscape')`
          )
        }
      }
      if (byRole[role as PhotoRole]) {
        throw new Error(`Duplicate role in assets.photos: ${role}`)
      }
      byRole[role as PhotoRole] = {
        dataUrl,
        orientation: orientation as 'portrait' | 'landscape' | null,
      }
    }

    // Minimum asset set: logo + at least 2 of { outside, inside, hero }.
    // Mirrors the app-side Continue gate in validation.ts case 5. Enforced
    // here so the engine stays safe against direct POSTs that bypass the UI.
    if (!byRole.logo) throw new Error('Missing required asset: logo')
    const nonLogoRoles = (['outside', 'inside', 'hero'] as const).filter((r) => byRole[r])
    if (nonLogoRoles.length < 2) {
      throw new Error('Need at least 2 of { outside, inside, hero }')
    }
    console.log(
      `[${requestId}] photo roles: ${(['logo', 'outside', 'inside', 'hero'] as const)
        .filter((r) => byRole[r])
        .map((r) => {
          const o = byRole[r]?.orientation
          return o ? `${r}(${o})` : r
        })
        .join(', ')}`
    )

    // Brand palette: three 6-digit hex slots (primary / secondary / accent).
    // Each is either extracted from the uploaded logo or picked per-swatch
    // on Screen 5. We validate the container is an object, then each slot
    // independently so the 400 error message pinpoints which slot is wrong
    // — helps debugging if the client sends a partial or malformed payload.
    // 400 (not 500) for the same reasons as before: client-shape problem,
    // not a pipeline failure, and the cloner prompt trusts these values
    // verbatim so we must guarantee shape here.
    const palette: unknown = req.body.assets?.palette
    if (palette === null || typeof palette !== 'object') {
      const buildTime = ((Date.now() - startTime) / 1000).toFixed(1)
      const message = 'Missing or invalid assets.palette'
      console.log(`[${requestId}] \u2717 ${message} after ${buildTime}s (value: ${JSON.stringify(palette)})`)
      res.status(400).json({ requestId, error: message, phase: 5 })
      return
    }
    const HEX_RE = /^#[0-9a-fA-F]{6}$/
    const paletteSlots = ['primary', 'secondary', 'accent'] as const
    for (const slot of paletteSlots) {
      const value = (palette as Record<string, unknown>)[slot]
      if (typeof value !== 'string' || !HEX_RE.test(value)) {
        const buildTime = ((Date.now() - startTime) / 1000).toFixed(1)
        const message = `Missing or invalid assets.palette.${slot}`
        console.log(`[${requestId}] \u2717 ${message} after ${buildTime}s (value: ${JSON.stringify(value)})`)
        res.status(400).json({ requestId, error: message, phase: 5 })
        return
      }
    }
    const validPalette = palette as { primary: string; secondary: string; accent: string }
    console.log(`[${requestId}] palette: primary=${validPalette.primary} secondary=${validPalette.secondary} accent=${validPalette.accent}`)

    // Map roles to the legacy photo1 / photo2 slots the cloner still expects.
    //
    // Precedence for photo1 (the cloner's "HERO PHOTO" slot): hero > outside
    // > inside. Rationale: when the user uploads a hero shot that's what
    // they want as the lead image; otherwise the storefront/exterior
    // (outside) is the natural lead; inside is the last fallback. photo2
    // takes the next available role that isn't the one picked for photo1.
    //
    // This mapping is a Phase Tampa Item 0 stub — it preserves pre-Tampa
    // downstream behavior (same cloner signature, same deploy paths) while
    // the Art Director plumbing lands. Item 5 deletes this block and has
    // the cloner consume the AD's decision record directly.
    const heroRole: Exclude<PhotoRole, 'logo'> =
      byRole.hero ? 'hero' : byRole.outside ? 'outside' : 'inside'
    const secondaryRole: Exclude<PhotoRole, 'logo'> | null =
      (['outside', 'inside', 'hero'] as const).find(
        (r) => r !== heroRole && byRole[r]
      ) ?? null
    if (!secondaryRole) {
      // Defensive — the nonLogoRoles >= 2 check above guarantees this branch
      // is unreachable, but throwing here beats letting undefined slip into
      // Promise.all's argument list.
      throw new Error('Unable to select a secondary photo (this is a bug)')
    }
    const heroInput = byRole[heroRole]!
    const secondaryInput = byRole[secondaryRole]!
    // TypeScript narrowing: non-logo orientations were validated to
    // 'portrait' | 'landscape' above, so the null branch is dead here.
    const heroOrientation = heroInput.orientation as 'portrait' | 'landscape'
    const secondaryOrientation = secondaryInput.orientation as 'portrait' | 'landscape'
    console.log(
      `[${requestId}] role → legacy slot mapping: photo1=${heroRole}, photo2=${secondaryRole}`
    )

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
    // currentYear is the single source of truth for the year used in the
    // page — flowed into the cloner prompt (EST badge, copyright footer,
    // "since" copy) AND stringified for fal.ai's decorative badge prompt.
    const currentYear = new Date().getFullYear()

    // Reference screenshot source: if the library entry supplied an imageUrl,
    // fetch that directly (image → fetch; video → ffmpeg first frame) and skip
    // Puppeteer entirely. Otherwise fall back to the existing Puppeteer render
    // of the live site. The live `reference.url` still travels unchanged to
    // cloneToHtml below — it's the prompt's "Reference URL: ..." context and
    // the user-facing click-through on Screen 4.
    const refImageUrl: string | null =
      typeof req.body.reference.imageUrl === 'string' && req.body.reference.imageUrl.length > 0
        ? req.body.reference.imageUrl
        : null
    const screenshotMode = refImageUrl
      ? isVideoUrl(refImageUrl)
        ? 'direct video first-frame'
        : 'direct image fetch'
      : 'puppeteer'
    console.log(`[${requestId}] reference mode: ${screenshotMode}`)
    if (refImageUrl) console.log(`[${requestId}]   imageUrl: ${refImageUrl}`)

    // Parallel: screenshot + prospect asset processing + fal.ai decoratives.
    // All five are independent — no shared state, no ordering constraint.
    // Processed assets now return ProcessedAsset records ({ role, buffer,
    // orientation }); we destructure the buffer out for the existing paths
    // and keep the full record in scope for downstream (Item 3) readers.
    console.log(`[${requestId}] \u2192 parallel: screenshot + asset processing + fal.ai`)
    const [screenshot, logoAsset, heroAsset, secondaryAsset, decorative] = await Promise.all([
      refImageUrl ? pngBufferFromMediaUrl(refImageUrl) : screenshotUrl(req.body.reference.url),
      processLogo(byRole.logo.dataUrl),
      processPhoto(heroInput.dataUrl, heroRole, heroOrientation),
      processPhoto(secondaryInput.dataUrl, secondaryRole, secondaryOrientation),
      generateDecorativeAssets(currentYear.toString()),
    ])
    // Keep the full set of processed assets in scope under a stable name
    // so Item 3 (Art Director input builder) can drop in without touching
    // the parallel-processing block above.
    const processedAssets: ProcessedAsset[] = [logoAsset, heroAsset, secondaryAsset]
    console.log(`[${requestId}] \u2713 all parallel work done`)
    console.log(`[${requestId}]   screenshot: ${screenshot.length} bytes`)
    for (const a of processedAssets) {
      const orient = a.orientation ? ` ${a.orientation}` : ''
      console.log(`[${requestId}]   ${a.role}${orient}: ${a.buffer.length} bytes`)
    }
    console.log(`[${requestId}]   grain: ${decorative.grain.length} bytes`)
    console.log(`[${requestId}]   badge: ${decorative.badge.length} bytes`)
    console.log(`[${requestId}]   sketch: ${decorative.sketch.length} bytes`)

    // Sequential: clone (with one retry). Must run after screenshot completes,
    // and we don't want to pay for two concurrent Claude calls if the first
    // would have succeeded.
    console.log(`[${requestId}] \u2192 cloning...`)
    const cloneOptions = {
      currentYear,
      photo1Orientation: heroOrientation,
      photo2Orientation: secondaryOrientation,
      palette: validPalette,
    }
    let html: string
    try {
      html = await cloneToHtml(screenshot, business, req.body.reference.url, cloneOptions)
    } catch (err) {
      console.log(`[${requestId}] \u26a0 clone failed, retrying once: ${err}`)
      html = await cloneToHtml(screenshot, business, req.body.reference.url, cloneOptions)
    }
    console.log(`[${requestId}] \u2713 html ${html.length} chars`)

    // Sequential: deploy 7 files (index + logo + hero + photo2 + 3 decoratives).
    // Paths here MUST match the paths referenced by the cloner's system prompt.
    const slug = slugify(business.name)
    const assets: AssetFile[] = [
      { path: '/logo.png', buffer: logoAsset.buffer, contentType: 'image/png' },
      { path: '/hero.jpg', buffer: heroAsset.buffer, contentType: 'image/jpeg' },
      { path: '/photo2.jpg', buffer: secondaryAsset.buffer, contentType: 'image/jpeg' },
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
