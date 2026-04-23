import { assertEngineConfigured } from './env'
import type { PhotoRole, QuizState } from './store'

/**
 * Input shape accepted by {@link postBuild}. Mirrors the QuizState fields
 * Screen7Build reads off the store, including `assets.photos` in its
 * keyed-object form. The engine-facing wire shape is different — see the
 * private `BuildWirePayload` below — and the conversion happens inside
 * postBuild so callers stay decoupled from the wire format.
 */
export interface BuildPayload {
  vertical: QuizState['vertical']
  business: QuizState['business']
  sections: QuizState['sections']
  reference: QuizState['reference']
  assets: QuizState['assets']
  anythingSpecial: QuizState['anythingSpecial']
}

export interface BuildResponse {
  requestId: string
  url: string
  buildTime: number
  phase: number
}

/**
 * One photo entry on the wire. `role` is the whole point of Item 0 —
 * downstream stages (engine validation in Item 0 Step 4, the Art Director
 * agent in Item 3) key off it, so the flattener below MUST attach it to
 * every element of the array. Dropping `role` here would silently break
 * Phase Tampa.
 *
 * `orientation` travels as `null` for the logo slot (logos don't carry a
 * portrait/landscape tag) and as `'portrait' | 'landscape'` for every
 * non-logo slot (validation gates continue on all present non-logo
 * orientations being tagged). The engine enforces non-null on non-logo
 * roles in build.ts.
 */
interface PhotoWirePayload {
  role: PhotoRole
  dataUrl: string
  orientation: 'portrait' | 'landscape' | null
}

/**
 * Wire-format payload posted to the engine. Flattens the keyed-object
 * `assets.photos` into an ordered array where each entry carries its
 * role. Only populated slots appear; an unpopulated `hero` slot means
 * three entries on the wire, not four with one null.
 */
interface BuildWirePayload {
  vertical: QuizState['vertical']
  business: QuizState['business']
  sections: QuizState['sections']
  reference: QuizState['reference']
  assets: {
    photos: PhotoWirePayload[]
    palette: QuizState['assets']['palette']
  }
  anythingSpecial: QuizState['anythingSpecial']
}

/**
 * Flatten the keyed-object photos into an array with role attached to
 * every entry. The iteration order is fixed (logo → outside → inside →
 * hero) so the engine receives a stable order, not an
 * object-key-iteration-order surprise. Unpopulated slots are skipped.
 *
 * **Invariant:** every returned element has a non-empty `role` field.
 * Stripping role here would break the Art Director (Phase Tampa Item 3),
 * which keys every decision off it.
 */
function flattenPhotos(photos: QuizState['assets']['photos']): PhotoWirePayload[] {
  const roles: PhotoRole[] = ['logo', 'outside', 'inside', 'hero']
  const out: PhotoWirePayload[] = []
  for (const role of roles) {
    const photo = photos[role]
    if (photo === null) continue
    out.push({
      role,
      dataUrl: photo.dataUrl,
      orientation: photo.orientation,
    })
  }
  return out
}

export async function postBuild(payload: BuildPayload): Promise<BuildResponse> {
  const engine = assertEngineConfigured()
  const wire: BuildWirePayload = {
    vertical: payload.vertical,
    business: payload.business,
    sections: payload.sections,
    reference: payload.reference,
    assets: {
      photos: flattenPhotos(payload.assets.photos),
      palette: payload.assets.palette,
    },
    anythingSpecial: payload.anythingSpecial,
  }
  const res = await fetch(`${engine}/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(wire),
  })
  if (!res.ok) {
    // Engine 4xx (e.g. malformed palette slot) and 5xx errors come back in
    // a shared shape: { requestId, error, phase }. Surface the engine's
    // error string when present so the phone shows something more useful
    // than a bare status line.
    let detail = `${res.status} ${res.statusText}`
    try {
      const body = (await res.json()) as { error?: string }
      if (body && typeof body.error === 'string' && body.error.length > 0) {
        detail = body.error
      }
    } catch {
      // Body wasn't JSON — fall through with the status text.
    }
    throw new Error(`Build failed: ${detail}`)
  }
  return res.json() as Promise<BuildResponse>
}
