import axios from 'axios'
import { nanoid } from 'nanoid'

const NETLIFY_API = 'https://api.netlify.com/api/v1'

/**
 * Deploy a single HTML file as a new Netlify site. Returns the live URL.
 *
 * Three-step API flow:
 *   1. POST /sites           — create a site with a unique subdomain
 *   2. POST /sites/:id/deploys — register a deploy, announcing file SHA1s
 *   3. PUT  /deploys/:id/files/index.html — upload the actual bytes
 *
 * The nanoid suffix guarantees every build gets a fresh URL, so old previews
 * stay live even after the client generates a new version.
 */
export async function deployHtml(html: string, businessSlug: string): Promise<string> {
  const token = process.env.NETLIFY_AUTH_TOKEN
  if (!token) throw new Error('NETLIFY_AUTH_TOKEN not set')

  // Step 1: create site with random unique subdomain
  const suffix = nanoid(6).toLowerCase()
  const siteName = `vno-${businessSlug}-${suffix}`

  const createRes = await axios.post(
    `${NETLIFY_API}/sites`,
    { name: siteName },
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const site = createRes.data

  // Step 2: deploy the single HTML file
  // Netlify's file-digest API wants a SHA1 of each file
  const crypto = await import('crypto')
  const sha1 = crypto.createHash('sha1').update(html).digest('hex')

  const deployRes = await axios.post(
    `${NETLIFY_API}/sites/${site.id}/deploys`,
    { files: { '/index.html': sha1 } },
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const deploy = deployRes.data

  // Step 3: upload the file bytes
  await axios.put(
    `${NETLIFY_API}/deploys/${deploy.id}/files/index.html`,
    html,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
      },
    }
  )

  return `https://${site.name}.netlify.app`
}

/**
 * Turn a business name into a Netlify-safe subdomain fragment.
 * Lowercase, dashes only, max 30 chars. Falls back to 'site' if the input
 * has no usable characters.
 */
export function slugify(businessName: string): string {
  return (
    businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30) || 'site'
  )
}
