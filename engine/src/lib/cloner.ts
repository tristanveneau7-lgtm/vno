import Anthropic from '@anthropic-ai/sdk'

let _anthropic: Anthropic | null = null
function getClient(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic()
  return _anthropic
}

export interface BusinessInfo {
  name: string
  address: string
  phone: string
  hours: string
  slogan?: string
  anythingSpecial?: string
  sections: { [key: string]: boolean }
  vertical: string
}

const SYSTEM_PROMPT = `You are a web designer building a one-page landing site for a local small business.

You will be given:
1. A screenshot of a reference website (a small business in the same vertical)
2. Information about the target business

Your job: produce a SINGLE HTML FILE that looks visually similar to the reference, but with all content replaced to match the target business.

Rules:
- Output ONLY the HTML. No markdown, no code fences, no explanation.
- Start with <!DOCTYPE html> and end with </html>.
- All CSS must be inline in a <style> tag in <head>. No external stylesheets.
- Copy the reference's visual structure: layout, color palette, typography hierarchy, section patterns.
- Replace ALL business-specific text (name, address, phone, services, testimonials, etc.) with the target's info.
- You MAY use Google Fonts via <link> in <head> if the reference's fonts match a common Google Font.
- You MAY reference images from the original reference site by their full URL (they'll hotlink). Do NOT invent image URLs.
- If the reference shows testimonials, generate 2-3 plausible placeholder testimonials for the target business — signed with first-name-last-initial style names.
- Keep the page mobile-responsive with media queries.
- Include a simple favicon via data URI if possible, else omit.
- No JavaScript unless absolutely necessary for layout.`

/**
 * Send the reference screenshot + target business info to Claude and get back
 * a single self-contained HTML file. Throws if the response doesn't look like
 * a real HTML document.
 */
export async function cloneToHtml(
  screenshot: Buffer,
  business: BusinessInfo,
  referenceUrl: string
): Promise<string> {
  const userMessage = buildUserMessage(business, referenceUrl)
  const screenshotBase64 = screenshot.toString('base64')

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: screenshotBase64 },
          },
          { type: 'text', text: userMessage },
        ],
      },
    ],
  })

  const first = response.content[0]
  const text = first && first.type === 'text' ? first.text : ''
  const html = extractHtml(text)
  if (!html || !html.includes('<!DOCTYPE html>')) {
    throw new Error('Claude returned invalid HTML')
  }
  return html
}

function buildUserMessage(b: BusinessInfo, referenceUrl: string): string {
  const activeSections = Object.entries(b.sections)
    .filter(([, on]) => on)
    .map(([k]) => k)
    .join(', ')
  return `Reference URL (for image hotlinks): ${referenceUrl}

Target business info:
- Vertical: ${b.vertical}
- Name: ${b.name}
- Address: ${b.address}
- Phone: ${b.phone}
- Hours: ${b.hours}
${b.slogan ? `- Slogan: ${b.slogan}` : ''}
${b.anythingSpecial ? `- Notes: ${b.anythingSpecial}` : ''}
- Sections on: ${activeSections || '(landing only)'}

Generate the HTML now.`
}

/**
 * Defensive fence-stripping: if Claude wraps output in ```html ... ``` despite
 * the instructions, peel the fence off. Otherwise return the text as-is.
 */
function extractHtml(text: string): string {
  const fenceMatch = text.match(/```(?:html)?\s*([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()
  return text.trim()
}
