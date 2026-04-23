import { assertEngineConfigured } from './env'
import type { QuizState } from './store'

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

export async function postBuild(payload: BuildPayload): Promise<BuildResponse> {
  const engine = assertEngineConfigured()
  const res = await fetch(`${engine}/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    // Engine 4xx (e.g. malformed brandColor) and 5xx errors come back in a
    // shared shape: { requestId, error, phase }. Surface the engine's error
    // string when present so the phone shows something more useful than a
    // bare status line.
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
