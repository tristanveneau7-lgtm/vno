import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { buildRoute } from './routes/build.js'

dotenv.config()

const app = express()
const PORT = Number(process.env.PORT) || 3000

app.use(cors({ origin: true, credentials: false }))
app.use(express.json({ limit: '10mb' }))

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'vno-engine', phase: 3 })
})

app.post('/build', buildRoute)

app.listen(PORT, () => {
  console.log(`[vno-engine] listening on http://localhost:${PORT}`)
  console.log(`[vno-engine] expose via: cloudflared tunnel --url http://localhost:${PORT}`)
})
