import axios from 'axios'
import crypto from 'node:crypto'
import { nanoid } from 'nanoid'

const NETLIFY_API = 'https://api.netlify.com/api/v1'

/**
 * @deprecated Use deploySite() instead — it handles assets too. Kept during
 * Phase 5 so the old single-file path stays available until the route is cut
 * over. Remove in the cleanup phase after build.ts migration lands.
 *
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

  // Step 2: deploy the single HTML file. Netlify's file-digest API wants a
  // SHA1 of each file; we announce the digest here and upload bytes below.
  const deployRes = await axios.post(
    `${NETLIFY_API}/sites/${site.id}/deploys`,
    { files: { '/index.html': sha1(html) } },
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
 * A file to include in a multi-file Netlify deploy.
 *   - path: site-absolute path, must start with '/' (e.g. '/logo.png')
 *   - buffer: raw bytes
 *   - contentType: MIME type sent on upload (e.g. 'image/png')
 */
export interface AssetFile {
  path: string
  buffer: Buffer
  contentType: string
}

/**
 * Deploy an HTML page plus a set of binary assets as a new Netlify site.
 * Returns the live URL.
 *
 * Same three-step flow as deployHtml, but the digest registration and upload
 * steps fan out across index.html + every asset. Uploads run in parallel
 * because Netlify treats them as independent idempotent PUTs keyed by SHA1;
 * order doesn't matter.
 *
 * Each call creates a fresh site with a nanoid-suffixed subdomain, so old
 * previews stay live when a prospect regenerates.
 */
export async function deploySite(
  html: string,
  assets: AssetFile[],
  businessSlug: string
): Promise<string> {
  const token = process.env.NETLIFY_AUTH_TOKEN
  if (!token) throw new Error('NETLIFY_AUTH_TOKEN not set')

  const suffix = nanoid(6).toLowerCase()
  const siteName = `vno-${businessSlug}-${suffix}`

  // Step 1: create site
  const createRes = await axios.post(
    `${NETLIFY_API}/sites`,
    { name: siteName },
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const site = createRes.data

  // Step 2: register deploy with digests for every file we intend to upload
  const files: Record<string, string> = {
    '/index.html': sha1(html),
  }
  for (const asset of assets) {
    files[asset.path] = sha1(asset.buffer)
  }

  const deployRes = await axios.post(
    `${NETLIFY_API}/sites/${site.id}/deploys`,
    { files },
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const deploy = deployRes.data

  // Step 3: upload each file. Parallel is safe — Netlify keys uploads by SHA1
  // and the deploy isn't "finished" until every digest has bytes backing it.
  const uploads = [
    uploadFile(deploy.id, '/index.html', Buffer.from(html), 'text/html', token),
    ...assets.map((a) => uploadFile(deploy.id, a.path, a.buffer, a.contentType, token)),
  ]
  await Promise.all(uploads)

  return `https://${site.name}.netlify.app`
}

/**
 * PUT one file's bytes into a Netlify deploy. Path must start with '/' and
 * is concatenated directly onto the deploys/:id/files endpoint.
 */
async function uploadFile(
  deployId: string,
  path: string,
  buffer: Buffer,
  contentType: string,
  token: string
): Promise<void> {
  await axios.put(
    `${NETLIFY_API}/deploys/${deployId}/files${path}`,
    buffer,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType,
      },
    }
  )
}

/**
 * Hex SHA1 of a string or Buffer. Netlify's file-digest API needs this for
 * every file registered in a deploy.
 */
function sha1(data: Buffer | string): string {
  return crypto.createHash('sha1').update(data).digest('hex')
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
