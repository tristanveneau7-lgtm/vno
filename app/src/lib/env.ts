export const ENGINE_URL = import.meta.env.VITE_ENGINE_URL as string | undefined

export function assertEngineConfigured(): string {
  if (!ENGINE_URL) {
    throw new Error('VITE_ENGINE_URL is not set. Create app/.env with your Cloudflare Tunnel URL.')
  }
  return ENGINE_URL
}
