import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { buildRoute } from './routes/build.js'

const app = express()
const PORT = Number(process.env.PORT) || 3000

app.use(cors({ origin: true, credentials: false }))
// 25mb handles three base64-encoded phone photos in the /build payload
// (~4-7mb each after base64's 33% inflation). Phase 4's 10mb limit would
// have rejected real uploads now that the engine actually reads req.body.assets.
app.use(express.json({ limit: '25mb' }))

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'vno-engine', phase: 5 })
})

app.post('/build', buildRoute)

app.listen(PORT, () => {
  console.log(`[vno-engine] listening on http://localhost:${PORT}`)
  console.log(`[vno-engine] expose via: cloudflared tunnel --url http://localhost:${PORT}`)
})
