# VNO v3 — Fresh Chat Handoff

**Purpose of this doc:** everything a new Claude chat needs to pick up VNO v3 at full speed without re-litigating decisions. Tristan has been designing this product for 2 days with Claude. Start from here, not from scratch.

---

## What VNO is

A mobile app Tristan uses while walking Tampa Bay in the coming weeks, pitching local businesses in person. The flow: spot a shop → open app → fill in business info + pick 3 reference sites he likes → tap build → phone shows a stunning, pitch-ready website generated in ~60 seconds → hand phone to owner → owner says yes because the quality is high and the price is low ($249 flat, no retainer). The close happens in the moment, live.

This is different from VNO-Phase-1 and VNO-Phase-2 (which lived in `D:\vno-command\`). Those were template systems built on his laptop. **VNO v3 is the real product.** Everything built prior is reference material, not active code.

---

## The handoff moment (the product's soul)

When Tristan hands his phone to the owner, they see the website in **Preview Mode** — full-screen, no app chrome, no VNO branding, no admin UI. Just their business, already designed. The site is the thing. Only after the owner's been impressed does a subtle bar slide up showing additional future deliverables (social posts, review cards, desk sign — all scoped for future phases, NOT v3).

One-sentence rule: the owner never sees an app. They see their business.

---

## Architecture

### The pipeline

```
Phone (VNO app) → Claude Dispatch → Home PC (24/7) → Build engine → Netlify → Live URL → Phone (Preview Mode)
```

Tristan's PC runs 24/7 in Tampa. Phone sends build requests via Claude Dispatch. Build happens on PC. Completed URL comes back to phone. No cloud infrastructure needed beyond what exists.

### The five inputs that drive a build

1. **Vertical** — tattoo / groomer / barber / salon / trades / restaurant / gym / health / auto / daycare
2. **Business info** — name, address, phone, hours, slogan (manual entry, no scraping)
3. **Section toggles** — Tristan picks per prospect which of the 6 sections to include: Landing (always), Gallery, Phone CTA, Pricing, Booking, About
4. **Reference pick** — Tristan sees 3 reference sites from the curated library (filtered by vertical + vibe), taps the one that fits
5. **Logo + photos** — Tristan uploads logo (manual crop, 15 sec) and optionally snaps storefront photos. fal.ai cleans up the logo (background removal + upscale). Empty slots are filled by fal-generated hero image.

Plus an optional free-text "anything special about them" field — this goes into the AI copy-generation step as context, and the skill decides where it fits best (hero tagline, about paragraph, or service-section flavor).

### The build engine

After inputs flow in, the engine does this on the home PC:

1. **Reference extraction** — looks up the picked reference in the local library, pulls its pre-extracted design system (palette, fonts, spacing, layout archetype).
2. **UI/UX Pro Max skill validates** — checks design system against vertical anti-patterns ("no dark mode for wellness", "no neon for trades"). If conflicts, skill adjusts palette.
3. **Hero image + logo cleanup** — fal.ai Flux Schnell generates the hero image matching the palette. Background-removal model cleans the uploaded logo. Runs in parallel.
4. **Copy generation** — Claude composes the site copy using: vertical templates, the "anything special" context, Tristan's business info inputs. Keeps copy short, on-voice, never invents stats.
5. **HTML generation** — single token-driven generator writes HTML using the extracted design system. All colors/fonts/spacing are tokens from the design system, not hardcoded.
6. **Netlify deploy** — site goes live at `{business-slug}-{hash}.netlify.app`.
7. **Preview Mode URL** — returns to phone. Tristan reviews on his phone first (to confirm nothing broke), approves, then hands phone to owner in Preview Mode.

Target total build time: 30-60 seconds. Progress shown on phone: "Designing palette... Generating hero... Writing copy... Deploying..."

### The reference library

~200 entries. ~20 per vertical. Seeded by scraping Dribbble's API (starts there — Dribbble has official API access and designer-curated content). Additional sources (Mobbin, Behance) come later. Tristan also manually adds Awwwards picks over time.

Each entry in the library JSON has:
- URL (source site)
- Vertical tags (tattoo, salon, trades, etc.)
- Vibe tags (bold, quiet, editorial, modern, heritage, playful, etc.)
- Extracted design system (palette, fonts, spacing, archetype, from skillui)
- Preview thumbnail
- Source (dribbble / awwwards / manual)

Library lives at `D:\vno\references\library.json` with thumbnails in `D:\vno\references\thumbnails\`. Syncs to phone on app open. Works offline if wifi drops.

Library refresh: monthly batch job. Tristan adds new URLs to a seed file, runs `npm run library:refresh`, skillui extracts all of them, library updates.

### The cloner

Uses **skillui** (static analysis, no browser required). URL: https://skillui.vercel.app/. Runs in the library seeding pipeline, not at build time. Extracts design tokens from HTML/CSS statically. Fast, pipeline-friendly, no API keys.

---

## The visual quiz (THE critical UX)

When Tristan opens the app outside a shop, the quiz is:

**Screen 1:** Tap vertical (10 options, visible as big tappable tiles)

**Screen 2:** Type business info (name, address, phone, hours, slogan). Keyboard-friendly. Mobile-optimized.

**Screen 3:** Toggle sections (6 checkboxes: Landing, Gallery, Phone CTA, Pricing, Booking, About). Landing is locked on.

**Screen 4:** Pick a reference. App shows 3 reference sites from the library filtered by vertical (with vibe variety — e.g., 1 bold, 1 quiet, 1 heritage). Each shown as a thumbnail with 2-word vibe label. Tristan taps one.

**Screen 5:** Upload logo (camera or roll), manual crop, save. Optional: snap storefront photos.

**Screen 6:** Optional "anything special?" text field. Tristan types a sentence or skips.

**Screen 7:** Build button. Progress bar appears, takes 30-60 sec.

**Screen 8:** Preview Mode. Tristan reviews, approves, hands to owner.

No "taste profile" that accumulates across prospects. Each pitch is a fresh taste capture via reference pick. This is intentional — Tristan decided against taste-learning complexity.

---

## Project structure

```
D:\vno\
├── app\                      # Mobile PWA (not yet designed — Phase 3b)
├── engine\                   # Build engine (runs on PC)
│   ├── lib\
│   │   ├── cloner.mjs       # skillui wrapper
│   │   ├── image-gen.mjs    # fal.ai wrapper (hero + logo cleanup)
│   │   ├── copy-gen.mjs     # Claude-based copy generation
│   │   ├── generator.mjs    # HTML renderer from design system
│   │   ├── netlify.mjs      # deploy wrapper (port from vno-command)
│   │   └── skill-bridge.mjs # UI/UX Pro Max skill caller
│   ├── verticals\           # 10 vertical configs (copy templates, anti-patterns, section defaults)
│   ├── archetypes\          # 8 layout archetypes as JS functions returning HTML
│   └── bin\
│       └── build-site.mjs   # main build entry
├── references\
│   ├── library.json         # ~200 reference entries
│   ├── seeds\               # source URL lists to re-seed from
│   └── thumbnails\          # preview images for each reference
├── prospects\               # per-prospect build outputs (same pattern as vno-command)
└── .claude\skills\          # installed skills (ui-ux-pro-max, copy over)
```

---

## Skills to use (already installed at D:\vno-command\.claude\skills\)

Port these to `D:\vno\.claude\skills\` in the new folder:

- **frontend-design** (Anthropic official) — aesthetic principles, anti-AI-slop. Always loaded.
- **ui-ux-pro-max** (third-party, installed via uipro-cli) — 161 industry reasoning rules, 67 UI styles, color palettes, font pairings, anti-pattern lists per vertical. Critical for vertical validation step.

---

## What's explicitly NOT in v3

- Social media starter posts (future phase)
- Printable review cards (future phase)
- Printable desk signs (future phase)
- Taste profile learning across prospects (decided against — each pitch is fresh)
- Google Maps URL scraping (Tristan wants manual entry, no auto-scrape)
- Paste-your-own reference URL (curated library only for v3)
- Decorative AI assets (stickers, marks, swirls) — skipped in favor of getting layout-first right
- Agency OS dashboard integration (separate app, not part of v3 scope)

---

## Open questions for the new chat to work through

**A. App tech stack.** Tristan has 5 existing desktop apps made via GitHub Spark. The VNO app could be:
- A GitHub Spark app (fastest to build, he knows the tool)
- A Claude Artifact hosted somewhere (mobile-friendly, limited)
- A custom PWA on Netlify (most control, most work)
- Something else

Recommend GitHub Spark for speed to Tampa.

**B. Build pipeline structure.** The engine is a Node.js project similar to vno-command. Confirm:
- Package structure (single app vs library + CLI)
- How Claude Dispatch triggers a build (CLI command? HTTP webhook? file drop?)
- How the phone app receives the live URL back

**C. Library seeding workflow.** The first 200-entry library has to be built before Tampa. Ideal flow:
- Tristan provides a seed CSV of Dribbble URLs
- A `library:seed` command runs skillui on each, tags them, saves to JSON
- Thumbnails are generated from site screenshots
- Vertical/vibe tags come from LLM classification (Claude reads each URL, tags it)

**D. Copy generation voice.** The vno-command-era `VERTICALS.md` file has vertical-specific voice guidance. Port that file into `D:\vno\engine\verticals\voice.md` and expand. This prevents invented stats and off-voice taglines.

**E. Preview Mode design.** Needs a dedicated spec. Considerations:
- How does the owner know to scroll / what to look at
- Does the URL bar in their browser give away it's a subdomain (impacts trust)
- Does the phone hide notifications during Preview Mode
- Is there a "live editing" option if the owner wants a change on the spot

---

## What success looks like

In 3 weeks Tristan can:
1. Stand outside any Tampa business
2. Open VNO app on phone
3. Go through the quiz in under 90 seconds
4. See a stunning, custom website generated for that business
5. Hand phone to owner in Preview Mode
6. Owner says yes at $249 no retainer

If the site doesn't feel like it cost $3,000, v3 isn't shipping.

---

## Lessons learned from v1 and v2

Hard-won from two days of iteration:

1. **Cowork (Claude Code in an agent session) will freelance if the spec is vague.** Every detail has to be nailed explicitly. When it wasn't, it produced sprinkled AI decorations, invented stats, and duotone walls that looked terrible.

2. **Verification must include visual review, not just "did the build pass."** Phase 2b++ passed its automated checklist but shipped a site with a broken gray bar and invented $120 starting prices because no one actually looked at the site.

3. **Copy matters as much as layout.** "Done right. The first time." is tech-startup voice on a 30-year family electrician. The voice needs to match the vertical's reality, not a generic tagline library.

4. **Taste is visual, not linguistic.** Showing Tristan two design options and asking "which?" works. Asking him "what mood?" doesn't. Every decision point should be visual when possible.

5. **Test with real prospects, not made-up names.** The "Moncton Test Salon" prospects passed because no one was asking hard questions of them. The first real prospect (Blakney Electric) exposed every weakness instantly.

6. **Bounce ideas in chat, build in Cowork, merge locally.** Claude chat → plan. Cowork → execute. PowerShell Copy-Item → merge pack folder into production folder. This three-step workflow worked when the plan was tight.

7. **Fresh folder > refactor.** vno-command got messy fast. vno-command-v2 was proposed, rejected, but in hindsight would have saved hours of cruft navigation. v3 gets a fresh folder (`D:\vno\`) from day 1.

---

## Tristan's working style (for the new chat)

- Highly visual learner — mockups beat walls of text
- Uses tappable quizzes, not free-form prose questions
- Responds to concrete next actions, numbered steps
- Windows/PowerShell, D: drive
- Claude Max 5x, Claude Code in VS Code, GitHub Spark for apps
- Pays for everything from e-transfer tier — no enterprise tools
- Wants "do it right the first time" — hates backtracking
- Will stop work if something feels off ("I'm not impressed," "I don't think we're in flow state") — those gut checks are correct, every time, and should trigger pause/reset, not "let me try to patch"

---

## First move in new chat

When Tristan opens a fresh chat with this doc attached:

1. Read this entire doc before saying anything. No skimming.
2. Greet him briefly, name that you've read the handoff.
3. Ask one question: "We left off ready to design the VNO v3 app structure (open questions A-E above). Want to start with the app tech stack (question A), or jump to library seeding (question C) since that's the longest-running task?"
4. Don't re-litigate decisions already made in this doc. Only revisit them if Tristan explicitly requests.

That's it. The new chat should feel like continuing a conversation, not starting one.
