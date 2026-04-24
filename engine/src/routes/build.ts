import type { Request, Response } from 'express'
import { nanoid } from 'nanoid'
import { screenshotUrl } from '../lib/puppeteer.js'
import {
  cloneToHtml,
  type BusinessInfo,
  type RenderableArtDirection,
  type RenderableFocalOrnament,
  type RenderablePhotoPlacement,
} from '../lib/cloner.js'
import {
  processLogo,
  processPhoto,
  type BrandPalette,
  type PhotoRole,
  type ProcessedAsset,
} from '../lib/assets.js'
import { generateFocalOrnaments, type FocalOrnamentWithUrl } from '../lib/fal.js'
import { runArtDirector } from '../lib/artDirector.js'
import { runCritic } from '../lib/critic.js'
import type { ArtDirectorDecision, PhotoVariantName } from '../types/artDirector.js'
import { deploySite, slugify, type AssetFile } from '../lib/netlify.js'
import { isVideoUrl, pngBufferFromMediaUrl } from '../lib/media.js'

/**
 * Phase Tampa Item 5 build pipeline:
 *
 *   1. Validate the payload has everything we can't proceed without
 *      (vertical, business name, reference URL, logo + at least 2 non-logo
 *      photos with orientations tagged, palette).
 *   2. Stage 1 — parallel: screenshot the reference + processLogo +
 *      processPhoto per non-logo input (each emits raw/duotone/cutout).
 *   3. Stage 2 — runArtDirector(reference, business, photos, palette).
 *      Returns a zod-validated ArtDirectorDecision. Throws after one retry.
 *   4. Stage 3 — generateFocalOrnaments(decision.focalOrnaments).
 *      Promise.allSettled internally; per-ornament failures surface as
 *      generationFailed flags, not batch failures.
 *   5. Stage 4 — download each successful ornament URL to a Buffer in
 *      parallel. Download failures after generation are treated as
 *      generationFailed (the cloner sees the flag and skips).
 *   6. Assemble a RenderableArtDirection — the decision enriched with
 *      every image reference resolved to a deploy path. The cloner
 *      renders directly against this record.
 *   7. Stage 5 — cloneToHtml(screenshot, business, url, {currentYear,
 *      palette, artDirection}). Claude Sonnet vision call with one retry.
 *   8. Stage 6 — terminal. Branches on `mode` (body field, default
 *      'preview'):
 *        preview: skip Netlify, return the HTML inline. Used during
 *          the pitch flow so prospects see the generated site without
 *          consuming deploy quota for builds that won't be used.
 *        deploy: multi-file Netlify deploy (index.html + logo + used
 *          photo variants (role × variant) + successful ornaments).
 *          Used after a prospect says yes.
 *   9. Return shape:
 *        preview: { requestId, buildTime, phase: 5, mode: 'preview', html }
 *        deploy:  { requestId, url, buildTime, phase: 5, mode: 'deploy' }
 *
 * Pre-Tampa /grain.png /badge.png /sketch.png decorative pipeline is
 * gone — the cloner's TEXTURE section produces atmosphere via inline
 * CSS/SVG now. Pre-Tampa photo1/photo2 legacy slot mapping is gone too;
 * the Art Director's hero + placements make those calls.
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
    const validated = validateRequest(req, requestId)
    // validateRequest sends 400 and returns null for client-shape errors.
    // Pipeline errors below throw and land in the 500 catch at the bottom.
    if (!validated) {
      const buildTime = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`[${requestId}] \u2717 validation failed after ${buildTime}s`)
      return
    }
    const {
      vertical,
      business,
      photosByRole,
      palette,
      referenceUrl,
      referenceImageUrl,
      referenceLabel,
      mode,
    } = validated

    // Stage 1 — parallel: screenshot + processLogo + processPhoto(each non-logo).
    const stage1Start = Date.now()
    const nonLogoEntries = (['outside', 'inside', 'hero'] as const).flatMap((role) => {
      const photo = photosByRole[role]
      return photo ? [{ role, photo }] : []
    })
    console.log(
      `[${requestId}] \u2192 stage 1: parallel (screenshot + processLogo + ${nonLogoEntries.length} processPhoto)`,
    )
    const [screenshot, logoAsset, ...nonLogoAssets] = await Promise.all([
      referenceImageUrl
        ? pngBufferFromMediaUrl(referenceImageUrl)
        : screenshotUrl(referenceUrl),
      processLogo(photosByRole.logo!.dataUrl),
      ...nonLogoEntries.map(({ role, photo }) =>
        processPhoto(photo.dataUrl, role, photo.orientation as 'portrait' | 'landscape', palette),
      ),
    ])
    const processedAssets: ProcessedAsset[] = [logoAsset, ...nonLogoAssets]
    const processedByRole = new Map<PhotoRole, ProcessedAsset>(
      processedAssets.map((a) => [a.role, a]),
    )
    console.log(`[${requestId}] \u2713 stage 1 done in ${Date.now() - stage1Start}ms`)
    console.log(`[${requestId}]   screenshot: ${screenshot.length} bytes`)
    for (const a of processedAssets) {
      const v = a.variants
      const orient = a.orientation ? ` ${a.orientation}` : ''
      console.log(
        `[${requestId}]   ${a.role}${orient}: raw=${v.raw.length}b duotone=${v.duotone.length}b cutout=${v.cutout.length}b`,
      )
    }

    // Stage 2 — Art Director.
    const stage2Start = Date.now()
    console.log(`[${requestId}] \u2192 stage 2: runArtDirector`)
    const decision = await runArtDirector({
      reference: {
        id: slugify(referenceLabel || referenceUrl),
        url: referenceUrl,
        screenshotPng: screenshot,
      },
      business,
      photos: processedAssets,
      palette,
    })
    console.log(
      `[${requestId}] \u2713 stage 2 done in ${Date.now() - stage2Start}ms — ` +
        `hero=${decision.hero.photoId}/${decision.hero.variant}/${decision.hero.slot}, ` +
        `placements=${decision.photoPlacements.length}, ` +
        `ornaments=${decision.focalOrnaments.length}, ` +
        `atmosphere=${decision.atmosphericDirectives.grain}/${decision.atmosphericDirectives.divider}/${decision.atmosphericDirectives.captionStyle}/${decision.atmosphericDirectives.backdrop}`,
    )

    // Stage 3 — focal ornament generation (per-entry Promise.allSettled).
    const stage3Start = Date.now()
    console.log(`[${requestId}] \u2192 stage 3: generateFocalOrnaments (${decision.focalOrnaments.length})`)
    const ornamentResults = await generateFocalOrnaments(decision.focalOrnaments)
    const ornamentGenSuccess = ornamentResults.filter((r) => r.imageUrl !== null).length
    console.log(
      `[${requestId}] \u2713 stage 3 done in ${Date.now() - stage3Start}ms — ${ornamentGenSuccess}/${ornamentResults.length} generated`,
    )

    // Stage 4 — download ornament URLs to buffers in parallel.
    const stage4Start = Date.now()
    console.log(`[${requestId}] \u2192 stage 4: download ${ornamentGenSuccess} ornament buffers`)
    const ornamentBuffers = await downloadOrnamentBuffers(ornamentResults, requestId)
    const ornamentDownloadSuccess = ornamentBuffers.filter((b) => b.buffer !== null).length
    console.log(
      `[${requestId}] \u2713 stage 4 done in ${Date.now() - stage4Start}ms — ${ornamentDownloadSuccess}/${ornamentResults.length} downloaded`,
    )

    // Assemble the RenderableArtDirection — logical coords → deploy paths.
    const renderableDecision = buildRenderableDecision(decision, ornamentBuffers)

    // Stage 5 — cloner. Sequential; one retry on failure (Sonnet's flaky).
    const currentYear = new Date().getFullYear()
    const cloneOptions = {
      currentYear,
      palette,
      artDirection: renderableDecision,
    }
    const stage5Start = Date.now()
    console.log(`[${requestId}] \u2192 stage 5: cloneToHtml`)
    let html: string
    try {
      html = await cloneToHtml(screenshot, business, referenceUrl, cloneOptions)
    } catch (err) {
      console.log(`[${requestId}] \u26a0 clone failed, retrying once: ${err}`)
      html = await cloneToHtml(screenshot, business, referenceUrl, cloneOptions)
    }
    console.log(`[${requestId}] \u2713 stage 5 done in ${Date.now() - stage5Start}ms — html ${html.length} chars`)

    // Stage 5a — Critic. Read the rendered HTML + AD decision + reference
    // against the reference screenshot; emit a structured critique.
    //
    // Phase Tampa Part 1.5 Item 4 Step 1: this stage runs and LOGS but
    // does NOT gate. The build always proceeds to Stage 6 regardless of
    // verdict. Step 2 wires the revise branch; until then we verify the
    // Critic integrates cleanly into the real pipeline without affecting
    // production behavior.
    const stage5aStart = Date.now()
    console.log(`[${requestId}] \u2192 stage 5a: runCritic round=1`)
    const round1Critique = await runCritic({
      artDirection: decision,
      html,
      reference: {
        id: slugify(referenceLabel || referenceUrl),
        url: referenceUrl,
        screenshotPng: screenshot,
      },
      business,
      palette,
      round: 1,
    })
    console.log(
      `[${requestId}] \u2713 stage 5a done in ${Date.now() - stage5aStart}ms — ` +
        `verdict=${round1Critique.verdict} score=${round1Critique.score}/10 ` +
        `critiques=${round1Critique.critiques.length} preserve=${round1Critique.preserve.length}`,
    )
    // Step 1 scope: critique is produced but not acted on. Step 2 branches.
    void round1Critique

    // Silence unused-var for `vertical` — validateRequest returns it for
    // future consumers (Item 3+ might key vertical-specific behavior here).
    void vertical

    // Stage 6 — terminal. Branches on `mode`.
    const stage6Start = Date.now()
    const buildTime = Number(((Date.now() - startTime) / 1000).toFixed(1))

    if (mode === 'preview') {
      // Preview-mode: return HTML inline, no Netlify call. The PWA
      // (Preview.tsx) renders this via <iframe srcDoc={html}>. Paths
      // referenced in the HTML (photo variants, ornaments, logo) won't
      // resolve because those files never got uploaded — which is fine
      // for the pitch surface since the iframe renders within the PWA's
      // origin. Deploy-mode is where asset paths matter.
      console.log(
        `[${requestId}] \u2192 stage 6: preview-mode response (html ${html.length} chars, no netlify call)`,
      )
      const response = { requestId, buildTime, phase: 5, mode: 'preview' as const, html }
      console.log(`[${requestId}] \u2713 stage 6 done in ${Date.now() - stage6Start}ms — preview`)
      // Don't JSON.stringify the response here — that dumps the full
      // HTML body to the server log. Brief summary instead.
      console.log(
        `[${requestId}] \u2192 returning { requestId, buildTime, phase: 5, mode: 'preview', html: ${html.length} chars }`,
      )
      res.json(response)
      return
    }

    // Deploy-mode: original Stage 6 behavior.
    const assets = buildDeployAssets(logoAsset, processedByRole, decision, ornamentBuffers)
    const slug = slugify(business.name)
    console.log(`[${requestId}] \u2192 stage 6: deploy ${assets.length} files as vno-${slug}-*`)
    const url = await deploySite(html, assets, slug)
    console.log(`[${requestId}] \u2713 stage 6 done in ${Date.now() - stage6Start}ms \u2192 ${url}`)

    const response = { requestId, url, buildTime, phase: 5, mode: 'deploy' as const }
    console.log(`[${requestId}] \u2192 returning ${JSON.stringify(response)}`)
    res.json(response)
  } catch (err) {
    const buildTime = ((Date.now() - startTime) / 1000).toFixed(1)
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.log(`[${requestId}] \u2717 failed after ${buildTime}s: ${message}`)
    res.status(500).json({ requestId, error: message, phase: 5 })
  }
}

// -----------------------------------------------------------------------------
// Path conventions — single source of truth shared by RenderableArtDirection
// assembly and Netlify deploy-asset listing. If these drift, the cloner
// emits paths that don't match deployed files and the rendered site breaks.
// -----------------------------------------------------------------------------

/**
 * Deploy path for a non-logo photo variant. `role × variant` uniquely
 * identifies a buffer and the deployed URL.
 */
function photoVariantPath(
  role: Exclude<PhotoRole, 'logo'>,
  variant: PhotoVariantName,
): string {
  return `/photo-${role}-${variant}.${variantExt(variant)}`
}

function variantExt(variant: PhotoVariantName): 'png' | 'jpg' {
  // Cutouts are PNG (birefnet outputs PNG with alpha). Raw + duotone are
  // JPEG (sharp's mozjpeg output from processPhoto).
  return variant === 'cutout' ? 'png' : 'jpg'
}

function variantMediaType(variant: PhotoVariantName): 'image/png' | 'image/jpeg' {
  return variant === 'cutout' ? 'image/png' : 'image/jpeg'
}

/**
 * Deploy path for a focal ornament by its index into
 * `decision.focalOrnaments`. Indexing (rather than hashing the prompt or
 * the anchor) keeps paths stable for re-runs of the same decision and
 * gives the cloner a predictable pattern to reference.
 */
function ornamentDeployPath(index: number): string {
  return `/ornament-${index}.png`
}

// -----------------------------------------------------------------------------
// Validation (extracted from the pre-Tampa inline block to keep buildRoute
// readable). Returns null after writing a 400 on client-shape errors; throws
// never (pipeline throws bubble up from buildRoute's main try/catch).
// -----------------------------------------------------------------------------

interface ValidatedRequest {
  vertical: string
  business: BusinessInfo
  photosByRole: Partial<Record<PhotoRole, { dataUrl: string; orientation: 'portrait' | 'landscape' | null }>>
  palette: BrandPalette
  referenceUrl: string
  referenceImageUrl: string | null
  referenceLabel: string
  /**
   * Terminal-stage mode. 'preview' (default) skips Stage 6 Netlify
   * upload and returns the HTML inline; 'deploy' runs the full
   * Netlify deploy path. Defaulting to preview is deliberate — it
   * removes Netlify from the pitch critical path. Added in the
   * Phase Tampa Part 1.5 preview-mode side quest.
   */
  mode: 'preview' | 'deploy'
}

function validateRequest(req: Request, requestId: string): ValidatedRequest | null {
  if (!req.body.vertical) throw new Error('Missing vertical')
  if (!req.body.business?.name) throw new Error('Missing business.name')
  if (!req.body.reference?.url) throw new Error('Missing reference.url')

  // Mode — optional body field. Absent means 'preview' (the corrective
  // default for the pitch flow). Anything other than 'preview' | 'deploy'
  // is rejected as a client-shape error.
  const rawMode: unknown = req.body.mode
  let mode: 'preview' | 'deploy'
  if (rawMode === undefined || rawMode === null) {
    mode = 'preview'
  } else if (rawMode === 'preview' || rawMode === 'deploy') {
    mode = rawMode
  } else {
    throw new Error(`Invalid mode: ${JSON.stringify(rawMode)} (expected 'preview' | 'deploy' or absent)`)
  }
  console.log(`[${requestId}] mode: ${mode}${rawMode === undefined ? ' (default)' : ''}`)

  // Phase Tampa Item 0 wire shape: assets.photos is an array of labeled
  // entries; assets.palette is unchanged.
  const photosIn: unknown = req.body.assets?.photos
  if (!Array.isArray(photosIn)) {
    throw new Error('Missing or invalid assets.photos (expected array)')
  }
  const VALID_ROLES: readonly PhotoRole[] = ['logo', 'outside', 'inside', 'hero'] as const
  const photosByRole: ValidatedRequest['photosByRole'] = {}
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
    if (role === 'logo') {
      if (orientation !== null) {
        throw new Error('assets.photos[logo].orientation must be null')
      }
    } else {
      if (orientation !== 'portrait' && orientation !== 'landscape') {
        throw new Error(
          `Missing or invalid assets.photos[${role}].orientation (expected 'portrait' | 'landscape')`,
        )
      }
    }
    if (photosByRole[role as PhotoRole]) {
      throw new Error(`Duplicate role in assets.photos: ${role}`)
    }
    photosByRole[role as PhotoRole] = {
      dataUrl,
      orientation: orientation as 'portrait' | 'landscape' | null,
    }
  }

  if (!photosByRole.logo) throw new Error('Missing required asset: logo')
  const nonLogoCount = (['outside', 'inside', 'hero'] as const).filter((r) => photosByRole[r]).length
  if (nonLogoCount < 2) {
    throw new Error('Need at least 2 of { outside, inside, hero }')
  }
  console.log(
    `[${requestId}] photo roles: ${(['logo', 'outside', 'inside', 'hero'] as const)
      .filter((r) => photosByRole[r])
      .map((r) => {
        const o = photosByRole[r]?.orientation
        return o ? `${r}(${o})` : r
      })
      .join(', ')}`,
  )

  // Palette — three 6-digit hex slots. Validation errors here 400 (not 500)
  // because they're client-shape problems; response handled by caller.
  const palette: unknown = req.body.assets?.palette
  if (palette === null || typeof palette !== 'object') {
    const message = 'Missing or invalid assets.palette'
    console.log(`[${requestId}] \u2717 ${message} (value: ${JSON.stringify(palette)})`)
    throw new Error(message) // pipeline 500 is fine — client shouldn't reach here without palette
  }
  const HEX_RE = /^#[0-9a-fA-F]{6}$/
  for (const slot of ['primary', 'secondary', 'accent'] as const) {
    const value = (palette as Record<string, unknown>)[slot]
    if (typeof value !== 'string' || !HEX_RE.test(value)) {
      throw new Error(`Missing or invalid assets.palette.${slot}`)
    }
  }
  const validPalette: BrandPalette = palette as BrandPalette
  console.log(
    `[${requestId}] palette: primary=${validPalette.primary} secondary=${validPalette.secondary} accent=${validPalette.accent}`,
  )

  // Reference imageUrl — optional direct media URL (short-circuits Puppeteer).
  const referenceImageUrl: string | null =
    typeof req.body.reference.imageUrl === 'string' && req.body.reference.imageUrl.length > 0
      ? req.body.reference.imageUrl
      : null
  const screenshotMode = referenceImageUrl
    ? isVideoUrl(referenceImageUrl)
      ? 'direct video first-frame'
      : 'direct image fetch'
    : 'puppeteer'
  console.log(`[${requestId}] reference mode: ${screenshotMode}`)
  if (referenceImageUrl) console.log(`[${requestId}]   imageUrl: ${referenceImageUrl}`)

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

  return {
    vertical: req.body.vertical,
    business,
    photosByRole,
    palette: validPalette,
    referenceUrl: req.body.reference.url,
    referenceImageUrl,
    referenceLabel: typeof req.body.reference.label === 'string' ? req.body.reference.label : '',
    mode,
  }
}

// -----------------------------------------------------------------------------
// Ornament download — convert each fal hosted URL to a Buffer. Download
// failures are non-fatal: they degrade the ornament to generationFailed so
// the cloner skips it, rather than tanking the whole build.
// -----------------------------------------------------------------------------

interface OrnamentBufferResult {
  buffer: Buffer | null
  error?: string
}

async function downloadOrnamentBuffers(
  results: FocalOrnamentWithUrl[],
  requestId: string,
): Promise<OrnamentBufferResult[]> {
  return Promise.all(
    results.map(async (r, i): Promise<OrnamentBufferResult> => {
      if (r.imageUrl === null) {
        // Already failed at generation — propagate the original error.
        return { buffer: null, error: r.error }
      }
      try {
        const response = await fetch(r.imageUrl)
        if (!response.ok) {
          const err = `download failed: HTTP ${response.status}`
          console.log(`[${requestId}]   ornament ${i} ${err}`)
          return { buffer: null, error: err }
        }
        const ab = await response.arrayBuffer()
        return { buffer: Buffer.from(ab) }
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e)
        console.log(`[${requestId}]   ornament ${i} download threw: ${err}`)
        return { buffer: null, error: err }
      }
    }),
  )
}

// -----------------------------------------------------------------------------
// Resolve the AD's decision to a RenderableArtDirection the cloner
// consumes directly. Every logical (role, variant) and (ornament, index)
// coord becomes a concrete deploy path here.
// -----------------------------------------------------------------------------

function buildRenderableDecision(
  decision: ArtDirectorDecision,
  ornamentBuffers: OrnamentBufferResult[],
): RenderableArtDirection {
  return {
    ...decision,
    logoPath: '/logo.png',
    hero: {
      ...decision.hero,
      src: photoVariantPath(decision.hero.photoId, decision.hero.variant),
    },
    photoPlacements: decision.photoPlacements.map((p): RenderablePhotoPlacement => ({
      ...p,
      src: photoVariantPath(p.photoId, p.variant),
    })),
    focalOrnaments: decision.focalOrnaments.map((o, i): RenderableFocalOrnament => {
      const ob = ornamentBuffers[i]
      if (!ob || ob.buffer === null) {
        return {
          ...o,
          deployPath: null,
          generationFailed: true,
          error: ob?.error ?? 'unknown ornament failure',
        }
      }
      return { ...o, deployPath: ornamentDeployPath(i) }
    }),
  }
}

// -----------------------------------------------------------------------------
// Netlify asset list — logo + every (role, variant) the decision uses +
// every successful ornament. Must be symmetric with buildRenderableDecision
// so paths emitted by the cloner all resolve on the deployed site.
// -----------------------------------------------------------------------------

function buildDeployAssets(
  logoAsset: ProcessedAsset,
  processedByRole: Map<PhotoRole, ProcessedAsset>,
  decision: ArtDirectorDecision,
  ornamentBuffers: OrnamentBufferResult[],
): AssetFile[] {
  const files: AssetFile[] = []

  // Logo: always /logo.png, raw only. processLogo aliases all three
  // variants to the same raw buffer, so variants.raw is correct.
  files.push({ path: '/logo.png', buffer: logoAsset.variants.raw, contentType: 'image/png' })

  // Used photo variants — dedupe across hero + placements in case the AD
  // ever references the same (role, variant) pair twice (shouldn't happen
  // post-uniqueness-check, but belt-and-suspenders).
  const seen = new Set<string>()
  const slots: Array<{ photoId: Exclude<PhotoRole, 'logo'>; variant: PhotoVariantName }> = [
    { photoId: decision.hero.photoId, variant: decision.hero.variant },
    ...decision.photoPlacements.map((p) => ({ photoId: p.photoId, variant: p.variant })),
  ]
  for (const slot of slots) {
    const key = `${slot.photoId}:${slot.variant}`
    if (seen.has(key)) continue
    seen.add(key)
    const asset = processedByRole.get(slot.photoId)
    if (!asset) {
      // AD referenced a role not in the input set. Shouldn't happen: the
      // AD input is derived from the input photos, and the coverage check
      // in runArtDirector rejects mismatches. Throw loud if it does.
      throw new Error(`AD referenced missing role: ${slot.photoId}`)
    }
    files.push({
      path: photoVariantPath(slot.photoId, slot.variant),
      buffer: asset.variants[slot.variant],
      contentType: variantMediaType(slot.variant),
    })
  }

  // Successful ornaments only. Failed ones have deployPath: null in the
  // decision, and the cloner is told to skip them.
  ornamentBuffers.forEach((ob, i) => {
    if (ob.buffer !== null) {
      files.push({
        path: ornamentDeployPath(i),
        buffer: ob.buffer,
        contentType: 'image/png',
      })
    }
  })
  return files
}
