import { assertEngineConfigured } from './env'
import type { QuizState } from './store'

export interface BuildPayload {
  vertical: QuizState['vertical']
  business: QuizState['business']
  sections: QuizState['sections']
  vibe: QuizState['vibe']
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
    throw new Error(`Build failed: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<BuildResponse>
}
