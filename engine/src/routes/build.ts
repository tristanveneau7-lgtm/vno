import type { Request, Response } from 'express'
import { nanoid } from 'nanoid'

const STUB_SITE_URL = process.env.STUB_SITE_URL || 'https://maison-rose-7a3f.netlify.app'
const SIMULATED_BUILD_MS = 2000

export async function buildRoute(req: Request, res: Response): Promise<void> {
  const requestId = nanoid(8)
  const startTime = Date.now()

  console.log(`\n[${requestId}] POST /build`)
  console.log(`[${requestId}] vertical: ${req.body.vertical ?? '(none)'}`)
  console.log(`[${requestId}] business: ${req.body.business?.name ?? '(none)'}`)
  console.log(`[${requestId}] vibe: ${req.body.vibe ?? '(none)'}`)
  console.log(`[${requestId}] sections:`, req.body.sections)
  console.log(`[${requestId}] has logo: ${!!req.body.assets?.logoDataUrl}`)
  console.log(`[${requestId}] anything special: ${req.body.anythingSpecial?.slice(0, 60) ?? '(none)'}`)
  console.log(`[${requestId}] payload size: ${JSON.stringify(req.body).length} bytes`)

  await new Promise((r) => setTimeout(r, SIMULATED_BUILD_MS))

  const buildTime = Number(((Date.now() - startTime) / 1000).toFixed(1))
  const response = {
    requestId,
    url: STUB_SITE_URL,
    buildTime,
    phase: 3,
  }

  console.log(`[${requestId}] \u2192 returning ${JSON.stringify(response)}`)
  res.json(response)
}
