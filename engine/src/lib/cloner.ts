import Anthropic from '@anthropic-ai/sdk'
import { termsFor } from './glossary.js'
import type { BrandPalette, PhotoRole } from './assets.js'
import type {
  ArtDirectorDecision,
  ArtDirectorMeta,
  AtmosphericDirectives,
  FocalOrnament,
  HeroDecision,
  PhotoPlacement,
  PhotoVariantName,
  SectionCopy,
} from '../types/artDirector.js'

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

// -----------------------------------------------------------------------------
// Renderable art direction — the AD decision with deploy paths baked in
// -----------------------------------------------------------------------------
//
// The Art Director emits an `ArtDirectorDecision` that references photos by
// role + variant (logical coordinates) and focal ornaments by index. Before
// the cloner can render HTML, build.ts (Item 5 Step 4) resolves each of
// those logical coordinates to the concrete Netlify deploy path for the
// chosen variant / ornament. The cloner receives the enriched shape below
// and renders `<img src="${ref.src}">` directly — no path computation in
// the prompt, no drift risk between what the cloner emits and what
// build.ts deploys.

/**
 * Hero slot decision enriched with the deploy path of the chosen variant.
 * `src` is always populated for hero — build.ts rejects the build if the
 * hero photo+variant can't be resolved to a deploy path.
 */
export interface RenderableHeroDecision extends HeroDecision {
  src: string
}

/**
 * One non-hero photo placement enriched with the deploy path of the
 * chosen variant.
 */
export interface RenderablePhotoPlacement extends PhotoPlacement {
  src: string
}

/**
 * One focal ornament enriched with its deploy path. `deployPath` is
 * null iff `generationFailed` is true — the cloner is told explicitly
 * to skip failed ornaments rather than render a broken `<img>`.
 */
export interface RenderableFocalOrnament extends FocalOrnament {
  deployPath: string | null
  generationFailed?: boolean
  error?: string
}

/**
 * The AD decision with every image reference resolved to a deploy path.
 * All non-image fields pass through unchanged; only `hero`,
 * `photoPlacements`, and `focalOrnaments` gain `src` / `deployPath`
 * annotations. `logoPath` is always `/logo.png` but is carried here
 * for symmetry so every image reference the cloner uses lives on one
 * structured input.
 */
export interface RenderableArtDirection {
  hero: RenderableHeroDecision
  photoPlacements: RenderablePhotoPlacement[]
  focalOrnaments: RenderableFocalOrnament[]
  atmosphericDirectives: AtmosphericDirectives
  sectionCopy: SectionCopy[]
  meta: ArtDirectorMeta
  logoPath: string
}

// Re-export the underlying types so Item 5 Step 4's build.ts re-wire has
// one import site and doesn't need to reach into ../types/artDirector.js
// separately. Keeps the cloner the coherent integration boundary for
// "everything the renderer consumes."
export type {
  ArtDirectorDecision,
  AtmosphericDirectives,
  PhotoVariantName,
  PhotoRole,
}

// -----------------------------------------------------------------------------
// CloneOptions
// -----------------------------------------------------------------------------

/**
 * Per-build context the cloner needs that isn't part of the business info
 * itself.
 *
 *   - `currentYear`: computed by build.ts (never hardcoded in this file).
 *     Flowed into EST badge, copyright footer, "since" copy.
 *   - `palette`: three 6-digit hex strings with semantic roles
 *     (primary / secondary / accent). Shape-validated at the build route.
 *   - `artDirection`: Art Director decision (Phase Tampa Item 3) with
 *     every image reference already resolved to a Netlify deploy path
 *     (see {@link RenderableArtDirection}). The cloner renders directly
 *     against this record — placement, variant, ornament, atmosphere,
 *     and per-section copy all come from here.
 *
 * The pre-Tampa `photo1Orientation` / `photo2Orientation` fields are gone:
 * the AD decides composition via hero.slot + photoPlacements[].slot, so
 * forwarding orientation tags to the prompt is redundant (and conflicting
 * when AD's slot disagrees with orientation-default layout). The Item 1
 * `photos: ProcessedAsset[]` plumbing field is also removed — the cloner
 * only needs deploy paths, which live on `artDirection`, so carrying the
 * full variant buffers here would just be dead weight.
 */
export interface CloneOptions {
  currentYear: number
  palette: BrandPalette
  artDirection: RenderableArtDirection
}

// -----------------------------------------------------------------------------
// System prompt
// -----------------------------------------------------------------------------

/**
 * System prompt for the cloner. Exported (rather than left private) so
 * the prompt-structure test in src/__tests__/cloner.test.ts can assert
 * that Item 5's ART DIRECTION + TEXTURE sections stay present as the
 * prompt evolves.
 */
export const SYSTEM_PROMPT = `You are a web designer building a one-page landing site for a local small business.

You will be given:
1. A screenshot of a reference website (a small business in the same vertical)
2. Information about the target business
3. Vertical-specific terminology guidance
4. The current year
5. A brand palette — three hex colors with semantic roles (primary, secondary, accent)
6. An Art Director decision record (JSON) that tells you exactly which photo to place where, which variant to render, which focal ornaments to include, and which atmospheric treatment to apply. Honor this record exactly.

Your job: produce a SINGLE HTML FILE that looks visually similar to the reference, but with all content replaced to match the target business AND the target's actual provided assets placed according to the Art Director's decision record.

# YEAR

The current year is provided to you. Use that exact year in the EST badge, the copyright footer, and any "established" or "since" language. Never write "YYYY" literally. Never default to a past year. Never invent a different year.

# BRAND PALETTE

You will be given three hex colors with semantic roles. Use them throughout the site as follows:
- PRIMARY — the dominant brand color. Use for the most prominent surfaces and brand-defining elements: primary CTA backgrounds, hero accents, brand-bar areas, large headings where the brand should assert itself.
- SECONDARY — the supporting brand color. Use for secondary CTAs, alternating section accents, complementary surfaces, callout backgrounds, anywhere a second color is needed to add depth without competing with primary.
- ACCENT — the small-dose pop color. Use sparingly for hover states, badges, link underlines, micro-decorations, dividers, and high-contrast details. Should appear in small areas, not large surfaces.

Default to ample neutral whitespace. The palette colors should feel intentional and proportioned: primary appears with confidence in 2-4 places, secondary supports in 2-3 places, accent punctuates in 4-6 small details. Do not flood the site with palette colors — neutral background and body text remain the dominant surface.

Use the exact hex values provided. Do not approximate, blend, or "improve" them.

# ART DIRECTION

You will be given an \`artDirection\` object (JSON, at the end of the user message) that encodes placement and treatment decisions made by an upstream Art Director agent. Honor this record exactly — every field below has a specific expected consumption pattern, and the cloner that wins the Phase Tampa "made by a human for THIS business" bar is the one that treats these decisions as commitments, not suggestions.

## artDirection.logoPath
The path of the logo on the deployed site (always \`/logo.png\`). Use this as the dominant element in the header. Give it real size and presence — not a tiny corner mark. The logo is the primary brand expression.

## artDirection.hero
The above-the-fold hero slot. It has three fields:
- \`hero.photoId\` — the role of the photo being used (one of \`outside\` / \`inside\` / \`hero\`). Logos are never hero.
- \`hero.variant\` — one of \`raw\` / \`duotone\` / \`cutout\`. The AD chose which variant reads as intentional for this reference.
- \`hero.slot\` — composition: \`full-bleed\` (edge-to-edge photo hero) / \`split-left\` (photo left, copy right) / \`split-right\` (copy left, photo right) / \`polaroid-corner\` (text-first hero with a small rotated photo tucked in a corner).
- \`hero.src\` — the deploy path of the exact variant to render. Use this as the image src directly. Do NOT compute paths yourself.

Render the hero according to \`hero.slot\` using \`hero.src\`. A \`split-left\` with a duotone portrait looks completely different from a \`full-bleed\` raw landscape — match the AD's composition exactly.

## artDirection.photoPlacements
An array, one entry per remaining non-logo non-hero photo. Each entry has \`photoId\`, \`variant\`, \`section\` (which page section to place in: \`hero\` / \`about\` / \`services\` / \`gallery\` / \`pricing\` / \`booking\` / \`contact\` / \`footer\`), \`slot\` (compositional form within the section: \`full-bleed\` / \`contained\` / \`split-left\` / \`split-right\` / \`polaroid-corner\` / \`inline-caption\` / \`background-blur\`), optional \`caption\`, and \`src\` (the deploy path).

Render each photo in the specified section + slot using \`src\`. If a placement has a \`caption\`, render it verbatim under the photo using the caption typography chosen in atmosphericDirectives.captionStyle. If no caption is present, render the photo caption-less.

## artDirection.focalOrnaments
Up to 3 generated illustrations. Each entry has \`anchor.section\`, \`anchor.position\` (\`top-left\` / \`top-right\` / \`bottom-left\` / \`bottom-right\` / \`center\` / \`left-margin\` / \`right-margin\` / \`overlapping-top\`), \`intent\` (a one-line description of what the ornament does — for your understanding only, do not render it), \`prompt\` (the fal.ai prompt that generated it — do not render), \`targetSize\`, \`deployPath\` (where the ornament image lives on the deployed site), and an optional \`generationFailed\`/\`error\` pair.

For each ornament where \`generationFailed\` is not true: render an \`<img src="${'${ornament.deployPath}'}">\` tag absolutely-positioned within the specified \`anchor.section\` at the specified \`anchor.position\`. Use the \`intent\` line to understand what role the ornament plays in the composition — "beside the headline" vs "under the photo" vs "in the margin" shapes its sizing and spacing.

For any ornament where \`generationFailed\` is true: SKIP IT entirely. Do not render a broken \`<img>\` tag, do not add a fallback placeholder, do not invent a replacement. The rest of the page renders without the failed ornament; that is the correct behavior.

Do not add ornaments the AD did not specify. Scarcity is the signal — an AD that emits 1 ornament for a quiet editorial reference is doing it right, and adding decorative marks "to balance the page" would break the effect.

## artDirection.atmosphericDirectives
Page-wide atmospheric directives — \`grain\`, \`divider\`, \`captionStyle\`, \`backdrop\` enums plus an optional \`notes\` string. These drive the TEXTURE pass (see TEXTURE section below for how to render each enum value). If \`grain\` is \`none\`, emit no grain filter. If \`divider\` is \`hairline\`, use \`border-top: 1px solid\` between sections. And so on.

## artDirection.sectionCopy
An array of optional per-section captions and subheads. For each entry, render the \`caption\` and/or \`subhead\` verbatim in the corresponding section. For any section not present in this array, write your own copy derived from the business info + vertical terminology as usual.

## Output against the record

Every image reference in your output HTML must come from the \`artDirection\` record (logoPath, hero.src, photoPlacements[].src, focalOrnaments[].deployPath). Do not hotlink images from the reference site. Do not invent additional deploy paths.

# TEXTURE

The AD's \`atmosphericDirectives\` specifies which atmospheric marks to apply. This section tells you how to render each enum value as CSS / inline SVG.

## Restraint posture

Read the AD's directives as the CEILING, not the FLOOR. If \`grain\` is \`subtle\`, use ONE noise filter at ~0.05 opacity — not two layered patterns. If \`divider\` is \`hairline\`, use one pixel — not a gradient-backed rule. One primitive per direction. Atmosphere is the background of the site's personality; the foreground is photos, hero, and focal ornaments.

If atmosphericDirectives sets \`grain: none\`, \`divider: none\`, \`captionStyle: none\`, \`backdrop: clean\`: keep the page clean. Do not sneak atmosphere in.

## Focal ornament compositing (MANDATORY — flux limitation)

Focal ornaments ship with a solid WHITE background — flux/schnell does not honor "transparent background" prompts. Rendering an ornament as a plain \`<img>\` produces a visible white rectangle around the mark and the whole effect dies.

Pick ONE compositing strategy based on the reference's dominant surface tone and apply it to every focal ornament \`<img>\` (e.g. give them a shared class like \`ornament\`):

- Light page (clean or paper-texture backdrop):
      img.ornament { mix-blend-mode: multiply; }
  Multiply blends the ornament's white background with whatever is underneath, making it effectively invisible against light surfaces.

- Dark page (dark-mode hero, bold modern reference with a dark body background):
      img.ornament { filter: invert(1); mix-blend-mode: screen; }
  Invert flips the dark ink to light, then screen composites the mark as white-on-dark.

If you render an un-composited ornament against any colored surface, the white rectangle will show and the page looks broken. This is not optional.

## grain (enum: none | subtle | strong)

For \`none\`: omit entirely.

For \`subtle\` or \`strong\`, emit this filter + overlay once. Put the SVG at the top of \`<body>\` (or inline in \`<head>\`), and the \`::after\` rule in your \`<style>\` block:

      <svg width="0" height="0" style="position:absolute">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="5"/>
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0"/>
        </filter>
      </svg>

      body::after {
        content: ""; position: fixed; inset: 0; pointer-events: none;
        filter: url(#grain); mix-blend-mode: multiply;
        opacity: OPACITY;
      }

OPACITY = 0.04 to 0.06 for \`subtle\`. 0.10 to 0.14 for \`strong\`. Do not exceed these ranges — grain reads as "textured paper," not "old CRT."

## divider (enum: none | hairline | dotted | flourish)

Between major sections, apply the specified divider. Spacing: 48px above and below.

- \`none\`: use whitespace only. No \`<hr>\`, no border.
- \`hairline\`:
      hr { border: 0; border-top: 1px solid #DDD; margin: 48px 0; }
- \`dotted\`:
      hr { border: 0; border-top: 1px dotted; color: {accent}; opacity: 0.6; margin: 48px 0; }
  Use the accent palette color for \`color\` (dotted borders render in the element's currentColor).
- \`flourish\`: a small centered SVG swirl or curl. One example (a single-wave curl):
      <svg viewBox="0 0 120 20" width="120" height="20" style="display:block;margin:48px auto;color:#888;">
        <path d="M 5 10 Q 30 0, 60 10 T 115 10" fill="none" stroke="currentColor" stroke-width="1.2"/>
      </svg>

## captionStyle (enum: none | italic-serif | handwritten)

Applies to photo captions, section subheads (when sectionCopy supplies them), and any other caption-grade copy.

- \`none\`: omit captions entirely. Photos render caption-less; sectionCopy.caption entries are not rendered.
- \`italic-serif\`: classic editorial caption:
      .caption {
        font-family: 'EB Garamond', Georgia, serif;
        font-style: italic;
        font-size: 0.92em;
        color: #777;
      }
  Add the Google Font link in \`<head>\`:
      <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital@1&display=swap" rel="stylesheet">
- \`handwritten\`: import Kalam or Caveat via Google Fonts:
      <link href="https://fonts.googleapis.com/css2?family=Kalam:wght@400&display=swap" rel="stylesheet">
      .caption { font-family: 'Kalam', cursive; font-size: 1.05em; color: #555; }

## backdrop (enum: clean | blurred-photo | paper-texture)

Page-wide background treatment. Applies to \`<body>\` (or a full-viewport section) underneath everything else.

- \`clean\`:
      body { background: #FFFFFF; }   /* or warm: #FEFCF8 */
  No textures, no overlay.

- \`blurred-photo\`: use one uploaded photo at heavy blur as a section or hero backdrop. Pick the path from \`artDirection.hero.src\` or any \`photoPlacements[i].src\` whose mood fits the section:
      .bg-photo { position: relative; }
      .bg-photo::before {
        content: ""; position: absolute; inset: 0; z-index: -1;
        background: url('PATH_FROM_ARTDIRECTION') center/cover;
        filter: blur(40px) saturate(0.8) brightness(0.9);
      }
      .bg-photo > * { position: relative; }
  Do not use the hero variant in the hero section (the section's already showing it unblurred) — pick a different photo or variant for the backdrop.

- \`paper-texture\`: warm-tinted SVG noise applied to body:
      body {
        background-color: #FAF6EE;
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='p'><feTurbulence baseFrequency='0.7' numOctaves='3' seed='3'/><feColorMatrix values='0 0 0 0 0.8  0 0 0 0 0.7  0 0 0 0 0.5  0 0 0 0.08 0'/></filter><rect width='200' height='200' filter='url(%23p)'/></svg>");
      }

# Output format

- Output ONLY the HTML. No markdown, no code fences, no explanation.
- Start with \`<!DOCTYPE html>\` and end with \`</html>\`.
- All CSS must be inline in a \`<style>\` tag in \`<head>\`. No external stylesheets.
- Copy the reference's visual structure: layout, typography hierarchy, section patterns.
- Replace ALL business-specific text with the target's info.
- Use Google Fonts via \`<link>\` in \`<head>\` if the reference's fonts match a common Google Font.
- Do NOT hotlink images from the reference site. Only use paths from the artDirection record.
- If the reference shows testimonials and you have no real ones, generate 2-3 plausible placeholder testimonials for the target business — signed with first-name-last-initial style names.
- Keep the page mobile-responsive with media queries.
- No JavaScript unless absolutely necessary for layout.`

// -----------------------------------------------------------------------------
// Public entry point
// -----------------------------------------------------------------------------

/**
 * Send the reference screenshot + target business info + Art Director
 * decision record to Claude and get back a single self-contained HTML
 * file. Throws if the response doesn't look like a real HTML document.
 */
export async function cloneToHtml(
  screenshot: Buffer,
  business: BusinessInfo,
  referenceUrl: string,
  options: CloneOptions,
): Promise<string> {
  const userMessage = buildUserMessage(business, referenceUrl, options)
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

// -----------------------------------------------------------------------------
// User message assembly
// -----------------------------------------------------------------------------

function buildUserMessage(b: BusinessInfo, referenceUrl: string, options: CloneOptions): string {
  const activeSections = Object.entries(b.sections)
    .filter(([, on]) => on)
    .map(([k]) => k)
    .join(', ')
  const terms = termsFor(b.vertical)
  // artDirection is pretty-printed (indent 2) so the cloner reads it
  // structurally rather than scanning a single-line blob. Delimiters are
  // plain === markers, not markdown code fences — the system prompt
  // forbids fences in output and seeing them in input would muddle the
  // signal. The system prompt's ART DIRECTION section names this block
  // as "at the end of the user message"; keep it last.
  const artDirectionJson = JSON.stringify(options.artDirection, null, 2)
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

The current year is ${options.currentYear}.
Primary color: ${options.palette.primary}
Secondary color: ${options.palette.secondary}
Accent color: ${options.palette.accent}
${terms ? `\nVertical-specific terminology:\n${terms}\n` : ''}
=== ART DIRECTION ===
${artDirectionJson}
=== END ART DIRECTION ===

Generate the HTML now, honoring the ART DIRECTION record above exactly.`
}

/**
 * Defensive fence-stripping: if Claude wraps output in \`\`\`html ... \`\`\` despite
 * the instructions, peel the fence off. Otherwise return the text as-is.
 */
function extractHtml(text: string): string {
  const fenceMatch = text.match(/```(?:html)?\s*([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()
  return text.trim()
}
