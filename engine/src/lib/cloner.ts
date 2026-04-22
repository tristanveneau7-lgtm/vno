import Anthropic from '@anthropic-ai/sdk'
import { termsFor } from './glossary.js'

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
3. Vertical-specific terminology guidance

Your job: produce a SINGLE HTML FILE that looks visually similar to the reference, but with all content replaced to match the target business AND the target's actual provided assets used in specific positions.

ASSET PLACEMENT (mandatory \u2014 do not deviate):
- The target's LOGO is at /logo.png. Use it as the dominant element in the header. Make it visually prominent \u2014 give it real size and presence, not a tiny corner mark. The logo is the primary brand expression.
- The target's HERO PHOTO is at /hero.jpg. Use it as the main hero image \u2014 replace the reference's hero entirely.
- The target's SECONDARY PHOTO is at /photo2.jpg. Use it in the next major content section after the hero.

DECORATIVE ASSETS (sprinkle these in, do not omit):
- /grain.png \u2014 subtle full-page background overlay. Apply via CSS as fixed-position background with opacity 0.05 and mix-blend-mode: multiply for warmth.
- /badge.png \u2014 small "EST. YYYY" stamp. Position absolute, top-right corner, ~100px wide, with a subtle drop shadow.
- /sketch.png \u2014 hand-drawn flourish. Position immediately under the main hero headline, ~300px wide, centered or aligned with the headline.

Other rules:
- Output ONLY the HTML. No markdown, no code fences, no explanation.
- Start with <!DOCTYPE html> and end with </html>.
- All CSS must be inline in a <style> tag in <head>. No external stylesheets.
- Copy the reference's visual structure: layout, color palette, typography hierarchy, section patterns.
- Replace ALL business-specific text with the target's info.
- Use Google Fonts via <link> in <head> if the reference's fonts match a common Google Font.
- Do NOT hotlink images from the reference site. Only use /logo.png, /hero.jpg, /photo2.jpg, /grain.png, /badge.png, /sketch.png.
- If the reference shows testimonials, generate 2-3 plausible placeholder testimonials for the target business \u2014 signed with first-name-last-initial style names.
- Keep the page mobile-responsive with media queries.
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
  const terms = termsFor(b.vertical)
  return `Reference URL: ${referenceUrl}

Target business info:
- Vertical: ${b.vertical}
- Name: ${b.name}
- Address: ${b.address}
- Phone: ${b.phone}
- Hours: ${b.hours}
${b.slogan ? `- Slogan: ${b.slogan}` : ''}
${b.anythingSpecial ? `- Notes: ${b.anythingSpecial}` : ''}
- Sections on: ${activeSections || '(landing only)'}
${terms ? `\nVertical-specific terminology:\n${terms}\n` : ''}
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
