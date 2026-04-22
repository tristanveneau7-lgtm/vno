import { useNavigate } from 'react-router-dom'
import { PhoneShell } from '../components/PhoneShell'
import { Header } from '../components/Header'
import { ContinueButton } from '../components/ContinueButton'
import { tokens } from '../lib/tokens'
import { useQuiz } from '../lib/store'
import { useCanContinue } from '../lib/validation'
import { referencesFor, type Reference } from '../lib/references'

export function Screen4Reference() {
  const navigate = useNavigate()
  const vertical = useQuiz((s) => s.vertical)
  const reference = useQuiz((s) => s.reference)
  const setReference = useQuiz((s) => s.setReference)
  const canContinue = useCanContinue(4)
  const refs = referencesFor(vertical)

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
          const selected = reference?.url === r.url
          return (
            <button
              key={r.url}
              type="button"
              onClick={() => setReference({ url: r.url, label: r.label })}
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
              <img
                src={r.thumbnailPath}
                alt={r.label}
                style={{
                  width: 80,
                  height: 60,
                  borderRadius: 4,
                  objectFit: 'cover',
                  flexShrink: 0,
                  background: '#0F0F0F',
                }}
              />
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

// Mobile Safari supports URL — but a defensive try/catch keeps the tile from
// going blank if a malformed URL ever lands in the library.
function hostOf(r: Reference): string {
  try {
    return new URL(r.url).host
  } catch {
    return r.url
  }
}
