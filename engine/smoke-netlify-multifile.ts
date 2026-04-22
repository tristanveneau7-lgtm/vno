import 'dotenv/config'
import { deploySite, slugify } from './src/lib/netlify.js'

// 1x1 transparent PNG
const pngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const pngBuffer = Buffer.from(pngBase64, 'base64')

const html = `<!DOCTYPE html>
<html><head><title>smoke</title></head>
<body><h1>multi-file smoke</h1><img src="/test.png" alt=""></body></html>`

const slug = slugify('Smoke Test Biz')
console.log('deploying...')
const url = await deploySite(
  html,
  [{ path: '/test.png', buffer: pngBuffer, contentType: 'image/png' }],
  slug
)
console.log('site:', url)
console.log('html:', `${url}/`)
console.log('png: ', `${url}/test.png`)