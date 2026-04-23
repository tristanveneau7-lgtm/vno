import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { PhoneShell } from '../components/PhoneShell'
import { Header } from '../components/Header'
import { ContinueButton } from '../components/ContinueButton'
import { tokens } from '../lib/tokens'
import { useQuiz } from '../lib/store'
import { useCanContinue } from '../lib/validation'
import { referencesFor, type Reference, type ReferenceVertical } from '../lib/references'

export function Screen4Reference() {
  const navigate = useNavigate()
  const vertical = useQuiz((s) => s.vertical)
  const reference = useQuiz((s) => s.reference)
  const setReference = useQuiz((s) => s.setReference)
  const canContinue = useCanContinue(4)
  // Null-guarded: on first load `vertical` can briefly be null (navigated here
  // without picking one). referencesFor's signature is strict (Vertical, not
  // Vertical | null) so we guard here instead of loosening the library API.
  // The 'general' refs get folded in by referencesFor itself — see references.ts.
  const refs = vertical ? referencesFor(vertical) : []

  // Empty state — vertical has no seeded references yet. Skip button forwards
  // to step 5 without setting reference; engine /build will reject the payload,
  // which is fine because there's nothing to clone here anyway. Phase 5 grows
  // the library so this branch becomes vestigial.
  if (refs.length === 0) {
    return (
      <PhoneShell>
        <Header step="4 / 7" />
        <div style={{ fontSize: tokens.font.title.size, fontWeight: tokens.font.title.weight, letterSpacing: tokens.font.title.letterSpacing, margin: '0 0 4px' }}>
          No references yet for {vertical ?? 'this vertical'}
        </div>
        <p style={{ fontSize: tokens.font.subtitle.size, color: tokens.font.subtitle.color, margin: '0 0 18px' }}>
          Skip this step \u2014 we'll seed more soon.
        </p>
        <ContinueButton
          onClick={() => navigate('/quiz/5')}
          style={{ marginTop: 22 }}
        >
          Skip {'\u2192'}
        </ContinueButton>
      </PhoneShell>
    )
  }

  return (
    <PhoneShell>
      <Header step="4 / 7" />
      <div style={{ fontSize: tokens.font.title.size, fontWeight: tokens.font.title.weight, letterSpacing: tokens.font.title.letterSpacing, margin: '0 0 4px' }}>
        Pick a direction
      </div>
      <p style={{ fontSize: tokens.font.subtitle.size, color: tokens.font.subtitle.color, margin: '0 0 18px' }}>
        Tap the one that matches this business's vibe.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {refs.map((r) => {
          // Composite identity: many refs in the new library share
          // `url: 'https://dribbble.com/'` and differ only by imageUrl. A bare
          // url compare would paint every dribbble tile as selected once any
          // one was picked. Matching both fields uniquely identifies the ref
          // (undefined === undefined is true, so non-dribbble refs still match
          // correctly on url alone).
          const selected =
            reference?.url === r.url && reference?.imageUrl === r.imageUrl
          return (
            <button
              // r.id is the new stable identifier — url is no longer unique
              // (multiple dribbble refs share it).
              key={r.id}
              type="button"
              onClick={() =>
                setReference({
                  url: r.url,
                  label: r.label,
                  // imageUrl rides through so the engine can bypass Puppeteer
                  // and fetch the direct image/video URL instead. undefined
                  // for refs without one — engine falls back to Puppeteer.
                  imageUrl: r.imageUrl,
                })
              }
              style={{
                background: selected ? '#1A1A1A' : tokens.surface,
                border: selected ? '1.5px solid #FFFFFF' : `0.5px solid ${tokens.border}`,
                borderRadius: tokens.radius.card,
                padding: 10,
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                width: '100%',
                fontFamily: 'inherit',
                color: tokens.textPrimary,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 120ms ease-out, background 120ms ease-out',
              }}
            >
              <VerticalTag vertical={r.vertical} />
              <Thumbnail r={r} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{r.label}</div>
                <div style={{ fontSize: 11, color: '#888' }}>{hostOf(r)}</div>
              </div>
            </button>
          )
        })}
      </div>
      <ContinueButton
        onClick={() => navigate('/quiz/5')}
        disabled={!canContinue}
        style={{ marginTop: 22 }}
      />
    </PhoneShell>
  )
}

/**
 * Small left-column chip showing a ref's vertical tag. Gives the user an
 * at-a-glance signal of which tiles are tailored to their industry vs. which
 * are versatile cross-industry layouts. 'general' renders as "VERSATILE"
 * — reads as a meaningful trait rather than a bucket label.
 */
function VerticalTag({ vertical }: { vertical: ReferenceVertical }) {
  const label = vertical === 'general' ? 'VERSATILE' : vertical.toUpperCase()
  // 'general' gets a slightly different treatment so the mix is visually
  // parseable without being shouty. Same chip shape + size, subtly warmer
  // border so the user can skim a scrolling list and tell which tiles are
  // industry-specific.
  const isGeneral = vertical === 'general'
  return (
    <span
      style={{
        flexShrink: 0,
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: 0.6,
        padding: '3px 6px',
        borderRadius: 4,
        border: `0.5px solid ${isGeneral ? '#5A5A5A' : tokens.border}`,
        background: isGeneral ? '#1E1E1E' : '#141414',
        color: isGeneral ? '#C0C0C0' : '#888',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

/**
 * Three-tier thumbnail strategy:
 *   1. If `r.imageUrl` is present, use it directly — these are designer-quality
 *      screenshots (Dribbble, Awwwards, etc.) and need no local mirror.
 *   2. Otherwise fall back to `/references/<r.id>.png` — the existing Phase 5
 *      pattern where live-URL refs ship with a hand-captured thumbnail on disk.
 *   3. If the chosen src fails to load (missing file, network error), swap to
 *      a clean placeholder: a dark 80x60 box with the ref's initials, so the
 *      tile never shows a broken-image icon. The rest of the row (label, host,
 *      vertical chip) keeps the ref readable and professional even without art.
 *
 * The `onError` path unifies (a) missing-disk-PNG and (b) failed-imageUrl into
 * one graceful fallback — we don't need to know *why* the load failed, just
 * that we should degrade to a styled placeholder.
 */
function Thumbnail({ r }: { r: Reference }) {
  const [failed, setFailed] = useState(false)
  const src = r.imageUrl ?? `/references/${r.id}.png`

  const boxStyle = {
    width: 80,
    height: 60,
    borderRadius: 4,
    flexShrink: 0,
    background: '#0F0F0F',
  } as const

  if (failed) {
    return (
      <div
        role="img"
        aria-label={`${r.label} thumbnail unavailable`}
        style={{
          ...boxStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6A6A6A',
          fontSize: 16,
          fontWeight: 500,
          letterSpacing: 1,
          textTransform: 'uppercase',
          border: `0.5px solid ${tokens.border}`,
        }}
      >
        {initialsOf(r.label)}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={r.label}
      onError={() => setFailed(true)}
      style={{
        ...boxStyle,
        objectFit: 'cover',
      }}
    />
  )
}

/**
 * First letter of the first two whitespace-separated words, uppercased.
 * "Serenity Hair Blaxland" → "SH". Single-word labels fall back to a single
 * initial. Non-letter prefixes (e.g., "The Drake") are kept as-is; the intent
 * is a quick ref-identity signal, not a strict monogram.
 */
function initialsOf(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = words[0][0] ?? '?'
  const second = words[1]?.[0] ?? ''
  return (first + second).toUpperCase()
}

// Mobile Safari supports URL — but a defensive try/catch keeps the tile from
// going blank if a malformed URL ever lands in the library.
function hostOf(r: Reference): string {
  try {
    return new URL(r.url).host
  } catch {
    return r.url
  }
}
